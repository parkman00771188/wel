#!/usr/bin/env python3
"""30분마다 바뀌는 JSON 만 R2 로 올린다.

왜 이게 필요한가. 저장소에 push 하면 Cloudflare Pages 가 빌드를 한 번 돈다.
30분 주기면 월 570회쯤인데 무료 한도가 500회다. 정작 바뀌는 건 629 KB 짜리
JSON 네 개뿐이고, 101 MB 짜리 사이트는 그대로다.

그래서 이 네 개만 R2 로 보내고, 사이트는 R2 에서 읽는다. Pages 빌드는 코드를
고칠 때만 돌고(월 몇 회), 데이터 갱신 주기는 30분 그대로다. git 커밋은 백업과
이력용으로 계속 남기되 커밋 메시지에 [CF-Pages-Skip] 을 붙여 빌드를 건너뛴다.

자격증명은 scripts/r2.json 에 둔다. 이 저장소는 공개이므로 그 파일은
.gitignore 에 있고, 절대 커밋되면 안 된다. 파일이 없으면 업로드는 조용히
건너뛰고 사이클은 평소대로 진행한다 — R2 를 아직 안 만들었어도 아무것도
깨지지 않는다.

    scripts/r2.json
    {
      "account_id":  "...",
      "bucket":      "wel-data",
      "access_key":  "...",
      "secret_key":  "..."
    }
"""

from __future__ import annotations

import datetime as dt
import hashlib
import hmac
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "scripts" / "r2.json"

# 저장소 안의 경로 -> R2 안의 키. 사이트가 읽는 주소는 이 키를 그대로 쓴다.
UPLOADS = {
    "3d/data/live/global.json": "3d/data/live/global.json",
    "3d/data/live/japan.json": "3d/data/live/japan.json",
    "data/news.json": "data/news.json",
    "data/papers.json": "data/papers.json",
}

ALGORITHM = "AWS4-HMAC-SHA256"
REGION = "auto"          # R2 는 리전이 하나뿐이고 서명에는 이 문자열을 쓴다
SERVICE = "s3"


def load_config() -> dict | None:
    try:
        cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    need = ("account_id", "bucket", "access_key", "secret_key")
    if not all(cfg.get(k) for k in need):
        return None
    return cfg


def _sign(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def signing_key(secret: str, stamp: str) -> bytes:
    """AWS SigV4 의 파생 키. 날짜·리전·서비스를 차례로 접어 넣는다."""
    k = _sign(f"AWS4{secret}".encode("utf-8"), stamp)
    k = _sign(k, REGION)
    k = _sign(k, SERVICE)
    return _sign(k, "aws4_request")


def put_object(cfg: dict, key: str, body: bytes, content_type: str) -> None:
    host = f"{cfg['account_id']}.r2.cloudflarestorage.com"
    path = f"/{cfg['bucket']}/{key}"
    now = dt.datetime.now(dt.timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    stamp = now.strftime("%Y%m%d")
    payload_hash = hashlib.sha256(body).hexdigest()

    # 서명 대상 헤더는 알파벳 순서로, 이름은 소문자로.
    canonical_headers = (
        f"content-type:{content_type}\n"
        f"host:{host}\n"
        f"x-amz-content-sha256:{payload_hash}\n"
        f"x-amz-date:{amz_date}\n"
    )
    signed_headers = "content-type;host;x-amz-content-sha256;x-amz-date"
    canonical_request = "\n".join([
        "PUT", path, "", canonical_headers, signed_headers, payload_hash,
    ])

    scope = f"{stamp}/{REGION}/{SERVICE}/aws4_request"
    to_sign = "\n".join([
        ALGORITHM, amz_date, scope,
        hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
    ])
    signature = hmac.new(
        signing_key(cfg["secret_key"], stamp), to_sign.encode("utf-8"),
        hashlib.sha256).hexdigest()

    request = urllib.request.Request(
        f"https://{host}{path}", data=body, method="PUT",
        headers={
            "Host": host,
            "Content-Type": content_type,
            "x-amz-content-sha256": payload_hash,
            "x-amz-date": amz_date,
            "Authorization": (
                f"{ALGORITHM} Credential={cfg['access_key']}/{scope}, "
                f"SignedHeaders={signed_headers}, Signature={signature}"),
        })
    with urllib.request.urlopen(request, timeout=90) as response:
        if response.status not in (200, 201):
            raise RuntimeError(f"R2 {key} -> HTTP {response.status}")


def upload_data(log=print) -> bool:
    """바뀐 JSON 을 R2 로 올린다. 설정이 없으면 조용히 건너뛴다."""
    cfg = load_config()
    if not cfg:
        return False

    sent = 0
    for local, key in UPLOADS.items():
        path = ROOT / local
        if not path.exists():
            continue
        try:
            put_object(cfg, key, path.read_bytes(), "application/json; charset=utf-8")
            sent += 1
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", "replace")[:160]
            log(f"[r2] {key} 실패 {exc.code}: {body}")
        except Exception as exc:
            log(f"[r2] {key} 실패 {type(exc).__name__}: {exc}")

    if sent:
        log(f"[r2] {sent}개 파일 업로드")
    return sent > 0


def main() -> int:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError, OSError):
            pass
    if not load_config():
        print(f"{CONFIG} 가 없거나 값이 비어 있습니다. R2 업로드를 건너뜁니다.")
        return 1
    return 0 if upload_data() else 1


if __name__ == "__main__":
    raise SystemExit(main())
