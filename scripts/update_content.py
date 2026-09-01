#!/usr/bin/env python3
"""뉴스와 논문을 모아 두는 쪽. 지진 데이터와 같은 30분 사이클에서 함께 돈다.

지진 카탈로그는 매번 최근 14일을 통째로 다시 받아 덮어쓰지만, 뉴스와 논문은
그렇게 할 수 없다. 원본 API 가 "지금까지의 주요 기사/논문"을 한 번에 돌려주지
않기 때문이다. 그래서 여기서는 파일을 쌓아 간다.

  - 처음 한 번은 넓게 긁는다. 논문은 최근 10년 피인용 상위, 뉴스는 큰
    지진들을 다룬 검색어 여러 개.
  - 그 다음부터는 매 사이클마다 (a) 가장 최신 것과 (b) 아직 안 본 다음 페이지를
    가져와, 이미 있는 항목은 버리고 새 것만 더한다.
  - 새로 더한 게 하나도 없으면 파일을 건드리지 않는다. 그래야 auto_update.py 가
    빈 커밋을 만들지 않는다.

출처는 모두 키가 필요 없는 공개 API 다.
  논문: OpenAlex, 토픽 T13018 "Seismology and Earthquake Studies"
  뉴스: Google News RSS + ScienceDaily 지진 피드
"""

from __future__ import annotations

import hashlib
import html
import json
import os
import re
import sys
import tempfile
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "data"
PAPERS_PATH = OUT_DIR / "papers.json"
NEWS_PATH = OUT_DIR / "news.json"

CONTACT = "parkman@mindsai.co.kr"
UA = f"world-earthquake-labs/1.0 (+https://github.com/parkman00771188/wel; {CONTACT})"

OPENALEX_TOPIC = "T13018"      # Seismology and Earthquake Studies
PAPER_YEARS = 10
PAPER_PAGE_SIZE = 50
PAPER_CAP = 300
NEWS_CAP = 300

# Seeding queries, then one of them per cycle so the archive keeps widening
# instead of re-reading the same front page forever.
NEWS_QUERIES = [
    "earthquake",
    "major earthquake damage",
    "deadly earthquake rescue",
    "tsunami earthquake warning",
    "magnitude 7 earthquake",
    "aftershock sequence earthquake",
    "earthquake early warning system",
    "earthquake research study",
]
SCIENCE_FEED = "https://www.sciencedaily.com/rss/earth_climate/earthquakes.xml"

RESEARCH_HINT = re.compile(
    r"\b(stud(?:y|ies)|research|scientist|seismologist|model(?:ing|ling)?|simulation"
    r"|machine learning|AI|analysis|paper|journal)\b", re.I)
DATA_HINT = re.compile(r"\b(dataset|data release|catalog(?:ue)?|open data|archive)\b", re.I)
NETWORK_HINT = re.compile(
    r"\b(seismic network|seismometer|station|sensor|monitoring network|early warning)\b", re.I)
QUAKE_HINT = re.compile(
    r"\b(earthquake|quake|seismic|seismolog\w*|tsunami|aftershock|tremor|fault)\b", re.I)

RESEARCH_SOURCES = {
    "science daily", "sciencedaily", "phys.org", "nature", "science", "eurekalert!",
    "the conversation", "scientific american", "new scientist", "livescience.com",
}


def use_utf8_console() -> None:
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError, OSError):
            pass


def fetch(url: str, tries: int = 3, timeout: int = 45) -> bytes | None:
    """One GET, retried. A source being down must not fail the whole cycle."""
    request = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "*/*"})
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(request, timeout=timeout) as response:
                return response.read()
        except Exception as exc:
            if attempt == tries - 1:
                print(f"[content] 가져오기 실패 ({type(exc).__name__}): {url[:78]}")
                return None
            time.sleep(4 * (attempt + 1))
    return None


def read_json(path: Path) -> dict:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
        return payload if isinstance(payload, dict) else {}
    except (OSError, ValueError):
        return {}


def write_json(path: Path, payload: dict) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.stem}-", suffix=".json", dir=OUT_DIR)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
            handle.write("\n")
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def clean(text: str, limit: int = 400) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", " ", text or ""))
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit].rstrip() + ("…" if len(text) > limit else "")


def title_key(title: str) -> str:
    """Same story from two outlets, or the same paper twice: match on the words."""
    return re.sub(r"[^a-z0-9]+", " ", (title or "").lower()).strip()


# ---------------------------------------------------------------- papers


def rebuild_abstract(index: dict | None) -> str:
    """OpenAlex ships abstracts as {word: [positions]}; put the sentence back."""
    if not index:
        return ""
    slots: list[tuple[int, str]] = []
    for word, positions in index.items():
        for position in positions:
            slots.append((position, word))
    slots.sort()
    return clean(" ".join(word for _, word in slots), 320)


def openalex_page(sort: str, page: int) -> list[dict]:
    since = (datetime.now(timezone.utc) - timedelta(days=365 * PAPER_YEARS)).date().isoformat()
    query = urllib.parse.urlencode({
        "filter": f"primary_topic.id:{OPENALEX_TOPIC},from_publication_date:{since},type:article",
        "sort": sort,
        "per-page": PAPER_PAGE_SIZE,
        "page": page,
        "mailto": CONTACT,
    })
    body = fetch(f"https://api.openalex.org/works?{query}")
    if not body:
        return []
    try:
        return json.loads(body).get("results") or []
    except ValueError:
        return []


def paper_row(work: dict) -> dict | None:
    title = clean(work.get("display_name") or "", 240)
    if not title:
        return None
    authorships = work.get("authorships") or []
    names = [a.get("author", {}).get("display_name") for a in authorships[:3]]
    names = [n for n in names if n]
    if len(authorships) > 3:
        names.append("et al.")
    source = ((work.get("primary_location") or {}).get("source") or {})
    doi = work.get("doi") or ""
    return {
        "id": (work.get("id") or "").rsplit("/", 1)[-1],
        "title": title,
        "authors": ", ".join(names),
        "venue": clean(source.get("display_name") or "", 90),
        "year": work.get("publication_year"),
        "date": work.get("publication_date") or "",
        "cited": work.get("cited_by_count") or 0,
        "open_access": bool((work.get("open_access") or {}).get("is_oa")),
        "url": doi or (work.get("primary_location") or {}).get("landing_page_url") or "",
        "abstract": rebuild_abstract(work.get("abstract_inverted_index")),
    }


def refresh_papers() -> bool:
    store = read_json(PAPERS_PATH)
    items: list[dict] = store.get("items") or []
    seen = {row.get("id") for row in items}
    seeded = bool(items)
    cursor = int(store.get("next_page") or 1)

    works: list[dict] = []
    if not seeded:
        # First run: four pages of the most-cited decade, so the hub opens full.
        print(f"[content] 논문 최초 수집 - 최근 {PAPER_YEARS}년 피인용 상위")
        for page in range(1, 5):
            works += openalex_page("cited_by_count:desc", page)
        cursor = 5
    else:
        works += openalex_page("publication_date:desc", 1)     # 새로 나온 것
        works += openalex_page("cited_by_count:desc", cursor)  # 아직 안 본 다음 장
        cursor = cursor + 1 if cursor < 20 else 1              # 상위 1000편 한 바퀴

    added = 0
    for work in works:
        row = paper_row(work)
        if not row or not row["id"] or row["id"] in seen:
            continue
        seen.add(row["id"])
        items.append(row)
        added += 1

    if not added:
        print(f"[content] 새 논문 없음 (보관 {len(items):,}편)")
        return False

    # 인용수 높은 순으로 두되, 같은 값이면 최신이 앞으로
    items.sort(key=lambda r: (r.get("cited") or 0, r.get("date") or ""), reverse=True)
    del items[PAPER_CAP:]
    write_json(PAPERS_PATH, {
        "schema": 1,
        "generated_utc": utc_now(),
        "source": f"OpenAlex - topic {OPENALEX_TOPIC} (Seismology and Earthquake Studies)",
        "window_years": PAPER_YEARS,
        "next_page": cursor,
        "count": len(items),
        "items": items,
    })
    print(f"[content] 논문 +{added}편 (보관 {len(items):,}편)")
    return True


# ---------------------------------------------------------------- news


def rss_items(body: bytes) -> list[ET.Element]:
    try:
        return ET.fromstring(body).findall(".//item")
    except ET.ParseError:
        return []


def parse_date(text: str) -> str:
    try:
        return parsedate_to_datetime(text).astimezone(timezone.utc).isoformat(
            timespec="seconds").replace("+00:00", "Z")
    except (TypeError, ValueError):
        return ""


def classify(title: str, source: str) -> str:
    """event / research / network. Nothing lands in a tab that stays empty."""
    if NETWORK_HINT.search(title):
        return "network"
    if source.lower() in RESEARCH_SOURCES or RESEARCH_HINT.search(title) or DATA_HINT.search(title):
        return "research"
    return "event"


def news_row(item: ET.Element, fallback_source: str) -> dict | None:
    title = clean(item.findtext("title") or "", 200)
    link = (item.findtext("link") or "").strip()
    if not title or not link:
        return None
    source = clean(item.findtext("source") or fallback_source, 60)
    # Google News appends " - Outlet" to every headline; the outlet is already
    # in its own element, so the suffix is pure duplication.
    if source and title.endswith(f" - {source}"):
        title = title[: -len(source) - 3].rstrip()
    if not QUAKE_HINT.search(title):
        return None

    # Google News fills <description> with a link back to the same headline and
    # the outlet name, so it repeats the two things already on the row. Keep a
    # standfirst only when it is genuinely a summary (ScienceDaily sends one).
    desc = clean(item.findtext("description") or "", 300)
    if title_key(desc).startswith(title_key(title)[:60]) or len(desc) < 60:
        desc = ""

    return {
        "id": hashlib.sha1(title_key(title).encode("utf-8")).hexdigest()[:16],
        "title": title,
        "source": source,
        "url": link,
        "published": parse_date(item.findtext("pubDate") or ""),
        "desc": desc,
        "cat": classify(title, source),
    }


def google_news(query: str) -> list[ET.Element]:
    url = "https://news.google.com/rss/search?" + urllib.parse.urlencode({
        "q": query, "hl": "en-US", "gl": "US", "ceid": "US:en"})
    body = fetch(url)
    return rss_items(body) if body else []


def refresh_news() -> bool:
    store = read_json(NEWS_PATH)
    items: list[dict] = store.get("items") or []
    seen = {row.get("id") for row in items}
    seeded = bool(items)
    cursor = int(store.get("next_query") or 0)

    harvested: list[tuple[ET.Element, str]] = []
    if not seeded:
        print("[content] 뉴스 최초 수집 - 큰 지진들을 다룬 검색어 전체")
        for query in NEWS_QUERIES:
            harvested += [(item, "") for item in google_news(query)]
        cursor = 0
    else:
        harvested += [(item, "") for item in google_news(NEWS_QUERIES[0])]
        rotating = NEWS_QUERIES[1 + cursor % (len(NEWS_QUERIES) - 1)]
        harvested += [(item, "") for item in google_news(rotating)]
        cursor += 1

    science = fetch(SCIENCE_FEED)
    if science:
        harvested += [(item, "Science Daily") for item in rss_items(science)]

    added = 0
    for item, fallback in harvested:
        row = news_row(item, fallback)
        if not row or row["id"] in seen:
            continue
        seen.add(row["id"])
        items.append(row)
        added += 1

    if not added:
        print(f"[content] 새 뉴스 없음 (보관 {len(items):,}건)")
        return False

    items.sort(key=lambda r: r.get("published") or "", reverse=True)
    del items[NEWS_CAP:]
    write_json(NEWS_PATH, {
        "schema": 1,
        "generated_utc": utc_now(),
        "source": "Google News RSS + ScienceDaily earthquake feed",
        "next_query": cursor,
        "count": len(items),
        "items": items,
    })
    print(f"[content] 뉴스 +{added}건 (보관 {len(items):,}건)")
    return True


def refresh_content() -> bool:
    changed = False
    try:
        changed |= refresh_papers()
    except Exception as exc:
        print(f"[content] 논문 갱신 실패: {type(exc).__name__}: {exc}")
    try:
        changed |= refresh_news()
    except Exception as exc:
        print(f"[content] 뉴스 갱신 실패: {type(exc).__name__}: {exc}")
    return changed


def main() -> int:
    use_utf8_console()
    refresh_content()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
