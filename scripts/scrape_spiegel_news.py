#!/usr/bin/env python3
"""Scrape the DER SPIEGEL homepage and write its headlines as JSON.

The homepage is server-rendered HTML. Rather than relying on CSS class names
(which are build-hashed and change frequently on news sites), we anchor on
SPIEGEL's stable article URL convention — a slug followed by `-a-<uuid>` —
and derive the section from the URL's first path segment (e.g. "wirtschaft",
"ausland", "sport").
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup

URL = "https://www.spiegel.de/"
OUTPUT = Path(__file__).resolve().parent.parent / "spiegel_news.json"
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}
ARTICLE_URL_RE = re.compile(
    r"^https://www\.spiegel\.de/[^\"'\s]+-a-"
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
)


def scrape() -> dict:
    resp = requests.get(URL, headers=HEADERS, timeout=30)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    articles = []
    seen = set()
    for link in soup.find_all("a", href=True):
        href = link["href"].split("#", 1)[0]
        if href in seen or not ARTICLE_URL_RE.match(href):
            continue

        headline_el = link.find(["h2", "h3", "h4"])
        headline = (
            headline_el.get_text(" ", strip=True)
            if headline_el
            else link.get_text(" ", strip=True)
        )
        if not headline:
            continue
        seen.add(href)

        teaser_el = link.find("p")
        teaser = teaser_el.get_text(" ", strip=True) if teaser_el else None

        section = next(
            (part for part in urlparse(href).path.split("/") if part), None
        )

        articles.append(
            {
                "rank": len(articles) + 1,
                "headline": headline,
                "teaser": teaser,
                "section": section,
                "url": href,
            }
        )

    if not articles:
        raise SystemExit(
            "No articles parsed from SPIEGEL homepage — page structure may have changed."
        )

    return {
        "source": URL,
        "title": "DER SPIEGEL - Startseite",
        "scraped_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "count": len(articles),
        "articles": articles,
    }


def main() -> int:
    data = scrape()
    OUTPUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {data['count']} articles to {OUTPUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
