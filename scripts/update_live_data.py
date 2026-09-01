#!/usr/bin/env python3
"""Refresh the small live overlay used by the WEL 2D and 3D maps.

The historical ISC/USGS binaries remain immutable.  Every run refetches the
last 14 days from USGS ComCat so late arrivals and revised solutions replace
the same tail in the browser without rebuilding multi-million-row archives.
"""

from __future__ import annotations

import argparse
import json
import os
import tempfile
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "3d" / "data" / "live"
API = "https://earthquake.usgs.gov/fdsnws/event/1/query"
WINDOW_DAYS = 14
MIN_MAGNITUDE = 2.0
JAPAN_BOUNDS = {"min_lat": 22.0, "max_lat": 48.0, "min_lon": 120.0, "max_lon": 152.0}


def utc_iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def fetch_catalog(start: datetime, end: datetime) -> list[dict]:
    query = urllib.parse.urlencode({
        "format": "geojson",
        "starttime": utc_iso(start),
        "endtime": utc_iso(end),
        "minmagnitude": MIN_MAGNITUDE,
        "orderby": "time-asc",
        "limit": 20000,
    })
    request = urllib.request.Request(
        f"{API}?{query}",
        headers={"Accept": "application/geo+json", "User-Agent": "world-earthquake-labs-live-updater/1.0"},
    )
    last_error: Exception | None = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=180) as response:
                payload = json.load(response)
            features = payload.get("features") or []
            if not features:
                raise RuntimeError("USGS returned an empty 14-day catalog; refusing to replace live data")
            return normalize(features)
        except Exception as exc:  # network/API failures should not erase the previous good snapshot
            last_error = exc
            if attempt == 4:
                break
            wait = 5 * (attempt + 1)
            print(f"[live] fetch failed ({type(exc).__name__}); retrying in {wait}s", flush=True)
            time.sleep(wait)
    raise RuntimeError(f"USGS live update failed after retries: {last_error}")


def normalize(features: list[dict]) -> list[dict]:
    events: list[dict] = []
    for feature in features:
        props = feature.get("properties") or {}
        coords = (feature.get("geometry") or {}).get("coordinates") or []
        if len(coords) < 3 or props.get("mag") is None or props.get("time") is None:
            continue
        magnitude = float(props["mag"])
        if not (MIN_MAGNITUDE <= magnitude <= 9.55):
            continue
        events.append({
            "id": str(feature.get("id") or ""),
            "time_ms": int(props["time"]),
            "updated_ms": int(props.get("updated") or props["time"]),
            "longitude": round(float(coords[0]), 5),
            "latitude": round(float(coords[1]), 5),
            "depth_km": round(max(0.0, float(coords[2])), 3),
            "magnitude": round(magnitude, 2),
            "mag_type": str(props.get("magType") or "mww"),
            "place": str(props.get("place") or ""),
            "status": str(props.get("status") or "automatic"),
        })
    events.sort(key=lambda event: (event["time_ms"], event["id"]))
    return events


def in_japan(event: dict) -> bool:
    return (
        JAPAN_BOUNDS["min_lat"] <= event["latitude"] <= JAPAN_BOUNDS["max_lat"]
        and JAPAN_BOUNDS["min_lon"] <= event["longitude"] <= JAPAN_BOUNDS["max_lon"]
    )


def comparable(payload: dict) -> dict:
    return {
        "schema": payload.get("schema"),
        "window_days": payload.get("window_days"),
        "source": payload.get("source"),
        "region": payload.get("region"),
        "events": payload.get("events") or [],
    }


def write_snapshot(name: str, events: list[dict], generated: str, window_start: str, region: str) -> bool:
    path = OUT_DIR / f"{name}.json"
    payload = {
        "schema": 1,
        "generated_utc": generated,
        "window_start_utc": window_start,
        "window_days": WINDOW_DAYS,
        "source": "USGS ANSS ComCat live overlay",
        "region": region,
        "count": len(events),
        "events": events,
    }
    if path.exists():
        try:
            previous = json.loads(path.read_text(encoding="utf-8"))
            if comparable(previous) == comparable(payload):
                print(f"[live] {name}: unchanged ({len(events):,} events)")
                return False
        except (OSError, ValueError):
            pass

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{name}-", suffix=".json", dir=OUT_DIR)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"))
            handle.write("\n")
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)
    print(f"[live] {name}: wrote {len(events):,} events")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="Refresh WEL's recent USGS overlay")
    parser.add_argument("--window-days", type=int, default=WINDOW_DAYS)
    args = parser.parse_args()
    if args.window_days != WINDOW_DAYS:
        raise SystemExit(f"window length is fixed at {WINDOW_DAYS} days to match the browser merge policy")

    end = datetime.now(timezone.utc) - timedelta(minutes=2)
    start = end - timedelta(days=WINDOW_DAYS)
    events = fetch_catalog(start, end)
    generated = utc_iso(datetime.now(timezone.utc))
    window_start = utc_iso(start)
    changed = False
    changed |= write_snapshot("global", events, generated, window_start, "global")
    changed |= write_snapshot("japan", [event for event in events if in_japan(event)], generated, window_start, "japan")
    print(f"[live] complete: {len(events):,} global events; changed={str(changed).lower()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
