#!/usr/bin/env python3
"""이 PC에서 10분마다 도는 지진 데이터 자동 업데이트 한 사이클.

  1. USGS 에 최신 지진 몇 건만 물어본다.
  2. 그게 전부 이미 우리 스냅샷에 있으면 -> 내려받지 않는다.
  3. 새 지진이 있으면 최근 14일을 다시 받아 3d/data/live/ 를 갱신한다.
  4. 이어서 뉴스와 논문도 확인해 새 것만 data/ 에 더한다.
  5. 디스크의 데이터가 origin 에 올라간 것과 다르면 그 파일들만 커밋해서 push 한다.

작업 폴더의 다른 수정 사항은 건드리지 않는다. 데이터 경로만 커밋하기 때문에
사용자가 스테이징해 둔 것도 그대로 남는다.

데이터 커밋은 언제나 방금 받아 온 origin 위에 새로 만든다. 로컬 브랜치에 아직
안 올라간 [auto] 커밋이 쌓여 있어도 그 위에 얹지 않는다 -- 스냅샷은 디스크에
있는 최신 것 하나면 충분하고, 지난 스냅샷 커밋에는 남길 정보가 없다. origin 의
끝이 우리 [auto] 커밋이면 그 자리를 새 커밋으로 바꿔서 하루 144번의 커밋이
쌓이지 않게 한다.

왜 이렇게 하는가. 예전에는 직전 커밋을 amend 하고 force push 했다. 그 push 가
한 번이라도 거절되면 amend 된 커밋이 이미 올라간 제 전신과 같은 줄을 고친
상태라 pull --rebase 가 반드시 충돌했고, 그 뒤의 모든 사이클이 같은 자리에서
멈췄다 (2026-09-07 에 19시간, 2026-09-24 부터 4일 반). 지금 방식은 push 가
실패해도 로컬에 아무것도 남기지 않아 다음 사이클이 origin 을 다시 받아 처음부터
시도한다.

사람이 직접 만든 커밋은 절대 다시 쓰지 않는다. 그런 커밋이 로컬에만 있으면
데이터 커밋을 그 위에 얹고 평범하게 push 하며, 거절되면 로그에 남기고 사람에게
맡긴다.

  자동 실행 등록 : auto_update_start.bat
  중지           : auto_update_stop.bat
  한 번만 실행   : auto_update_run.bat
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from r2_upload import upload_data  # noqa: E402
from update_content import refresh_content  # noqa: E402
from update_live_data import refresh, use_utf8_console  # noqa: E402

use_utf8_console()

ROOT = Path(__file__).resolve().parents[1]
DATA_PATHS = ["3d/data/live", "data"]
AUTO_PREFIX = "[auto]"
# Cloudflare Pages skips a build when the commit message starts with this.
# The data the site reads goes to R2, so a data commit has nothing for Pages
# to rebuild -- and at short intervals the builds alone would run past the
# free tier's 500 a month. Dropped automatically while R2 is not configured,
# because then the deployment is still where the site reads its data from.
SKIP_PREFIX = "[CF-Pages-Skip]"

LOG_FILE = ROOT / "scripts" / "logs" / "auto_update.log"
LOG_MAX_BYTES = 2_000_000
LOCK_FILE = Path(tempfile.gettempdir()) / "wel_auto_update.lock"
LOCK_STALE_SECONDS = 25 * 60


def log(message: str) -> None:
    line = f"[{datetime.now():%Y-%m-%d %H:%M:%S}] {message}"
    try:
        print(line, flush=True)
    except (OSError, UnicodeError, AttributeError):
        pass  # 콘솔이 없거나(pythonw) 인코딩이 막아도 파일 로그는 남긴다
    try:
        LOG_FILE.parent.mkdir(parents=True, exist_ok=True)
        if LOG_FILE.exists() and LOG_FILE.stat().st_size > LOG_MAX_BYTES:
            LOG_FILE.replace(LOG_FILE.with_suffix(".log.old"))
        with LOG_FILE.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except OSError:
        pass  # 로그를 못 써도 업데이트 자체는 계속한다


def failure_reason(output: str) -> str:
    """git 이 남긴 여러 줄 가운데 이유가 적힌 한 줄.

    push 거절은 마지막 줄이 늘 'hint: See the Note about fast-forwards' 라서
    그것만 남기면 왜 거절됐는지 (stale info / fetch first / 네트워크) 알 수 없다.
    """
    lines = [line.strip() for line in output.strip().splitlines() if line.strip()]
    for line in lines:
        if "[rejected]" in line or "[remote rejected]" in line:
            return line
    for line in lines:
        if line.startswith(("fatal:", "error:")) and "failed to push some refs" not in line:
            return line
    for line in reversed(lines):
        if not line.startswith("hint:"):
            return line
    return lines[-1] if lines else ""


def git(*args: str, check: bool = True, quiet: bool = False,
        env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        ["git", *args], cwd=ROOT, capture_output=True, text=True,
        encoding="utf-8", errors="replace", env=env,
    )
    if result.returncode != 0 and not quiet:
        reason = failure_reason(result.stderr or result.stdout or "") or str(result.returncode)
        log(f"  git {' '.join(args)} -> 실패: {reason}")
    if result.returncode != 0 and check:
        raise RuntimeError(f"git {' '.join(args)} failed")
    return result


def sha(rev: str) -> str | None:
    result = git("rev-parse", "--verify", "--quiet", f"{rev}^{{commit}}", check=False, quiet=True)
    return result.stdout.strip() or None


def subject(rev: str) -> str:
    return git("log", "-1", "--pretty=%s", rev, check=False, quiet=True).stdout.strip()


def acquire_lock() -> bool:
    """이전 사이클이 아직 돌고 있으면 이번 회차는 건너뛴다."""
    if LOCK_FILE.exists():
        age = time.time() - LOCK_FILE.stat().st_mtime
        if age < LOCK_STALE_SECONDS:
            log(f"[auto] 이전 사이클이 아직 실행 중입니다 ({int(age)}초 전 시작) - 건너뜁니다")
            return False
        log(f"[auto] 중단된 사이클의 잠금 파일을 정리합니다 ({int(age)}초 경과)")
    LOCK_FILE.write_text(str(os.getpid()), encoding="utf-8")
    return True


def release_lock() -> None:
    try:
        LOCK_FILE.unlink()
    except OSError:
        pass


def commit_message(skip_build: bool) -> str:
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%MZ")
    message = f"{AUTO_PREFIX} 지진 데이터 업데이트 ({stamp})"
    if skip_build:
        message = f"{SKIP_PREFIX} {message}"
    return message


def unpushed_human_commits(branch: str) -> list[str]:
    """origin 에 없는 로컬 커밋 가운데 [auto] 가 아닌 것들의 제목."""
    out = git("log", "--pretty=%s", f"origin/{branch}..HEAD", check=False, quiet=True).stdout
    return [line for line in out.splitlines() if line.strip() and AUTO_PREFIX not in line]


def data_tree(base: str) -> str:
    """base 커밋의 트리에 디스크의 데이터 파일만 얹은 트리.

    임시 인덱스에서 만들기 때문에 실제 인덱스(사용자가 스테이징해 둔 것)는
    건드리지 않는다.
    """
    scratch = tempfile.mkdtemp(prefix="wel-index-")
    env = {**os.environ, "GIT_INDEX_FILE": str(Path(scratch) / "index")}
    try:
        git("read-tree", base, env=env)
        git("add", "--", *DATA_PATHS, env=env)
        return git("write-tree", env=env).stdout.strip()
    finally:
        shutil.rmtree(scratch, ignore_errors=True)


def move_branch(branch: str, old: str, new: str) -> bool:
    """로컬 브랜치와 작업 폴더를 old 에서 new 로 옮긴다.

    git checkout 이 브랜치를 바꿀 때 하는 것과 같은 2-tree merge 라 사용자의
    수정은 그대로 들고 간다. 겹치는 수정이 있으면 아무것도 바꾸지 않고 False.
    """
    if old == new:
        return True
    git("update-index", "-q", "--refresh", check=False, quiet=True)
    # 데이터 파일은 이미 new 의 내용 그대로다. 인덱스에도 그렇게 적어 두어야
    # read-tree 가 '수정된 파일' 로 보고 멈추지 않는다.
    git("add", "--", *DATA_PATHS)
    if git("read-tree", "-m", "-u", old, new, check=False).returncode != 0:
        return False
    git("update-ref", f"refs/heads/{branch}", new, old)
    return True


def publish_on_top(branch: str, remote: str, skip_build: bool, human: list[str]) -> bool:
    """로컬에 push 안 된 수동 커밋이 있을 때. 브랜치를 다시 쓰지 않고 그 위에
    데이터 커밋을 얹어 평범하게 push 한다. 거절되면 사람에게 맡긴다."""
    log(f"[auto] push 안 된 수동 커밋 {len(human)}개가 있습니다 - 그 위에 데이터 커밋을 얹습니다")
    if git("status", "--porcelain", "--", *DATA_PATHS).stdout.strip():
        git("add", "--", *DATA_PATHS)
        git("commit", "-m", commit_message(skip_build), "--", *DATA_PATHS)
        log(f"[auto] 커밋 생성: {sha('HEAD')[:8]}")
    if git("push", "origin", f"HEAD:{branch}", check=False).returncode == 0:
        log(f"[auto] push 완료 -> origin/{branch}")
        return True
    log("[auto] push 거절 - 수동 커밋이 있어 자동으로 정리하지 않습니다. "
        "git pull --rebase 후 push 해 주세요")
    return False


def publish(skip_build: bool = False) -> bool:
    """디스크의 데이터를 origin 과 맞춘다. 실제로 올렸으면 True."""
    branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout.strip() or "main"
    git("fetch", "--quiet", "origin", branch, check=False)  # 원격 위치를 최신으로
    remote = sha(f"origin/{branch}")
    head = sha("HEAD")
    if remote is None or head is None:
        log(f"[auto] origin/{branch} 의 위치를 알 수 없습니다 - 이번 회차는 올리지 않습니다")
        return False

    human = unpushed_human_commits(branch)
    if human:
        return publish_on_top(branch, remote, skip_build, human)

    # 디스크의 데이터가 origin 에 올라간 것과 다른가. HEAD 가 아니라 origin 과
    # 비교해야 지난 회차에 push 가 실패한 것도 이번에 다시 올라간다.
    changed = git("diff", "--quiet", remote, "--", *DATA_PATHS, check=False, quiet=True).returncode != 0
    if not changed:
        if head != remote:
            # 로컬에만 있는 [auto] 커밋들은 origin 에 이미 같은 데이터가 있으니 버린다.
            if move_branch(branch, head, remote):
                log(f"[auto] 로컬 브랜치를 origin/{branch} ({remote[:8]}) 에 맞췄습니다")
            else:
                log(f"[auto] 로컬 브랜치를 origin/{branch} 에 맞추지 못했습니다 - "
                    "작업 폴더의 수정과 겹칩니다")
        log("[auto] 데이터가 origin 과 같습니다 - 올릴 것이 없습니다")
        return False

    # origin 의 끝이 우리 [auto] 커밋이면 그 자리를 대신하고, 아니면 그 위에 얹는다.
    base, replace = remote, False
    parent = sha(f"{remote}~1")
    if AUTO_PREFIX in subject(remote) and parent:
        base, replace = parent, True

    new = git("commit-tree", data_tree(base), "-p", base, "-m", commit_message(skip_build)).stdout.strip()
    log(f"[auto] 커밋 생성: {new[:8]} "
        f"({'origin 끝의 ' + remote[:8] + ' 을 대신' if replace else 'origin/' + branch + ' 위에'})")

    push_args = ["push"]
    if replace:
        # 우리가 방금 본 그 커밋이 origin 에 그대로 있을 때만 덮어쓴다. 그 사이
        # 누가 뭔가 올렸다면 거절되고, 다음 회차가 새 origin 위에 다시 만든다.
        push_args.append(f"--force-with-lease={branch}:{remote}")
    if git(*push_args, "origin", f"{new}:refs/heads/{branch}", check=False).returncode != 0:
        log("[auto] push 거절 - 로컬에는 남기지 않습니다. 다음 회차에 origin 을 다시 받아 처음부터 시도합니다")
        return False
    log(f"[auto] push 완료 -> origin/{branch}")
    git("update-ref", f"refs/remotes/origin/{branch}", new, check=False, quiet=True)

    if not move_branch(branch, head, new):
        log("[auto] 사이트에는 올라갔지만 로컬 브랜치를 옮기지 못했습니다 - 작업 폴더의 "
            "수정과 origin 의 변경이 겹칩니다. git stash, git reset --hard origin/"
            f"{branch}, git stash pop 순으로 정리해 주세요")
    return True


def main() -> int:
    if not acquire_lock():
        return 0
    try:
        log("[auto] ================ 사이클 시작 ================")
        # 지진과 콘텐츠는 서로 독립이다. 지진이 없어도 새 논문이나 기사는 있을 수
        # 있으니 둘 다 확인한다.
        moved = refresh()
        moved = refresh_content() or moved
        # R2 first: that is what the site actually reads. The commit that
        # follows is the archive copy, and it can skip the Pages build only
        # because the upload already happened.
        on_r2 = upload_data(log) if moved else False
        # 디스크가 그대로여도 publish 는 부른다. 지난 회차의 push 가 실패했으면
        # 디스크가 origin 보다 앞서 있고, 그건 새 지진 없이도 올려야 한다.
        publish(skip_build=on_r2)
        return 0
    except Exception as exc:
        log(f"[auto] ERROR: {type(exc).__name__}: {exc}")
        return 1
    finally:
        release_lock()
        log("[auto] 사이클 종료")


if __name__ == "__main__":
    raise SystemExit(main())
