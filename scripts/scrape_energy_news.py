#!/usr/bin/env python3
"""Aggregate energy-news headlines from many sources into one harmonized JSON.

Strategy (generic, no per-site parsers):
1. Fetch each source's homepage/section page.
2. Autodiscover its RSS/Atom feed via <link rel="alternate" type="application/
   (rss|atom)+xml"> (a web standard most news sites declare in <head>).
   If not found, probe a few common feed paths (/feed/, /rss.xml, ...).
3. Parse RSS 2.0 / Atom generically (xml.etree, handles both formats).
4. If no feed exists or yields nothing, fall back to a generic HTML heuristic:
   first headings (h1-h3) that wrap/contain a link, plus the following <p> as
   teaser.
5. Harmonize every item to {title, teaser, link, source, published}.
6. Filter to items whose title+teaser match the KEYWORDS regex, tagging each
   with the keywords that matched.
7. Normalize published dates to ISO-8601 UTC, dedupe across sources
   (canonical link + title), and sort newest first.

Bot-protected sources (403/429/503 on plain requests) are retried with
curl_cffi browser impersonation; some additionally have a known feed URL
pinned in SOURCES since their homepages block all non-browser clients.

Each source is best-effort and isolated — a failing/blocked/paywalled source
just yields zero items with a recorded status, it never aborts the run.
"""
from __future__ import annotations

import json
import re
import sys
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

import requests
from bs4 import BeautifulSoup

try:  # Anti-bot fallback: impersonates a real Chrome TLS fingerprint.
    from curl_cffi import requests as curl_requests
except ImportError:
    curl_requests = None

OUTPUT = Path(__file__).resolve().parent.parent / "energy_news.json"
TIMEOUT = 10
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"
    )
}

# (name, homepage, pinned feed URL or None). A pinned feed is tried first —
# needed for sites whose homepage blocks non-browser clients but whose feed
# endpoint is open.
SOURCES = [
    ("energate-messenger", "https://www.energate-messenger.de", None),
    ("energate", "https://www.energate.de", None),
    ("tagesspiegel-background-energie", "https://background.tagesspiegel.de/energie-und-klima", None),
    ("tagesspiegel-energie", "https://www.tagesspiegel.de/themen/energie-und-klima", None),
    ("euractiv-energie", "https://www.euractiv.de/sections/energie-umwelt", "https://www.euractiv.de/sections/energie-umwelt/feed/"),
    ("cleanenergywire", "https://www.cleanenergywire.org", None),
    ("pv-magazine-de", "https://www.pv-magazine.de", None),
    ("euwid-energie", "https://www.euwid-energie.de", None),
    ("energiezukunft", "https://www.energiezukunft.eu", None),
    ("erneuerbareenergien", "https://www.erneuerbareenergien.de", None),
    ("bdew-news", "https://www.bdew.de/news", None),
    ("dena-newsroom", "https://www.dena.de/newsroom", None),
    ("agora-energiewende-news", "https://www.agora-energiewende.de/news", None),
    ("energynews-pro", "https://www.energynews.pro", None),
    ("montelnews", "https://www.montelnews.com", None),
    ("rechargenews", "https://www.rechargenews.com", None),
    ("offshore-energy", "https://www.offshore-energy.biz", None),
    ("windpowermonthly", "https://www.windpowermonthly.com", "https://www.windpowermonthly.com/rss"),
    ("energymonitor", "https://www.energymonitor.ai", None),
    ("euronews-green", "https://www.euronews.com/green", None),
    ("politico-energy-climate", "https://www.politico.eu/energy-climate", "https://www.politico.eu/section/energy/feed/"),
    ("ft-energy", "https://www.ft.com/energy", "https://www.ft.com/energy?format=rss"),
    ("reuters-energy", "https://www.reuters.com/business/energy", None),
    ("spglobal-electric-power", "https://www.spglobal.com/commodityinsights/en", "https://www.spglobal.com/commodityinsights/en/rss-feed/electric-power"),
    ("spglobal-energy-transition", "https://www.spglobal.com/commodityinsights/en", "https://www.spglobal.com/commodityinsights/en/rss-feed/energy-transition"),
    ("iea-news", "https://www.iea.org/news", None),
    ("canarymedia", "https://www.canarymedia.com", None),
    ("power-technology", "https://www.power-technology.com", "https://www.power-technology.com/feed/"),
    ("energylivenews", "https://www.energylivenews.com", None),
    ("energy-storage-news", "https://www.energy-storage.news", None),
    ("smart-energy", "https://www.smart-energy.com", None),
]

# Energy-transition / debate topics, German + English. Edit freely — items
# are kept only if title+teaser match at least one of these (case-insensitive).
KEYWORDS = [
    r"energiewende", r"atomkraft", r"atomausstieg", r"nuclear",
    r"kohleausstieg", r"coal phase[- ]?out", r"coal power",
    r"wasserstoff", r"hydrogen",
    r"strompreis", r"electricity price", r"power price",
    r"gaspreis", r"gas price", r"\bLNG\b",
    r"erneuerbare", r"renewable", r"windkraft", r"wind (power|farm|energy)",
    r"photovoltaik", r"\bsolar\b", r"\bpv\b",
    r"co2[- ]?preis", r"carbon price", r"emissions trading", r"\bETS\b",
    r"klimaschutz", r"climate (policy|law|target)",
    r"energiekrise", r"energy crisis", r"energiesicherheit", r"energy security",
    r"netzentgelt", r"grid fee", r"stromnetz", r"power grid",
    r"speicher", r"battery storage", r"energy storage",
    r"w[äa]rmepumpe", r"heat pump",
    r"subvention", r"f[öo]rderung", r"subsid",
    r"sanktion", r"sanction",
    r"\bEEG\b", r"klimaneutral", r"net.?zero",
    r"\bCO2\b", r"klima", r"\bclimate\b", r"emission", r"decarbon",
]
KEYWORD_RE = re.compile("|".join(KEYWORDS), re.IGNORECASE)

LINK_TAG_RE = re.compile(r"<link\b[^>]*>", re.IGNORECASE)
ATTR_RE = re.compile(r'(\w[\w:-]*)\s*=\s*["\']([^"\']*)["\']')
COMMON_FEED_PATHS = ["/feed/", "/rss.xml", "/feed", "/rss/"]
ATOM_NS = "{http://www.w3.org/2005/Atom}"
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")


# Status codes that typically mean "bot detected", worth retrying with
# browser impersonation rather than giving up.
BLOCKED_STATUS = {401, 403, 406, 429, 503}


def fetch(url: str):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
        resp.raise_for_status()
        return resp
    except requests.exceptions.HTTPError as exc:
        status = exc.response.status_code if exc.response is not None else None
        if curl_requests is None or status not in BLOCKED_STATUS:
            raise
        resp = curl_requests.get(url, impersonate="chrome", timeout=TIMEOUT)
        if resp.status_code >= 400:
            raise
        return resp


def normalize_date(raw: str | None) -> str | None:
    """RFC-822 (RSS) or ISO-8601 (Atom) → ISO-8601 UTC, else None."""
    if not raw:
        return None
    raw = raw.strip()
    dt = None
    try:
        dt = parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        try:
            dt = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError:
            return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat(timespec="seconds")


def canonical_link(link: str) -> str:
    """Strip fragment and tracking params so the same article dedupes."""
    parts = urlsplit(link)
    query = [
        (k, v)
        for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if not k.lower().startswith("utm_") and k.lower() not in {"fbclid", "gclid", "ref", "cmpid"}
    ]
    return urlunsplit((parts.scheme, parts.netloc.lower(), parts.path.rstrip("/"), urlencode(query), ""))


def find_feed_url(html: str, base_url: str) -> str | None:
    for tag in LINK_TAG_RE.findall(html):
        attrs = dict((k.lower(), v) for k, v in ATTR_RE.findall(tag))
        feed_type = attrs.get("type", "")
        href = attrs.get("href")
        if href and ("rss+xml" in feed_type or "atom+xml" in feed_type):
            return urljoin(base_url, href)
    return None


def clean_text(text: str | None, limit: int = 240) -> str | None:
    if not text:
        return None
    text = WS_RE.sub(" ", TAG_RE.sub(" ", text)).strip()
    if not text:
        return None
    return text if len(text) <= limit else text[:limit].rsplit(" ", 1)[0] + "…"


def parse_feed(xml_bytes: bytes) -> list[dict]:
    import xml.etree.ElementTree as ET

    root = ET.fromstring(xml_bytes)
    items = []

    for item in root.findall(".//item"):
        items.append(
            {
                "title": clean_text(item.findtext("title"), limit=300),
                "teaser": clean_text(item.findtext("description")),
                "link": (item.findtext("link") or "").strip() or None,
                "published": (item.findtext("pubDate") or "").strip() or None,
            }
        )

    for entry in root.findall(f".//{ATOM_NS}entry"):
        link_el = entry.find(f"{ATOM_NS}link[@rel='alternate']")
        if link_el is None:
            link_el = entry.find(f"{ATOM_NS}link")
        items.append(
            {
                "title": clean_text(entry.findtext(f"{ATOM_NS}title"), limit=300),
                "teaser": clean_text(
                    entry.findtext(f"{ATOM_NS}summary") or entry.findtext(f"{ATOM_NS}content")
                ),
                "link": link_el.get("href") if link_el is not None else None,
                "published": (
                    entry.findtext(f"{ATOM_NS}published") or entry.findtext(f"{ATOM_NS}updated") or ""
                ).strip()
                or None,
            }
        )

    return [it for it in items if it["title"] and it["link"]]


def html_fallback(html: str, base_url: str, limit: int = 15) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    items = []
    seen = set()
    for heading in soup.find_all(["h1", "h2", "h3"]):
        link = heading.find("a", href=True) or heading.find_parent("a", href=True)
        if link is None:
            continue
        href = urljoin(base_url, link["href"])
        title = clean_text(heading.get_text(" ", strip=True), limit=300)
        if not title or len(title) < 8 or href in seen:
            continue
        seen.add(href)
        teaser_el = heading.find_next("p")
        items.append(
            {
                "title": title,
                "teaser": clean_text(teaser_el.get_text(" ", strip=True)) if teaser_el else None,
                "link": href,
                "published": None,
            }
        )
        if len(items) >= limit:
            break
    return items


def try_feed(candidate: str) -> list[dict]:
    resp = fetch(candidate)
    return parse_feed(resp.content)


def scrape_source(url: str, pinned_feed: str | None = None) -> dict:
    # A pinned feed works even when the homepage blocks non-browser clients.
    if pinned_feed:
        try:
            items = try_feed(pinned_feed)
            if items:
                return {"status": "ok", "method": "feed", "feed_url": pinned_feed, "items": items}
        except Exception:
            pass

    try:
        home = fetch(url)
    except requests.exceptions.HTTPError as exc:
        # Some sources' /news, /newsroom etc. subpages 404 — retry the bare
        # domain root, which usually still surfaces recent headlines.
        if exc.response is not None and exc.response.status_code == 404:
            from urllib.parse import urlparse

            root = urlparse(url)
            root_url = f"{root.scheme}://{root.netloc}/"
            if root_url != url:
                try:
                    home = fetch(root_url)
                    url = root_url
                except Exception as exc2:
                    return {"status": "error", "method": None, "items": [], "error": str(exc2)}
            else:
                return {"status": "error", "method": None, "items": [], "error": str(exc)}
        else:
            return {"status": "error", "method": None, "items": [], "error": str(exc)}
    except Exception as exc:
        return {"status": "error", "method": None, "items": [], "error": str(exc)}

    feed_url = find_feed_url(home.text, url)
    candidates = [feed_url] if feed_url else []
    candidates += [urljoin(url, p) for p in COMMON_FEED_PATHS]

    for candidate in candidates:
        if not candidate:
            continue
        try:
            items = try_feed(candidate)
        except Exception:
            continue
        if items:
            return {"status": "ok", "method": "feed", "feed_url": candidate, "items": items}

    items = html_fallback(home.text, url)
    if items:
        return {"status": "ok", "method": "html", "items": items}
    return {"status": "empty", "method": None, "items": []}


def main() -> int:
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    sources_meta = []
    articles = []

    seen_links: set[str] = set()
    seen_titles: set[str] = set()

    for name, url, pinned_feed in SOURCES:
        result = scrape_source(url, pinned_feed)
        kept = 0
        for item in result["items"]:
            haystack = f"{item['title']} {item.get('teaser') or ''}"
            matches = sorted({m.group(0).lower() for m in KEYWORD_RE.finditer(haystack)})
            if not matches:
                continue
            link_key = canonical_link(item["link"])
            title_key = WS_RE.sub(" ", item["title"]).strip().lower()
            if link_key in seen_links or title_key in seen_titles:
                continue
            seen_links.add(link_key)
            seen_titles.add(title_key)
            kept += 1
            articles.append(
                {
                    "title": item["title"],
                    "teaser": item.get("teaser"),
                    "link": item["link"],
                    "source": name,
                    "published": normalize_date(item.get("published")),
                    "matched_keywords": matches,
                }
            )
        sources_meta.append(
            {
                "name": name,
                "url": url,
                "status": result["status"],
                "method": result.get("method"),
                "feed_url": result.get("feed_url"),
                "error": result.get("error"),
                "items_found": len(result["items"]),
                "items_matched": kept,
            }
        )
        print(
            f"{name}: {result['status']}"
            + (f"/{result['method']}" if result.get("method") else "")
            + f" — {len(result['items'])} found, {kept} matched"
        )

    # Newest first; undated items sink to the bottom.
    articles.sort(key=lambda a: a["published"] or "", reverse=True)

    data = {
        "generated_at": now,
        "keyword_filter": KEYWORDS,
        "sources": sources_meta,
        "count": len(articles),
        "articles": articles,
    }
    OUTPUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"\nWrote {len(articles)} matched articles to {OUTPUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
