---
name: web-scraper
description: Scrapes web data, extracts structured content, and generates resilient selectors. Use when the user asks to extract data from a URL.
---

# Web Scraping Execution Directives

Your biggest enemy is **context-window bloat**. Pulling raw HTML or running
iterative browser loops floods the session and degrades output quality (broken
selectors, hallucinations, wasted tokens). Treat scraping as engineering, not
vibe-coding: escalate deliberately and filter aggressively.

## 1. Tiered Execution Strategy (the 80/20 ladder)

Do not reach for a heavy browser by default. Climb this ladder and stop at the
lowest tier that works.

- **Tier 1 — `WebFetch` (built-in, static/fast).** Use first for blogs, docs,
  public APIs, RSS, or basic layout checks. It converts HTML to clean Markdown
  (text truncated to ~100KB), which is the most token-efficient option. Always
  try this before anything heavier.
- **Tier 2 — Firecrawl MCP (complex/anti-bot, _optional, not wired yet_).** Use
  when `WebFetch` returns an error, a blank page from JS rendering, or a basic
  Cloudflare wall. It offloads JS rendering, proxy rotation, and Markdown
  cleaning to an external API. **To enable:** add a `firecrawl` server to
  `.mcp.json` (`npx -y firecrawl-mcp`) and provide `FIRECRAWL_API_KEY` via the
  environment — never hardcode it. Until then, skip Tier 2 and go to Tier 3.
- **Tier 3 — Playwright MCP (dynamic/interactive, wired).** Escalate here only
  when the task needs real interaction: clicks, pagination loops, multi-step
  forms, or data behind an authenticated login portal.

## 2. The Golden Rule — never ingest raw HTML

🛑 **Never let raw webpage HTML flow into this session.** Reading thousands of
lines of boilerplate CSS and header markup causes immediate context rot.

When you reach Tier 3, filter **inside the page** before any data returns to the
chat. Use `evaluate` with `querySelector`/`querySelectorAll`, map over the
matched elements, and return **only** a clean JSON array of the fields you need.

Canonical pattern:

> "Navigate to the target URL. Instead of returning the page HTML, use the
> evaluate tool to execute a querySelector targeting `.product-grid`. Map over
> the child elements to pull out ONLY the product title, raw price string, and
> SKU into a clean JSON array. Return only that clean array to this session."

## 3. Structure over layout

- Do **not** target visual presentation selectors (e.g. `.red-button-large`).
- Look for hidden structured data first: check the DOM for
  `<script type="application/ld+json">`. Modern sites rarely change JSON-LD
  schemas because breaking them ruins their Google ranking — so it is the most
  durable target.
- Only fall back to semantic conventions if no JSON-LD exists.

## 4. Generate resilient backup selectors

- If no JSON-LD exists, use standard semantic web conventions (or Parsel-style
  CSS) rather than brittle visual classes.
- Always provide a **primary CSS selector plus at least two fallback targets**,
  prioritizing in this order: `aria-label`, data-attributes (`data-testid`),
  then semantic HTML landmarks (`<article>`, `<nav>`, `<main>`).

## 5. Execution guardrails

- Limit iterative pagination crawls to a **maximum of 5 pages per sequence**.
- If an exact selector match fails **3 consecutive times**, stop the loop,
  output a short slice of the immediate parent container's DOM, and ask the
  human for explicit guidance. Do not keep retrying blindly.

## 6. Offload heavy work to subagents

When you need to write and test a parser script, spawn an isolated subagent so
the trial-and-error code generation stays out of the main session context.
Example: have a subagent analyze a DOM snippet and draft a clean parsing
function under `src/parsers/`.

## 7. Hygiene

- **Never commit** extracted raw data files or `auth-state.json` to Git.
- Always load access keys natively via `process.env` — never inline secrets.
