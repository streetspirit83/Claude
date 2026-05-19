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

## Dieses Repo
- **Aktuelles Projekt:** `Testen.html` — Link-Manager v1.0 (Jamaica-Design)
- **Live-URL:** `https://streetspirit83.github.io/Claude/Testen.html`
- **Feature-Branches:** Prefix `claude/` für von Claude erstellte Branches
