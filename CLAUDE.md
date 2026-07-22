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
In Web-Sessions stehen zusätzlich account-gebundene Connectoren bereit. Aktiv u.a.:
- **GitHub MCP** (`mcp__github__*`) – Repo-Verwaltung, Pull Requests, Issues,
  Branches, GitHub Actions, Code Reviews. **Deckt unseren GitHub-Workflow bereits
  vollständig ab** (kein zusätzlicher Server nötig).
- Netlify, Gmail, Google Calendar, Figma, Canva.

Diese sind kein Teil des Repos, variieren pro Account/Session und gehören **nicht**
in `.mcp.json` (nicht mit den Projekt-Servern verwechseln).

### Scraping-Eskalation (siehe Skill `web-scraper`)
`WebFetch` (statisch) → **Firecrawl MCP** (JS/Anti-Bot, *Empfehlung, noch nicht
eingebunden*) → **Playwright MCP** (dynamisch, eingebunden). Auf der niedrigsten
funktionierenden Stufe stoppen; nie rohes HTML in die Session laden.

## Empfohlene MCP-Erweiterungen

Bewertung gängiger MCP-Server gegen unser Setup (Ist-Stand: **ein** Projekt-Server
`playwright` + Account-Connectoren, darunter live **GitHub MCP**). Grundregel:
**keine Server einbinden, die native Claude-Code-Bordmittel duplizieren**
(Read/Write/Edit/Glob/Grep, Bash inkl. `git`, `WebFetch`) — das bläht nur Startup
und Tool-Kontext, ohne Mehrwert.

| Server | Status | Kurzbewertung |
|---|---|---|
| **GitHub MCP** | ✅ vorhanden | Als Account-Connector aktiv (verifiziert). Nichts zu tun; **nicht** in `.mcp.json` doppeln. |
| **Context7** | ➕ sinnvoll | Versionsaktuelle Framework-/Lib-Doku on demand. |
| **Serena (LSP)** | ➖ begrenzt | Symbol-/Refactoring-Semantik per LSP; Nutzen bei No-Build-HTML/JS ohne Typen gering. |
| Filesystem *(ref)* | ❌ redundant | Native File-Tools vorhanden. |
| Git *(ref)* | ❌ redundant | `git` läuft über Bash. |
| Fetch *(ref)* | ❌ redundant | `WebFetch` + Playwright/Firecrawl decken ab. |
| Memory *(ref)* | ➖ optional | Persistenter Knowledge-Graph; CLAUDE.md erfüllt die Rolle heute. |
| Sequential Thinking *(ref)* | ➖ optional | Strukturiertes Reasoning; moderne Modelle können das nativ. |

### Details zu den empfohlenen Ergänzungen (Vorteil / Voraussetzung / Mehrwert)

- **Context7** (`➕ sinnvoll`)
  - *Vorteil:* zieht versionsaktuelle Doku und Codebeispiele direkt in die Session
    und verhindert veraltete API-Nutzung.
  - *Voraussetzung:* neuer Server `npx -y @upstash/context7-mcp` in `.mcp.json`;
    optionaler API-Key nur für höhere Limits (Free-Tier genügt uns).
  - *Mehrwert:* mittel — v.a. für unsere gepinnten CDN-Libs (Lucide u.a.) und die
    Netlify-Functions-APIs.

- **Serena** (`➖ begrenzt relevant`)
  - *Vorteil:* symbol-genaue Suche, Definitionen/Referenzen und sicheres
    Refactoring über LSP statt Textsuche — stark bei großen Codebasen.
  - *Voraussetzung:* neuer Server (uv/Python), einmalige Projekt-Indexierung;
    profitiert stark von Typinformationen.
  - *Mehrwert:* gering bei den kleinen HTML-Tools hier; potenziell mittel im
    modul-reichen `discovery/ui` (viele ES-Module).

- **Memory / Sequential Thinking** (offizielle Referenzserver, `➖ optional`)
  - *Vorteil:* sessionübergreifendes Gedächtnis bzw. explizite, nachvollziehbare
    Denk-Schritte.
  - *Voraussetzung:* je ein neuer Server in `.mcp.json`.
  - *Mehrwert:* niedrig — CLAUDE.md plus natives Modell-Reasoning decken den Bedarf
    bereits ab.

- **Nicht empfohlen:** Filesystem-, Git- und Fetch-Referenzserver — durchweg
  redundant zu Claude-Code-Bordmitteln.

⚠️ Alle `➕/➖`-Punkte **setzen neue Server voraus** und werden erst nach
ausdrücklicher Freigabe in `.mcp.json` eingetragen.

### Betriebs-Empfehlungen zu bestehenden Servern (setzen Änderungen voraus)
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
