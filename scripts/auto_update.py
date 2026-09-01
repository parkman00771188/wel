#!/usr/bin/env python3
"""이 PC에서 30분마다 도는 지진 데이터 자동 업데이트 한 사이클.

  1. USGS 에 최신 지진 몇 건만 물어본다.
  2. 그게 전부 이미 우리 스냅샷에 있으면 -> 여기서 끝.
     내려받지도, 커밋하지도, GitHub 에 올리지도 않는다.
  3. 새 지진이 있으면 최근 14일을 다시 받아 3d/data/live/ 를 갱신하고,
     그 두 파일만 커밋해서 push 한다.

작업 폴더의 다른 수정 사항은 건드리지 않는다. 커밋에 경로를 지정하기 때문에
사용자가 스테이징해 둔 것도 그대로 남는다.

하루 48번 도는 만큼, 직전 커밋이 우리가 만든 [auto] 커밋이면 그 위에 쌓지 않고
교체한다. 사람이 직접 만든 커밋은 절대 교체하지 않는다.

  자동 실행 등록 : auto_update_start.bat
  중지           : auto_update_stop.bat
  한 번만 실행   : auto_update_run.bat
"""

from __future__ import annotations

import os
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from update_live_data import refresh  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = "3d/data/live"
AUTO_PREFIX = "[auto]"

LOG_FILE = ROOT / "scripts" / "logs" / "auto_update.log"
LOG_MAX_BYTES = 2_000_000
LOCK_FILE = Path(tempfile.gettempdir()) / "wel_auto_update.lock"
LOCK_STALE_SECONDS = 25 * 60


def log(message: str) -> None:
    line = f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {message}"
    print(line, flush=True)
    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        if LOG_FILE.exists() and LOG_FILE.stat().st_size > LOG_MAX_BYTES:
            LOG_FILE.replace(LOG_FILE.with_suffix(".log.old"))
        with LOG_FILE.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except OSError:
        pass  # 로그를 못 써도 업데이트 자체는 계속한다


def git(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        ["git", *args], cwd=ROOT, capture_output=True, text=True,
        encoding="utf-8", errors="replace",
    )
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "").strip().splitlines()
        log(f"  git {' '.join(args)} -> 실패: {detail[-1] if detail else result.returncode}")
        if check:
            raise RuntimeError(f"git {' '.join(args)} failed")
    return result


def sha(rev: str) -> str | None:
    result = git("rev-parse", "--verify", "--quiet", rev, check=False)
    return result.stdout.strip() or None


def acquire_lock() -> bool:
    """이전 사이클이 아직 돌고 있으면 이번 회차는 건너뛴다."""
    if LOCK_FILE.exists():
        age = time.time() - LOCK_FILE.stat().st_mtime
        if age < LOCK_STALE_SECONDS:
            log(f"[auto] 이전 사이클이 아직 실행 중입니다 ({int(age)}초 전 시작) — 건너뜁니다")
            return False
        log(f"[auto] 중단된 사이클의 잠금 파일을 정리합니다 ({int(age)}초 경과)")
    LOCK_FILE.write_text(str(os.getpid()), encoding="utf-8")
    return True


def release_lock() -> None:
    try:
        LOCK_FILE.unlink()
    except OSError:
        pass


def squash_plan(branch: str) -> tuple[bool, bool]:
    """직전 [auto] 커밋을 교체해도 되는가 -> (교체 가능, force push 필요).

    교체는 두 경우에만 안전하다. 원격이 바로 그 커밋에 있으면 원격까지 다시 써야
    하므로 force 가 필요하고, 원격이 그 하나 전에 있으면 (지난번 push 가 실패한
    경우) 그냥 amend 후 평범하게 push 하면 된다. 그 밖에는 손대지 않는다.
    """
    if not git("log", "-1", "--pretty=%s").stdout.strip().startswith(AUTO_PREFIX):
        return False, False
    remote = sha(f"origin/{branch}")
    if remote is None:
        return False, False
    if remote == sha("HEAD"):
        return True, True
    if remote == sha("HEAD~1"):
        return True, False
    return False, False


def push(branch: str, force: bool) -> bool:
    args = ["push"]
    if force:
        # --force-with-lease: 우리가 확인한 그 커밋이 원격에 그대로 있을 때만
        # 덮어쓴다. 그 사이 누가 뭔가 올렸다면 거절되고 아래 rebase 로 넘어간다.
        args.append("--force-with-lease")
    return git(*args, "origin", f"HEAD:{branch}", check=False).returncode == 0


def publish() -> bool:
    """갱신된 스냅샷만 커밋해서 push. 실제로 올렸으면 True."""
    if not git("status", "--porcelain", "--", DATA_PATH).stdout.strip():
        log("[auto] 파일 내용이 그대로입니다 — 커밋할 것이 없습니다")
        return False

    branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip() or "main"
    git("fetch", "--quiet", "origin", branch, check=False)  # 원격 위치를 최신으로
    amend, force = squash_plan(branch)

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%MZ")
    message = f"{AUTO_PREFIX} 지진 데이터 업데이트 ({stamp})"
    # 경로를 지정해 커밋하면(-- DATA_PATH) 사용자가 스테이징해 둔 다른 파일은
    # 함께 올라가지 않고 인덱스도 그대로 남는다.
    git("add", "--", DATA_PATH)
    git("commit", *(["--amend"] if amend else []), "-m", message, "--", DATA_PATH)
    log(f"[auto] 커밋 {'교체' if amend else '생성'}: {sha('HEAD')[:8]}")

    if push(branch, force):
        log(f"[auto] push 완료 -> origin/{branch}")
        return True

    log("[auto] push 거절 — 원격 변경을 받아 다시 시도합니다")
    if git("pull", "--rebase", "--autostash", "origin", branch, check=False).returncode != 0:
        git("rebase", "--abort", check=False)
        log("[auto] ERROR: rebase 실패. 커밋은 로컬에 남아 있으니 직접 정리한 뒤 push 해 주세요")
        return False

    if push(branch, False):
        log(f"[auto] push 완료 -> origin/{branch} (rebase 후)")
        return True

    log("[auto] ERROR: push 실패. 커밋은 로컬에 남아 있습니다 — 다음 회차에 다시 시도합니다")
    return False


def main() -> int:
    if not acquire_lock():
        return 0
    try:
        log("[auto] ================ 사이클 시작 ================")
        if not refresh():
            log("[auto] 업데이트할 것이 없습니다 — GitHub 에 올릴 것도 없습니다")
            return 0
        publish()
        return 0
    except Exception as exc:
        log(f"[auto] ERROR: {type(exc).__name__}: {exc}")
        return 1
    finally:
        release_lock()
        log("[auto] 사이클 종료")


if __name__ == "__main__":
    raise SystemExit(main())
