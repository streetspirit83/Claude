# Projekt-Workflow: GitHub + Pages

## Einmalig pro Repo
1. Repo auf **Public** stellen *(Pages funktioniert sonst nicht kostenlos)*
2. **Settings → Pages → Branch: `main` / `/ (root)` → Save**
3. URL ist dann immer: `https://{username}.github.io/{repo}/{datei}.html`

## Entwicklungs-Workflow
```
Feature-Branch erstellen
→ Claude entwickelt dort
→ Preview via htmlpreview.github.io (ohne merge)
→ Review ok? → Nach main mergen
→ GitHub Pages updated automatisch (1-2 Min.)
```

## Dateistruktur
- Relative Pfade verwenden: `href="styles.css"` ✓
- CSS/JS können separate Files sein — Pages liefert alles
- Kein absoluter lokaler Pfad (`/home/user/...`) ✗

## Preview-URLs
| Zeitpunkt | URL |
|---|---|
| Während Entwicklung (Feature-Branch) | `https://htmlpreview.github.io/?https://github.com/{user}/{repo}/blob/{branch}/{datei}.html` |
| Nach merge auf main | `https://{user}.github.io/{repo}/{datei}.html` |

## Häufige Fehler
| Problem | Ursache | Fix |
|---|---|---|
| 403 auf Pages-URL | Repo ist privat | Repo auf Public stellen |
| Styles laden nicht auf htmlpreview | Externe CSS/JS-Files | Für htmlpreview alles inline halten, für Pages separate Files ok |
| Änderungen nicht sichtbar | CDN-Cache | Kurz warten oder Hard-Refresh (Ctrl+Shift+R) |

## CDN-Versionen pinnen
Lucide Icons immer mit fixer Version einbinden:
```html
<!-- Gut: gepinnte Version -->
<script src="https://unpkg.com/lucide@0.441.0/dist/umd/lucide.min.js"></script>

<!-- Schlecht: @latest kann sich ändern und Preview brechen -->
<script src="https://unpkg.com/lucide@latest"></script>
```

## MCP-Setup (Model Context Protocol)

MCP-Server erweitern Claude um externe Tools. In diesem Repo gibt es zwei Ebenen –
nicht verwechseln:

### Projekt-Server (committed, reproduzierbar) — `.mcp.json`
Im Repo-Root liegt eine versionierte `.mcp.json`, damit alle mit demselben Setup
arbeiten. Aktuell **ein** Server:

| Server | Paket / Version | Zweck |
|---|---|---|
| `playwright` | `@playwright/mcp@0.0.75` (gepinnt) | Tier-3-Scraping: echte Browser-Interaktion (Klicks, Pagination, Logins) |

- **Version pinnen** – wie bei den CDN-Skripten: fixe Version statt `@latest`,
  sonst brechen Läufe unangekündigt (→ siehe „CDN-Versionen pinnen“).
- **Keine Secrets in `.mcp.json`** – etwaige API-Keys immer über Umgebungs-
  variablen (`${VAR}`) reichen, nie hardcoden. `auth-state.json` und Scrape-Daten
  sind bereits über `.gitignore` ausgeschlossen.

### Account-Connectoren (Claude Code on the web — **nicht** im Repo)
In Web-Sessions stehen zusätzlich account-gebundene Connectoren bereit (u.a.
GitHub, Netlify, Gmail, Google Calendar, Figma, Canva). Diese sind kein Teil des
Repos, variieren pro Account/Session und gehören **nicht** in `.mcp.json`.

### Scraping-Eskalation (siehe Skill `web-scraper`)
`WebFetch` (statisch) → **Firecrawl MCP** (JS/Anti-Bot, *Empfehlung, noch nicht
eingebunden*) → **Playwright MCP** (dynamisch, eingebunden). Auf der niedrigsten
funktionierenden Stufe stoppen; nie rohes HTML in die Session laden.

### Offene Empfehlungen (setzen Änderungen voraus — vor Umsetzung freigeben)
- **Playwright-Bump `0.0.75 → 0.0.78`** (aktuelles npm-`latest`, Stand 2026-07):
  nur die Version in `.mcp.json` erhöhen und kurz gegen eine echte Scrape-Seite
  testen. Kein neuer Server, nur ein Versionswechsel eines bestehenden.
- **Firecrawl MCP als Tier 2** (optional): `npx -y firecrawl-mcp` in `.mcp.json`
  eintragen + `FIRECRAWL_API_KEY` via Env. ⚠️ **Setzt einen neuen Server plus
  API-Key voraus** – erst nach ausdrücklicher Freigabe einbinden.

## Dieses Repo
- **Aktuelles Projekt:** `Testen.html` — Link-Manager v1.0 (Jamaica-Design)
- **Live-URL:** `https://streetspirit83.github.io/Claude/Testen.html`
- **Feature-Branches:** Prefix `claude/` für von Claude erstellte Branches
