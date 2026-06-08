#!/usr/bin/env python3
"""Scrape AltIndex toplists and write each as JSON.

The toplists are server-rendered, so a plain HTTP GET + HTML parse is enough
(no JS/browser required). Each source has its own table layout, so each gets
its own parser, but they share the request/output plumbing below.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}
PRICE_RE = re.compile(r"\$[\d,]+\.?\d*")
PERCENT_RE = re.compile(r"([\d.,]+)\s*%")


def _fetch_soup(url: str) -> BeautifulSoup:
    resp = requests.get(url, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    return BeautifulSoup(resp.text, "html.parser")


def _ai_score(row) -> int | None:
    score_el = row.select_one("span.table-modern__ai-score")
    if score_el is None:
        return None
    text = score_el.get_text(strip=True)
    return int(text) if text.isdigit() else None


def _signed_percent(delta_el) -> float | None:
    """Read a `delta-indicator` element into a signed percentage (down = negative)."""
    if delta_el is None:
        return None
    indicator = delta_el.select_one(".delta-indicator") or delta_el
    match = PERCENT_RE.search(indicator.get_text(" ", strip=True))
    if not match:
        return None
    value = float(match.group(1).replace(",", ""))
    classes = indicator.get("class", [])
    return -value if "delta-indicator--down" in classes else value


def _digits(text: str | None) -> int | None:
    if not text:
        return None
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else None


def scrape_toplist() -> dict:
    url = "https://altindex.com/toplist"
    soup = _fetch_soup(url)

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
        raise SystemExit("No stocks parsed from toplist — page structure may have changed.")

    return {
        "source": url,
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


def scrape_reddit_mentions() -> dict:
    url = "https://altindex.com/toplist/reddit-mentions"
    soup = _fetch_soup(url)

    stocks = []
    rank = 0
    for row in soup.select("table tr"):
        company_cell = row.select_one("td.table-modern__company")
        if company_cell is None:
            continue
        rank += 1

        name_el = company_cell.select_one(".table-modern__name")
        ticker_el = company_cell.select_one(".table-modern__ticker")
        link_el = company_cell.select_one("a[href]")

        mentions_cell = row.select_one('td[data-label="Mentions"]')
        mentions_value = mentions_cell.select_one(".table-modern__metric-value") if mentions_cell else None
        mentions_delta = mentions_cell.select_one(".table-modern__metric-delta") if mentions_cell else None

        sentiment_el = row.select_one("td.table-modern__sentiment-cell span")

        price_cell = row.select_one('td[data-label="Price"]')
        price_value = price_cell.select_one(".table-modern__metric-value") if price_cell else None
        price_delta = price_cell.select_one(".table-modern__metric-delta") if price_cell else None

        stocks.append(
            {
                "rank": rank,
                "company": name_el.get_text(strip=True) if name_el else None,
                "ticker": ticker_el.get_text(strip=True) if ticker_el else None,
                "mentions": _digits(mentions_value.get_text(strip=True) if mentions_value else None),
                "mentions_change_pct": _signed_percent(mentions_delta),
                "sentiment": sentiment_el.get_text(strip=True) if sentiment_el else None,
                "price": price_value.get_text(strip=True) if price_value else None,
                "price_change_pct": _signed_percent(price_delta),
                "ai_score": _ai_score(row),
                "url": link_el["href"] if link_el else None,
            }
        )

    if not stocks:
        raise SystemExit("No stocks parsed from reddit-mentions — page structure may have changed.")

    return {
        "source": url,
        "title": "Reddit Mentions - AltIndex",
        "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "methodology": (
            "Ranks stocks by recent Reddit mention volume, alongside "
            "mention-volume change, community sentiment and AltIndex AI score."
        ),
        "count": len(stocks),
        "stocks": stocks,
    }


SOURCES = [
    (scrape_toplist, ROOT / "altindex_toplist.json"),
    (scrape_reddit_mentions, ROOT / "altindex_reddit_mentions.json"),
]


def main() -> int:
    for scrape, output in SOURCES:
        data = scrape()
        output.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {data['count']} stocks to {output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
