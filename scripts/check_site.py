#!/usr/bin/env python3
"""Read-only, dependency-free checks for this static site's review readiness.

    python scripts/check_site.py
    python scripts/check_site.py --url https://worldearthquakelabs.com
    python scripts/check_site.py --json

This checks technical configuration, not AdSense policy compliance or approval.
JavaScript-rendered content, consent behavior and real Google crawler access
still require separate checks. Review mode (no ad loader) is the default;
--allow-ad-loader is only for an intentional later ad-serving configuration.
"""

from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import unquote, urljoin, urlsplit, urlunsplit
from urllib.request import Request, urlopen
from urllib.robotparser import RobotFileParser
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SKIP_DIRS = {".git", ".wrangler", "node_modules", ".venv", "__pycache__"}
AD_LOADER = re.compile(r"(?:https?:)?//[^\s\"'<>]*googlesyndication\.com/[^\s\"'<>]*adsbygoogle\.js", re.I)
USER_AGENTS = {
    "browser": "Mozilla/5.0 (compatible; WorldEarthquakeLabsAudit/1.0)",
    "Googlebot": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mediapartners-Google": "Mediapartners-Google",
}


@dataclass
class Finding:
    level: str
    check: str
    location: str
    message: str


class Document(HTMLParser):
    def __init__(self, source: str):
        super().__init__(convert_charrefs=True)
        self.starts = Counter()
        self.ends = Counter()
        self.doctypes = 0
        self.titles: list[str] = []
        self.meta: dict[str, list[str]] = {}
        self.canonicals: list[str] = []
        self.references: list[tuple[str, str, int]] = []
        self.ids: set[str] = set()
        self.dynamic_fragments: set[str] = set()
        self.scripts: list[str] = []
        self._title = False
        self._script = False
        self.feed(source)
        self.close()

    def handle_decl(self, decl: str):
        if decl.lower().startswith("doctype"):
            self.doctypes += 1

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        self.starts[tag] += 1
        values = dict(attrs)
        if values.get("id"):
            self.ids.add(values["id"])
        if tag == "a" and values.get("name"):
            self.ids.add(values["name"])
        # These are this site's explicit JavaScript view routes, not anchor IDs.
        # Their behavior is a browser test, so do not mislabel them broken links.
        if tag == "a" and any(values.get(name) for name in ("data-view", "data-subview", "data-insight-view")):
            href = values.get("href") or ""
            if href.startswith("#"):
                self.dynamic_fragments.add(unquote(href[1:]))
        if tag == "title":
            self.titles.append("")
            self._title = True
        if tag == "meta":
            name = (values.get("name") or "").lower()
            self.meta.setdefault(name, []).append(values.get("content") or "")
        if tag == "link" and "canonical" in (values.get("rel") or "").lower().split():
            self.canonicals.append(values.get("href") or "")
        if tag == "script":
            self._script = True
            self.scripts.append(values.get("src") or "")
        for attr in ("href", "src"):
            if values.get(attr):
                self.references.append((attr, values[attr], self.getpos()[0]))

    def handle_endtag(self, tag: str):
        self.ends[tag] += 1
        if tag == "title":
            self._title = False
        if tag == "script":
            self._script = False

    def handle_data(self, data: str):
        if self._title:
            self.titles[-1] += data
        if self._script:
            self.scripts[-1] += data

    @property
    def indexable(self) -> bool:
        directives = ",".join(self.meta.get("robots", []) + self.meta.get("googlebot", [])).lower()
        return not ({"noindex", "none"} & set(re.split(r"[\s,]+", directives)))


class Audit:
    def __init__(self, root: Path, allow_ad_loader: bool = False):
        self.root = root.resolve()
        self.allow_ad_loader = allow_ad_loader
        self.findings: list[Finding] = []
        self.pages: dict[Path, Document] = {}
        self.site = "https://worldearthquakelabs.com"
        self.publisher = ""
        self.sitemap: list[str] = []
        self.checked_links = 0
        self.dynamic_links = 0
        self.live_responses: list[dict] = []

    def add(self, level: str, check: str, location: str, message: str):
        self.findings.append(Finding(level, check, location, message))

    def files(self, suffix: str):
        for folder, dirs, files in os.walk(self.root):
            dirs[:] = [name for name in dirs if name not in SKIP_DIRS]
            for name in sorted(files):
                if name.endswith(suffix):
                    yield Path(folder) / name

    def parse_sitemap(self, body: bytes, location: str) -> list[str]:
        try:
            tree = ET.fromstring(body)
            if tree.tag.rsplit("}", 1)[-1] != "urlset":
                raise ValueError("Expected a urlset sitemap")
            urls = [node.text.strip() for node in tree.findall("{*}url/{*}loc") if node.text]
            if not urls:
                raise ValueError("Sitemap has no URLs")
            if len(urls) != len(set(urls)):
                self.add("ERROR", "sitemap", location, "Duplicate sitemap URLs")
            for url in urls:
                parts = urlsplit(url)
                if parts.scheme != "https" or not parts.netloc or parts.query or parts.fragment:
                    self.add("ERROR", "sitemap", location, f"Invalid canonical sitemap URL: {url}")
            return urls
        except (ET.ParseError, ValueError) as exc:
            self.add("ERROR", "sitemap", location, str(exc))
            return []

    def check_ads(self, body: bytes, location: str):
        try:
            content = body.decode("ascii")
        except UnicodeDecodeError:
            self.add("ERROR", "ads.txt", location, "Must be ASCII text without a UTF-8 BOM")
            return
        records = []
        for number, line in enumerate(content.splitlines(), 1):
            line = line.split("#", 1)[0].strip()
            if not line:
                continue
            fields = [part.strip() for part in line.split(",")]
            if len(fields) != 4 or fields[0].lower() != "google.com":
                self.add("ERROR", "ads.txt", location, f"Unexpected record at line {number}; this site's configuration expects Google's four fields")
                continue
            if not re.fullmatch(r"pub-\d{16}", fields[1]) or fields[2] != "DIRECT" or fields[3] != "f08c47fec0942fa0":
                self.add("ERROR", "ads.txt", location, f"Invalid Google publisher record at line {number}")
            records.append(fields[1])
        if records != [self.publisher.removeprefix("ca-")]:
            self.add("ERROR", "ads.txt", location, "Expected exactly one Google DIRECT record matching the homepage's google-adsense-account meta tag")

    def resolve(self, url: str) -> Path | None:
        path = (self.root / unquote(urlsplit(url).path).lstrip("/")).resolve()
        if not path.is_relative_to(self.root):
            return None
        candidates = [path]
        if not path.suffix:
            candidates.extend([Path(str(path) + ".html"), path / "index.html"])
        for candidate in candidates:
            if candidate.is_file():
                return candidate
        return None

    def check_robots(self, body: bytes, urls: list[str], location: str):
        parser = RobotFileParser()
        parser.parse(body.decode("utf-8-sig", errors="replace").splitlines())
        for agent in ("Googlebot", "Mediapartners-Google"):
            for url in [self.site + "/ads.txt", *urls]:
                if not parser.can_fetch(agent, url):
                    self.add("ERROR", "robots", location, f"{agent} is disallowed from {url}")
        maps = parser.site_maps() or []
        if self.site + "/sitemap.xml" not in maps:
            self.add("ERROR", "robots", location, "Missing expected Sitemap declaration")

    def local(self):
        for path in self.files(".html"):
            location = path.relative_to(self.root).as_posix()
            try:
                doc = Document(path.read_text(encoding="utf-8-sig"))
            except (OSError, UnicodeError) as exc:
                self.add("ERROR", "html", location, str(exc))
                continue
            self.pages[path] = doc
            if doc.doctypes != 1:
                self.add("ERROR", "structure", location, f"Expected 1 doctype, found {doc.doctypes}")
            for tag in ("html", "head", "body"):
                if doc.starts[tag] != 1 or doc.ends[tag] != 1:
                    self.add("ERROR", "structure", location, f"Expected 1 <{tag}> and 1 </{tag}>; found {doc.starts[tag]} and {doc.ends[tag]}")
            if not self.allow_ad_loader and any(AD_LOADER.search(script) for script in doc.scripts):
                self.add("ERROR", "review-mode", location, "AdSense ad loader present while review mode is enabled")

        home = self.pages.get(self.root / "index.html")
        if not home:
            self.add("ERROR", "html", "index.html", "Homepage missing or unreadable")
            return
        if len(home.canonicals) == 1:
            parts = urlsplit(home.canonicals[0])
            if parts.scheme == "https" and parts.netloc:
                self.site = f"{parts.scheme}://{parts.netloc}"
        accounts = home.meta.get("google-adsense-account", [])
        if len(accounts) != 1 or not re.fullmatch(r"ca-pub-\d{16}", accounts[0]):
            self.add("ERROR", "publisher", "index.html", "Expected one valid static google-adsense-account meta tag")
        else:
            self.publisher = accounts[0]

        metadata = {"title": {}, "description": {}, "canonical": {}}
        indexable_urls = set()
        site_host = urlsplit(self.site).hostname
        local_hosts = {site_host, "www." + site_host.removeprefix("www.")}
        for path, doc in self.pages.items():
            location = path.relative_to(self.root).as_posix()
            for account in doc.meta.get("google-adsense-account", []):
                if account != self.publisher:
                    self.add("ERROR", "publisher", location, "Publisher meta does not match the homepage")
            if doc.indexable:
                for kind, values in (("title", doc.titles), ("description", doc.meta.get("description", [])), ("canonical", doc.canonicals)):
                    if len(values) != 1 or not values[0].strip():
                        self.add("ERROR", "metadata", location, f"Expected one nonempty {kind}; found {len(values)}")
                        continue
                    value = " ".join(values[0].split())
                    previous = metadata[kind].get(value)
                    if previous:
                        self.add("ERROR", "metadata", location, f"Duplicate {kind} shared with {previous}")
                    metadata[kind][value] = location
                if len(doc.canonicals) == 1:
                    canonical = doc.canonicals[0]
                    indexable_urls.add(canonical)
                    if not canonical.startswith(self.site + "/") or self.resolve(canonical) != path or urlsplit(canonical).query or urlsplit(canonical).fragment:
                        self.add("ERROR", "canonical", location, f"Canonical does not resolve to this page on the expected origin: {canonical}")
            source_url = self.site + "/" + location
            for attribute, reference, line in doc.references:
                url = urljoin(source_url, reference)
                parts = urlsplit(url)
                if parts.scheme not in ("http", "https") or parts.hostname not in local_hosts:
                    continue
                self.checked_links += 1
                target = self.resolve(url)
                if target is None:
                    self.add("ERROR", "local-link", f"{location}:{line}", f"Unresolved {attribute}: {reference}")
                elif parts.fragment and target in self.pages and unquote(parts.fragment) not in self.pages[target].ids:
                    if unquote(parts.fragment) in self.pages[target].dynamic_fragments:
                        self.dynamic_links += 1
                    else:
                        self.add("WARNING", "fragment", f"{location}:{line}", f"No static target for {reference}; verify if JavaScript creates the fragment")
        for name in ("ads.txt", "robots.txt", "sitemap.xml"):
            if not (self.root / name).is_file():
                self.add("ERROR", "required-file", name, "File is missing")
        if (self.root / "ads.txt").is_file():
            self.check_ads((self.root / "ads.txt").read_bytes(), "ads.txt")
        if (self.root / "sitemap.xml").is_file():
            self.sitemap = self.parse_sitemap((self.root / "sitemap.xml").read_bytes(), "sitemap.xml")
            for url in sorted(indexable_urls - set(self.sitemap)):
                self.add("ERROR", "sitemap", "sitemap.xml", f"Indexable page missing: {url}")
            for url in sorted(set(self.sitemap) - indexable_urls):
                self.add("ERROR", "sitemap", "sitemap.xml", f"Entry is not a local indexable canonical: {url}")
        if (self.root / "robots.txt").is_file():
            self.check_robots((self.root / "robots.txt").read_bytes(), sorted(indexable_urls), "robots.txt")
        if not self.allow_ad_loader:
            for path in self.files(".js"):
                if AD_LOADER.search(path.read_text(encoding="utf-8-sig")):
                    self.add("ERROR", "review-mode", path.relative_to(self.root).as_posix(), "AdSense loader URL in JavaScript; review mode expects no loader")

    @staticmethod
    def fetch(url: str, agent: str, timeout: float) -> dict:
        result = {"url": url, "agent": agent, "status": None, "final_url": None, "content_type": "", "x_robots_tag": "", "error": "", "body": b""}
        try:
            request = Request(url, headers={"User-Agent": USER_AGENTS[agent], "Accept": "*/*"})
            with urlopen(request, timeout=timeout) as response:
                result.update(status=response.status, final_url=response.url,
                              content_type=response.headers.get("Content-Type", ""),
                              x_robots_tag=response.headers.get("X-Robots-Tag", ""),
                              body=response.read(2_000_001))
                if len(result["body"]) > 2_000_000:
                    result["error"] = "Response exceeded the 2 MB audit limit"
        except HTTPError as exc:
            result.update(status=exc.code, final_url=exc.url, error=str(exc))
        except (URLError, TimeoutError, OSError, ValueError) as exc:
            result["error"] = str(exc)
        return result

    def record_response(self, result: dict):
        self.live_responses.append({key: value for key, value in result.items() if key != "body"})
        if result["status"] != 200 or result["error"]:
            self.add("ERROR", "live-http", result["url"], f"{result['agent']}: HTTP {result['status']}; {result['error']}")
            return False
        return True

    def live(self, origin: str, timeout: float):
        parts = urlsplit(origin)
        if parts.scheme not in ("http", "https") or not parts.netloc or parts.path not in ("", "/") or parts.query or parts.fragment:
            raise ValueError("--url must be an HTTP(S) origin without a path, query or fragment")
        origin = urlunsplit((parts.scheme, parts.netloc, "", "", ""))
        sitemap_result = self.fetch(origin + "/sitemap.xml", "browser", timeout)
        urls = []
        if self.record_response(sitemap_result):
            urls = self.parse_sitemap(sitemap_result["body"], origin + "/sitemap.xml")
            if set(urls) != set(self.sitemap):
                self.add("WARNING", "live-sitemap", origin + "/sitemap.xml", "Live sitemap differs from the local sitemap; local changes may not be deployed")
        if len(urls) > 200:
            self.add("WARNING", "live-sitemap", origin, "Only the first 200 sitemap URLs will be probed")
        probe_urls = urls
        if not probe_urls and self.sitemap:
            probe_urls = self.sitemap
            self.add("WARNING", "live-sitemap", origin, "Live sitemap could not be parsed; probing known URLs from the local sitemap as a fallback")
        # Fetch pages on the supplied origin while keeping their production
        # canonicals. This also permits --url http://localhost:8642. Reject
        # arbitrary external entries from a malformed sitemap.
        apex = parts.hostname.removeprefix("www.")
        allowed_hosts = {apex, "www." + apex}
        canonical_apex = urlsplit(self.site).hostname.removeprefix("www.")
        sitemap_hosts = allowed_hosts | {canonical_apex, "www." + canonical_apex}
        requests = set()
        expected_canonicals = {}
        for url in probe_urls[:200]:
            if urlsplit(url).hostname in sitemap_hosts:
                request_url = origin + (urlsplit(url).path or "/")
                requests.add((request_url, "browser"))
                expected_canonicals[request_url] = url
            else:
                self.add("ERROR", "live-sitemap", origin, f"External sitemap URL skipped: {url}")
        for agent in USER_AGENTS:
            for path in ("/", "/robots.txt", "/ads.txt"):
                requests.add((origin + path, agent))
        if parts.hostname not in ("localhost", "127.0.0.1", "::1") and not parts.port:
            for scheme in ("http", "https"):
                for host in sorted(allowed_hosts):
                    requests.add((f"{scheme}://{host}/ads.txt", "browser"))
        with ThreadPoolExecutor(max_workers=6) as pool:
            results = list(pool.map(lambda item: self.fetch(*item, timeout), sorted(requests)))
        for result in results:
            if not self.record_response(result):
                continue
            url = result["url"]
            path = urlsplit(url).path
            if path == "/ads.txt":
                self.check_ads(result["body"], f"{url} ({result['agent']})")
                if not result["content_type"].lower().startswith("text/plain"):
                    self.add("WARNING", "live-ads.txt", url, f"Expected text/plain; received {result['content_type']}")
            elif path == "/robots.txt":
                self.check_robots(result["body"], probe_urls, f"{url} ({result['agent']})")
                if "<html" in result["body"].decode("utf-8", errors="replace").lower():
                    self.add("ERROR", "live-robots", url, "robots.txt returned HTML")
            else:
                doc = Document(result["body"].decode("utf-8", errors="replace"))
                if "text/html" not in result["content_type"].lower() or not doc.starts["html"]:
                    self.add("ERROR", "live-page", url, "Expected an HTML page")
                if url in expected_canonicals and (not doc.indexable or re.search(r"\b(noindex|none)\b", result["x_robots_tag"], re.I)):
                    self.add("ERROR", "live-page", url, "Sitemap page is marked noindex")
                if url in expected_canonicals and doc.canonicals != [expected_canonicals[url]]:
                    self.add("ERROR", "live-page", url, f"Canonical differs from sitemap entry: {doc.canonicals}")
                if not self.allow_ad_loader and any(AD_LOADER.search(script) for script in doc.scripts):
                    self.add("ERROR", "live-review-mode", url, f"{result['agent']}: deployed page still loads AdSense ads")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--root", type=Path, default=ROOT, help="Site root (default: repository root)")
    parser.add_argument("--url", help="Also probe a deployed HTTP(S) origin")
    parser.add_argument("--timeout", type=float, default=20, help="HTTP request timeout in seconds")
    parser.add_argument("--json", action="store_true", help="Print machine-readable results")
    parser.add_argument("--allow-ad-loader", action="store_true", help="Disable the review-mode ad-loader check")
    args = parser.parse_args()
    if args.timeout <= 0:
        parser.error("--timeout must be greater than zero")
    audit = Audit(args.root, args.allow_ad_loader)
    audit.local()
    if args.url:
        try:
            audit.live(args.url, args.timeout)
        except ValueError as exc:
            parser.error(str(exc))
    errors = sum(item.level == "ERROR" for item in audit.findings)
    warnings = sum(item.level == "WARNING" for item in audit.findings)
    limitations = [
        "Technical checks do not establish AdSense approval or policy compliance.",
        "Static HTML/JavaScript URL checks do not execute scripts or verify consent behavior, content quality, external links or complete HTML validity.",
        "Explicit data-view/data-subview/data-insight-view fragment routes are counted separately and require browser verification.",
        "robots checks use Python's stdlib parser; Google-specific wildcard and rule precedence are not fully modeled. The site's current wildcard rule concerns binary data, outside the checked page and ads.txt paths.",
    ]
    if args.url:
        limitations.append("User-agent probes originate from this machine, not Google's verified crawler IPs. They cannot prove real Google crawler access or dashboard refresh state. Redirects are followed; intermediate redirect chains are not audited.")
    summary = {"timestamp_utc": datetime.now(timezone.utc).isoformat(), "root": str(audit.root),
               "html_pages": len(audit.pages), "sitemap_urls": len(audit.sitemap),
               "local_references": audit.checked_links, "live_requests": len(audit.live_responses),
               "dynamic_fragment_links": audit.dynamic_links,
               "errors": errors, "warnings": warnings, "review_mode": not args.allow_ad_loader}
    if args.json:
        print(json.dumps({"summary": summary, "findings": [asdict(item) for item in audit.findings],
                          "live_responses": audit.live_responses, "limitations": limitations}, indent=2, ensure_ascii=False))
    else:
        for item in audit.findings:
            print(f"{item.level} [{item.check}] {item.location}: {item.message}")
        print(f"Checked {len(audit.pages)} HTML pages, {len(audit.sitemap)} sitemap URLs, {audit.checked_links} local references, {len(audit.live_responses)} live requests.")
        print(f"JavaScript fragment routes requiring browser verification: {audit.dynamic_links}.")
        print(f"Result: {errors} error(s), {warnings} warning(s).")
        for limit in limitations:
            print(f"Limit: {limit}")
    return 1 if errors else 0


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    raise SystemExit(main())
