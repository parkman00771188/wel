#!/usr/bin/env python3
"""robots.txt 와 sitemap.xml 을 만든다.

페이지를 추가하거나 지웠으면 다시 돌리면 된다. lastmod 는 각 파일의 git 최종
커밋 시각을 쓴다 — 파일 mtime 은 clone 할 때마다 바뀌어서 의미가 없다.

    python scripts/build_seo.py
"""

from __future__ import annotations

import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://worldearthquakelabs.com"

# 색인시킬 페이지. 콘솔이 iframe 으로 부를 때 붙는 ?embed=1 사본은 각 페이지의
# canonical 이 여기 있는 주소로 넘겨준다.
PAGES = [
    ("index.html", "/"),
    ("map.html", "/map.html"),
    ("learn.html", "/learn.html"),
    ("insights.html", "/insights.html"),
    ("research.html", "/research.html"),
    ("news.html", "/news.html"),
    ("dashboard.html", "/dashboard.html"),
    ("app.html", "/app.html"),
    ("3d/index.html", "/3d/index.html"),
]

NL = chr(10)

# Crawlers that scrape pages to train models, as distinct from the ones that
# index for search or answer a question and link back. Search and agent bots
# stay welcome: being findable is the point. robots.txt is a request, not a
# control -- the enforcing block is configured at the edge.
TRAINING_BOTS = [
    "GPTBot",              # OpenAI, training
    "Google-Extended",     # Gemini training; does NOT affect Google Search
    "CCBot",               # Common Crawl
    "ClaudeBot",
    "anthropic-ai",
    "Applebot-Extended",   # Apple training opt-out; plain Applebot still indexes
    "meta-externalagent",
    "Bytespider",
]

ROBOTS = (f"""# World Earthquake Labs
User-agent: *
Allow: /

# The catalogue binaries are about 100 MB and hold nothing a crawler can read.
# (This pattern also covers the .part files they are split into.)
Disallow: /3d/data/*.bin

"""
    + "".join(f"User-agent: {bot}" + NL + "Disallow: /" + NL + NL for bot in TRAINING_BOTS)
    + f"Sitemap: {SITE}/sitemap.xml" + NL)


def last_commit(path: str) -> str:
    """git 이 아는 최종 수정 시각. 없으면 오늘."""
    out = subprocess.run(["git", "log", "-1", "--format=%cI", "--", path],
                         cwd=ROOT, capture_output=True, text=True)
    stamp = out.stdout.strip()
    if stamp:
        return stamp[:10]
    return datetime.now(timezone.utc).date().isoformat()


def main() -> int:
    (ROOT / "robots.txt").write_text(ROBOTS, encoding="utf-8", newline="\n")
    print("robots.txt")

    rows = []
    for name, path in PAGES:
        if not (ROOT / name).exists():
            print(f"  건너뜀(없음): {name}")
            continue
        rows.append(
            "  <url>\n"
            f"    <loc>{escape(SITE + path)}</loc>\n"
            f"    <lastmod>{last_commit(name)}</lastmod>\n"
            "  </url>")
        print(f"  {path}")

    sitemap = ('<?xml version="1.0" encoding="UTF-8"?>\n'
               '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
               + "\n".join(rows) + "\n</urlset>\n")
    (ROOT / "sitemap.xml").write_text(sitemap, encoding="utf-8", newline="\n")
    print(f"sitemap.xml — {len(rows)}개")
    return 0


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
