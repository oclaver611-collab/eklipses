#!/usr/bin/env python3
"""
check_domains.py — domain availability checker
Checks .com availability via WHOIS. Edit NAMES below, then run:

    pip install python-whois
    python check_domains.py
"""

import csv
import random
import time

import whois

# ── Edit this list ────────────────────────────────────────────────────────────
NAMES = [
    "ozmeva",
    "thravor",
    "velstrix",
    "kyndrel",
    "aurven",
]
# ─────────────────────────────────────────────────────────────────────────────

TLD     = ".com"
CSV_OUT = "domain_results.csv"
DELAY   = (1.0, 2.0)  # (min, max) seconds between lookups


def check_domain(domain):
    """Return (status, registered_date_str) for a domain."""
    try:
        data = whois.whois(domain)
    except Exception:
        return "LIKELY AVAILABLE", ""

    registrar = data.registrar
    creation  = data.creation_date

    if not registrar and not creation:
        return "LIKELY AVAILABLE", ""

    if isinstance(creation, list):
        creation = creation[0]

    reg_date = ""
    if creation:
        try:
            reg_date = creation.strftime("%Y-%m-%d")
        except AttributeError:
            reg_date = str(creation)[:10]

    return "TAKEN", reg_date


def main():
    names  = [n.strip().lower() for n in NAMES if n.strip()]
    total  = len(names)
    rows   = []

    print(f"\nChecking {total} domain(s) ...\n")

    for i, name in enumerate(names, 1):
        domain = name + TLD
        print(f"  [{i}/{total}] {domain:<30}", end="", flush=True)

        status, reg_date = check_domain(domain)

        if status == "LIKELY AVAILABLE":
            print("LIKELY AVAILABLE")
        else:
            print(f"TAKEN  (registered {reg_date})")

        rows.append((domain, status, reg_date))

        if i < total:
            time.sleep(random.uniform(*DELAY))

    # Sort: available first, then alphabetical within each group
    rows.sort(key=lambda r: (0 if r[1] == "LIKELY AVAILABLE" else 1, r[0]))

    # ── Table ─────────────────────────────────────────────────────────────────
    col = max(len(r[0]) for r in rows) + 2
    bar = "─" * (col + 38)
    print(f"\n{bar}")
    print(f"  {'DOMAIN':<{col}} {'STATUS':<20} REGISTERED")
    print(bar)
    for domain, status, reg_date in rows:
        print(f"  {domain:<{col}} {status:<20} {reg_date}")
    print(bar)

    n_avail = sum(1 for _, s, _ in rows if s == "LIKELY AVAILABLE")
    print(f"\n  {n_avail} of {total} likely available\n")

    # ── CSV ───────────────────────────────────────────────────────────────────
    with open(CSV_OUT, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["domain", "status", "registered"])
        writer.writerows(rows)

    print(f"  Saved to {CSV_OUT}\n")


if __name__ == "__main__":
    main()
