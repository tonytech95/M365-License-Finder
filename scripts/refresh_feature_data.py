#!/usr/bin/env python3
"""
Refresh the SKU -> service-plan mapping from Microsoft's own, periodically
updated "Product names and service plan identifiers for licensing" CSV.

This is the automatable half of keeping the license finder current:
  - The CSV has a STABLE download URL (no bot-protection, confirmed working
    via plain HTTP GET) and Microsoft updates it directly (last-updated date
    is printed on the source Learn page).
  - Pricing is NOT in this CSV (Microsoft doesn't publish a pricing API/feed),
    so prices still need periodic manual/agent re-verification against the
    canonical pricing pages listed in assets/products.json -> meta.

What this script does on each run:
  1. Downloads the latest CSV.
  2. Extracts the service-plan list for every SKU in scripts/tracked_skus.json.
  3. Diffs against the last snapshot (data/service_plans_snapshot.json).
  4. Appends a dated entry to data/refresh_log.md describing what changed
     (new SKU string IDs that vanished/appeared, service plans added/removed
     per tracked SKU).
  5. Updates assets/products.json -> meta.sku_identifier_checked to today's
     date so the site's freshness banner reflects the check, regardless of
     whether anything actually changed.

Run manually:
    python3 scripts/refresh_feature_data.py

Intended to also be run by a scheduled task (see project README / the
conversation where this was set up) which then reviews data/refresh_log.md
and only bothers the user if something actually changed.
"""
import csv
import io
import json
import sys
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CSV_URL = (
    "https://download.microsoft.com/download/e/3/e/e3e9faf2-f28b-490a-9ada-c6089a1fc5b0/"
    "Product%20names%20and%20service%20plan%20identifiers%20for%20licensing.csv"
)
CSV_LOCAL = ROOT / "data" / "msft_licensing_reference.csv"
TRACKED_SKUS = ROOT / "scripts" / "tracked_skus.json"
SNAPSHOT = ROOT / "data" / "service_plans_snapshot.json"
LOG = ROOT / "data" / "refresh_log.md"
PRODUCTS = ROOT / "assets" / "products.json"


def download_csv() -> str:
    req = urllib.request.Request(CSV_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = resp.read()
    CSV_LOCAL.parent.mkdir(parents=True, exist_ok=True)
    CSV_LOCAL.write_bytes(raw)
    return raw.decode("utf-8-sig", errors="replace")


def build_sku_service_plans(csv_text: str, tracked: dict) -> dict:
    """Return {sku_key: sorted[list of friendly service-plan names]} for tracked SKUs."""
    wanted_string_ids = {v["string_id"]: k for k, v in tracked.items()}
    result = {k: set() for k in tracked}
    reader = csv.DictReader(io.StringIO(csv_text))
    for row in reader:
        sid = row.get("String_Id")
        if sid in wanted_string_ids:
            key = wanted_string_ids[sid]
            friendly = row.get("Service_Plans_Included_Friendly_Names", "").strip()
            if friendly:
                result[key].add(friendly)
    return {k: sorted(v) for k, v in result.items()}


def load_json(path: Path, default):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return default


def diff_snapshots(old: dict, new: dict) -> list[str]:
    lines = []
    all_keys = sorted(set(old) | set(new))
    for key in all_keys:
        old_plans = set(old.get(key, []))
        new_plans = set(new.get(key, []))
        added = sorted(new_plans - old_plans)
        removed = sorted(old_plans - new_plans)
        if added or removed:
            lines.append(f"- **{key}**")
            for p in added:
                lines.append(f"  - + added: {p}")
            for p in removed:
                lines.append(f"  - \u2212 removed: {p}")
    return lines


def main():
    tracked = load_json(TRACKED_SKUS, {})
    if not tracked:
        print("No tracked SKUs found; nothing to do.", file=sys.stderr)
        sys.exit(1)

    print(f"Downloading {CSV_URL} ...")
    csv_text = download_csv()
    new_snapshot = build_sku_service_plans(csv_text, tracked)

    old_snapshot = load_json(SNAPSHOT, {})
    diff_lines = diff_snapshots(old_snapshot, new_snapshot)

    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(f"\n## Refresh check — {timestamp}\n")
        if diff_lines:
            f.write("Changes detected in Microsoft's SKU/service-plan CSV:\n\n")
            f.write("\n".join(diff_lines) + "\n")
        else:
            f.write("No changes to tracked SKUs' service-plan lists.\n")

    SNAPSHOT.write_text(json.dumps(new_snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # Always bump the "checked" date so the site's freshness banner is honest
    # about when the check last ran, even if nothing changed.
    products = load_json(PRODUCTS, None)
    if products is not None:
        products["meta"]["sku_identifier_checked"] = date.today().isoformat()
        PRODUCTS.write_text(json.dumps(products, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    if diff_lines:
        print(f"CHANGES DETECTED ({len(diff_lines)} line(s) of diff) \u2014 see {LOG}")
        sys.exit(2)  # distinct exit code so a calling agent/cron can branch on it
    else:
        print("No changes detected.")
        sys.exit(0)


if __name__ == "__main__":
    main()
