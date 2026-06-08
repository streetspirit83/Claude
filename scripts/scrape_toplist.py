#!/usr/bin/env python3
"""Scrape the AltIndex top-stocks list and write it as JSON.

The toplist is server-rendered, so a plain HTTP GET + HTML parse is enough
(no JS/browser required). Each data row carries an AI-score span which we use
to anchor the row, then pull company name, ticker, price and score from it.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

URL = "https://altindex.com/toplist"
OUTPUT = Path(__file__).resolve().parent.parent / "altindex_toplist.json"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}
PRICE_RE = re.compile(r"\$[\d,]+\.?\d*")


def scrape() -> dict:
    resp = requests.get(URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    stocks = []
    for rank, score_span in enumerate(
        soup.select("span.table-modern__ai-score"), start=1
    ):
        row = score_span.find_parent("tr")
        if row is None:
            continue
        name_el = row.select_one("h6")
        ticker_el = row.select_one("span.text-gray.text-small")
        link_el = row.select_one("a.blank_link[href]")
        price_match = PRICE_RE.search(row.get_text(" ", strip=True))

        score_text = score_span.get_text(strip=True)
        stocks.append(
            {
                "rank": rank,
                "company": name_el.get_text(strip=True) if name_el else None,
                "ticker": ticker_el.get_text(strip=True) if ticker_el else None,
                "price": price_match.group(0) if price_match else None,
                "ai_score": int(score_text) if score_text.isdigit() else None,
                "url": link_el["href"] if link_el else None,
            }
        )

    if not stocks:
        raise SystemExit("No stocks parsed — page structure may have changed.")

    return {
        "source": URL,
        "title": "Top Stocks - AltIndex",
        "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "methodology": (
            "Combines AI and alternative data to assess a stock's mid-term "
            "market outperformance potential (6+ months) by analyzing "
            "financial, technical and alternative data points; scores 0-100."
        ),
        "count": len(stocks),
        "stocks": stocks,
    }


def main() -> int:
    data = scrape()
    OUTPUT.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {data['count']} stocks to {OUTPUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
