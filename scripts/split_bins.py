#!/usr/bin/env python3
"""25 MiB 를 넘는 지진 바이너리를 조각으로 나눈다.

Cloudflare Pages 는 자산 하나가 25 MiB 를 넘으면 배포 자체를 거부한다.
이 저장소에는 그런 파일이 둘 있다.

    3d/data/quakes.bin              34.2 MiB   (일본 카탈로그)
    3d/data/global/quakes-m3.bin    28.1 MiB   (전세계 M3 밴드)

그래서 배포에 올라가는 건 원본이 아니라 `.part0`, `.part1` … 조각들이고,
브라우저가 받아서 다시 이어 붙인다. 어느 조각이 어느 파일에 속하는지는
`3d/data/parts.json` 에 적어 두고, 로더 세 곳(js/data.js, 3d/js/data.js,
3d/js/globe.js)이 그 파일을 보고 URL 을 정한다.

원본은 로컬에만 남는다(.gitignore). earthquake-layer-3d 파이프라인으로
바이너리를 새로 만들어 넣었으면 이걸 다시 한 번 돌리면 된다.

    python scripts/split_bins.py            # 필요한 것만 다시 자름
    python scripts/split_bins.py --force    # 전부 다시 자름
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "3d" / "data"
MANIFEST = DATA / "parts.json"

# Cloudflare Pages 한도는 25 MiB. 20 으로 자르면 헤더 여유도 남고, 34.2 MiB 짜리가
# 3조각이 아니라 2조각으로 떨어진다.
LIMIT = 25 * 1024 * 1024
CHUNK = 20 * 1024 * 1024


def rel(path: Path) -> str:
    return path.relative_to(DATA).as_posix()


def split_one(path: Path, force: bool) -> list[str]:
    size = path.stat().st_size
    count = (size + CHUNK - 1) // CHUNK
    parts = [f"{rel(path)}.part{i}" for i in range(count)]

    fresh = all((DATA / p).exists() for p in parts) and not force
    if fresh:
        made = sum((DATA / p).stat().st_size for p in parts)
        if made == size:
            print(f"  {rel(path)}: 이미 {count}조각 ({size / 1048576:.1f} MiB)")
            return parts

    with path.open("rb") as src:
        for i, name in enumerate(parts):
            out = DATA / name
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_bytes(src.read(CHUNK))
            print(f"  {name}: {out.stat().st_size / 1048576:.1f} MiB")
    return parts


def main() -> int:
    parser = argparse.ArgumentParser(description="Split oversized data binaries")
    parser.add_argument("--force", action="store_true", help="이미 나뉜 것도 다시 자름")
    args = parser.parse_args()

    if not DATA.is_dir():
        print(f"{DATA} 가 없습니다"); return 1

    files: dict[str, dict] = {}
    oversized = sorted(
        (p for p in DATA.rglob("*.bin") if ".part" not in p.name and p.stat().st_size > LIMIT),
        key=lambda p: p.stat().st_size, reverse=True)

    if not oversized:
        print("25 MiB 를 넘는 파일이 없습니다.")
    for path in oversized:
        size = path.stat().st_size
        print(f"{rel(path)} — {size / 1048576:.1f} MiB, 25 MiB 초과")
        files[rel(path)] = {"bytes": size, "parts": split_one(path, args.force)}

    # 더 이상 쓰이지 않는 조각 정리
    keep = {name for entry in files.values() for name in entry["parts"]}
    for stale in DATA.rglob("*.part*"):
        if rel(stale) not in keep:
            stale.unlink()
            print(f"  정리: {rel(stale)}")

    MANIFEST.write_text(
        json.dumps({"schema": 1, "chunk_bytes": CHUNK, "files": files},
                   ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8", newline="\n")
    print(f"\n{rel(MANIFEST)} 갱신: {len(files)}개 파일")

    if files:
        print("\n원본은 배포에 올라가면 안 됩니다. .gitignore 에 다음이 있어야 합니다:")
        for name in files:
            print(f"  3d/data/{name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
