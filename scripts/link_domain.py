#!/usr/bin/env python3
"""worldearthquakelabs.com 을 GitHub Pages 에 연결한다.

가비아 DNS 에 레코드를 넣은 뒤 한 번 실행하면 된다. 순서가 중요하다.
커스텀 도메인을 먼저 걸어 버리면 GitHub 은 그 즉시
parkman00771188.github.io/wel/ 를 새 도메인으로 리다이렉트하는데, DNS 가 아직
안 붙어 있으면 잘 되던 주소까지 같이 죽는다. 그래서 이 스크립트는 DNS 부터
확인하고, 맞을 때만 GitHub 설정을 바꾼다.

  python scripts/link_domain.py            # DNS 확인만
  python scripts/link_domain.py --apply    # DNS 가 맞으면 연결까지

인증은 git 이 이미 들고 있는 자격증명을 그대로 쓴다(`git credential fill`).
토큰은 출력하지 않는다.
"""

from __future__ import annotations

import argparse
import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request

OWNER = "parkman00771188"
REPO = "wel"
DOMAIN = "worldearthquakelabs.com"
API = "https://api.github.com"

# GitHub Pages 의 apex 용 고정 IP 4개.
# https://docs.github.com/pages/configuring-a-custom-domain-for-your-github-pages-site
PAGES_IPS = {"185.199.108.153", "185.199.109.153", "185.199.110.153", "185.199.111.153"}


def use_utf8_console() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError, OSError):
            pass


def credential() -> str:
    env = {**os.environ, "GCM_INTERACTIVE": "never", "GIT_TERMINAL_PROMPT": "0"}
    out = subprocess.run(
        ["git", "credential", "fill"],
        input="protocol=https\nhost=github.com\n\n",
        capture_output=True, text=True, env=env, timeout=40)
    if out.returncode != 0:
        raise SystemExit("저장된 github.com 자격증명을 찾지 못했습니다")
    kv = dict(line.split("=", 1) for line in out.stdout.splitlines() if "=" in line)
    if "password" not in kv:
        raise SystemExit("자격증명 도우미가 토큰을 돌려주지 않았습니다")
    return kv["password"]


def call(method: str, path: str, token: str, body: dict | None = None):
    request = urllib.request.Request(
        API + path,
        data=json.dumps(body).encode() if body is not None else None,
        method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": f"{REPO}-domain-setup",
        })
    with urllib.request.urlopen(request, timeout=60) as response:
        raw = response.read()
        return response.status, (json.loads(raw) if raw else {})


def resolved_ips(host: str) -> set[str]:
    try:
        return {info[4][0] for info in socket.getaddrinfo(host, None, socket.AF_INET)}
    except OSError:
        return set()


def dns_ready() -> bool:
    apex = resolved_ips(DOMAIN)
    if not apex:
        print(f"  {DOMAIN}: 응답 없음 (아직 레코드가 없거나 전파 전)")
        return False
    if not apex & PAGES_IPS:
        print(f"  {DOMAIN}: {sorted(apex)} — GitHub Pages IP 가 아닙니다")
        return False
    missing = PAGES_IPS - apex
    print(f"  {DOMAIN}: {len(apex & PAGES_IPS)}/4 개 일치"
          + (f" (빠짐: {sorted(missing)})" if missing else ""))

    www = resolved_ips("www." + DOMAIN)
    print(f"  www.{DOMAIN}: {'응답 없음 — CNAME 을 넣어 주세요' if not www else sorted(www)}")
    return True


def apply_domain(token: str) -> None:
    print(f"커스텀 도메인 설정: {DOMAIN}")
    # cname 만 보낸다. 인증서가 아직 없는 상태에서 https_enforced 를 같이 실으면
    # GitHub 은 403 도 422 도 아닌 404 로 거절한다.
    call("PUT", f"/repos/{OWNER}/{REPO}/pages", token, {"cname": DOMAIN})

    # 인증서는 GitHub 이 발급한다. 발급 전에 https_enforced 를 켜면 거절당하므로
    # 준비될 때까지 기다렸다가 켠다.
    for attempt in range(20):
        _, info = call("GET", f"/repos/{OWNER}/{REPO}/pages", token)
        state = (info.get("https_certificate") or {}).get("state")
        print(f"  [{attempt + 1}] 인증서 상태: {state or '(아직 없음)'}")
        if state == "approved":
            call("PUT", f"/repos/{OWNER}/{REPO}/pages", token, {"https_enforced": True})
            print("  HTTPS 강제 적용 완료")
            break
        time.sleep(30)
    else:
        print("  인증서가 아직 발급되지 않았습니다. 잠시 뒤 --apply 를 다시 실행하면"
              " HTTPS 만 마저 켭니다.")

    _, info = call("GET", f"/repos/{OWNER}/{REPO}/pages", token)
    print(f"완료: {info.get('html_url')}  (cname={info.get('cname')},"
          f" https_enforced={info.get('https_enforced')})")


def main() -> int:
    use_utf8_console()
    parser = argparse.ArgumentParser(description="Point the custom domain at GitHub Pages")
    parser.add_argument("--apply", action="store_true",
                        help="DNS 가 맞으면 GitHub 설정까지 바꾼다")
    args = parser.parse_args()

    print("DNS 확인 중…")
    ready = dns_ready()
    if not ready:
        print()
        print("가비아 → 도메인 → DNS 관리 → DNS 설정 에서 아래를 추가해 주세요.")
        print()
        print("  호스트  타입   값")
        for ip in sorted(PAGES_IPS):
            print(f"  @       A      {ip}")
        print(f"  www     CNAME  {OWNER}.github.io.")
        print()
        print("전파되면 이 스크립트를 --apply 로 다시 실행하세요.")
        return 1

    if not args.apply:
        print("\nDNS 는 준비됐습니다. 연결하려면 --apply 를 붙여 다시 실행하세요.")
        return 0

    apply_domain(credential())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
