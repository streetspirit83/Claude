# Immo-Check

Modulares Werkzeug zur Bewertung von Immobilien-Investments – **Eigentumswohnung**,
**Einfamilienhaus**, **Grundstück** und **Neubau** (Entwurf), jeweils als Kapitalanlage
**oder zur Eigennutzung**. Läuft vollständig im Browser, ohne Build-Schritt und ohne
Abhängigkeiten; Daten bleiben lokal.

Version 0.1 – erste lauffähige Fassung.

## Was es kann

- **Vier Objektmodule** mit eigenen Eingabefeldern, Kennzahlen und Bewertungsregeln
- **Vollständige Rechnung**: Kaufnebenkosten, Annuitätendarlehen (monatsgenau),
  Anschlussfinanzierung, AfA, Steuerwirkung, Cashflow-Projektion, Verkauf inkl.
  Spekulationsfrist
- **Ampel-Bewertung** mit gewichtetem Score und Klartext-Hinweisen zu Risiken
  (Energieklasse, Instandhaltungsansatz, Altlasten, Erbbaurecht, Zinsänderungsrisiko …)
- **Finanzierungsvergleich**: mehrere Bankangebote nebeneinander – Rate, Restschuld
  nach Zinsbindung, Zinskosten, Cashflow, IRR
- **Sensitivität**: Miete, Leerstand, Instandhaltung, Anschlusszins, Wertsteigerung
- **Kaufen oder mieten** bei Eigennutzung: Vermögensvergleich gegen Miete plus
  Anlage der Differenz
- **JSON-Import** von Exposé-Daten und Finanzierungsangeboten mit Zuordnungs-Report
- Export des Profils als JSON, Druck-/PDF-Ansicht

## Loslegen

Da ES-Module verwendet werden, muss die Seite über HTTP ausgeliefert werden
(ein Doppelklick auf `index.html` reicht nicht):

```bash
python3 -m http.server 8000
# http://localhost:8000
```

Tests des Rechenkerns (kein Framework nötig):

```bash
node tests/run.mjs
```

## Import

Im Dialog **JSON importieren** Daten einfügen, Datei ablegen oder ein Beispiel laden.
Der passende Adapter wird automatisch erkannt:

| Adapter | Quelle | Wirkung |
|---|---|---|
| `reip` | Profil, das dieses Tool exportiert hat | ersetzt alles |
| `expose` | Portal-Export, Scraper-Ausgabe, eigene Notizen | Objektdaten, Objekttyp wird erkannt |
| `finanzierung` | Bank-/Vermittlerangebot, auch als Liste | ersetzt nur den Finanzierungsteil |

Zahlen dürfen so aussehen, wie sie in Exposés stehen: `"289.000 €"`, `"78,5 m²"`,
`"3,57 %"`, `{ "value": 289000, "currency": "EUR" }`. Nach dem Import zeigt der Report,
welche Felder übernommen wurden, welche fehlen (dort gelten Standardwerte) und wo etwas
unplausibel wirkt.

Beispieldateien liegen in [`samples/`](samples/).

## Struktur

```
index.html          Oberfläche
styles.css
src/
  core/             Rechenkern – kennt keine Oberfläche
    schema.js       kanonisches Datenmodell "reip/v1"
    finance.js      Investition, Tilgungsplan, IRR
    tax.js          AfA, Steuerwirkung, Spekulationsfrist
    cashflow.js     Jahresprojektion
    kpi.js          Kennzahlen und Sensitivität
    eigennutzung.js Kaufen vs. Mieten
    scoring.js      Ampel-Engine
  modules/          Objekttypen – rein deklarativ
    wohnung.js efh.js grundstueck.js neubau.js
    checks.js       geteilte Plausibilitätsprüfungen
    nutzung.js      Regeln für Vermietung vs. Eigennutzung
    registry.js     hier wird ein neues Modul eingetragen
  import/           Adapter: fremdes JSON -> kanonisches Profil
  ui/               Formular, Ergebnisdarstellung, SVG-Charts
docs/               Architektur und Schema-Referenz
samples/            Beispiel-JSON
tests/run.mjs       Smoke-Tests des Rechenkerns
```

Ein neues Objektmodul ergänzen: siehe [`docs/ARCHITEKTUR.md`](docs/ARCHITEKTUR.md).
Feldreferenz und Adapter-Anleitung: [`docs/SCHEMA.md`](docs/SCHEMA.md).

## Grenzen

Bewusst vereinfacht, damit die Rechnung nachvollziehbar bleibt:

- Steuern über einen **konstanten Grenzsteuersatz**, ohne Soli, Kirchensteuer und
  Progression; keine Verlustverrechnungsbeschränkungen
- keine Umsatzsteuer-, Gewerblichkeits- oder Drei-Objekt-Betrachtung
- **Neubau** ist Entwurfsstand: Bauzeitzinsen, MaBV-Zahlungsplan und Förderdarlehen
  fehlen noch (das Modul weist im Ergebnis darauf hin)
- Wertsteigerung ist eine gesetzte Annahme, keine Prognose

Keine Steuer- oder Anlageberatung. Zahlen immer gegen die Originalunterlagen prüfen.

## Roadmap

- Neubau-Modul vervollständigen (Bauzeitzinsen, Zahlungsplan, KfW, § 7b, degressive AfA)
- Objekte speichern und nebeneinander vergleichen
- Import weiterer Quellen (PDF-Exposé-Text, CSV aus Hausverwaltungen)
- Sanierungs-Szenarien mit Förderung (BEG) im Bestandsmodul
