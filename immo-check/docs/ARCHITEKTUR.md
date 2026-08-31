# Architektur

## Leitgedanke

Es gibt **ein** Datenmodell (`reip/v1`) und **einen** Rechenweg. Objekttypen
unterscheiden sich nicht darin, *wie* gerechnet wird, sondern nur darin,

- welche Felder erfasst werden,
- welche Kennzahlen zählen,
- welche Schwellen als gut gelten,
- welche Risiken geprüft werden.

Ein Grundstück läuft durch dieselbe Projektion wie eine vermietete Wohnung – nur mit
Mieteinnahmen 0 und AfA 0. Das hält den Kern klein und testbar und macht neue
Objekttypen billig.

```
Import-Adapter ─┐
                ├─> kanonisches Profil ──> core (Rechenkern) ──> Kennzahlen
Formular ───────┘                              │                     │
                                               │                     v
                                   Modul (Felder, Regeln, Checks) ──> Ampel + Score
```

## Schichten

| Schicht | Verzeichnis | Regel |
|---|---|---|
| Rechenkern | `src/core/` | kennt weder DOM noch Objekttypen; reine Funktionen |
| Objektmodule | `src/modules/` | deklarativ: Defaults, Felder, KPI-Auswahl, Regeln, Checks |
| Import | `src/import/` | ein Adapter je Quelle, Ergebnis ist immer ein Profil + Report |
| Oberfläche | `src/ui/` | rendert aus Modul-Deklarationen; enthält keine Fachlogik |

Der Zustand ist genau ein Profil-Objekt. Bei jeder Änderung wird alles neu gerechnet –
kein Caching, kein abgeleiteter Zustand, keine Synchronisationsfehler. Bei den
vorkommenden Größenordnungen (≤ 40 Jahre × einige Angebote) ist das ausreichend schnell.

## Ein neues Objektmodul hinzufügen

Beispiel: Mehrfamilienhaus.

1. `src/modules/mfh.js` anlegen:

```js
import * as checks from './checks.js';

export const mfh = {
  id: 'mfh',
  label: 'Mehrfamilienhaus',
  kurz: 'Zinshaus, mehrere Einheiten',
  zeigt: { ertrag: true, eigennutzung: false, weg: false, cashflow: true },

  defaults: { objekt: { typ: 'mfh', wohnflaeche: 420 }, kosten: { instandhaltung_eur_qm_jahr: 14 } },

  gruppen: [{ titel: 'Objekt', felder: [
    { key: 'objekt.wohnflaeche', label: 'Wohnfläche gesamt', typ: 'zahl', einheit: 'm²' },
  ]}],

  kpis: ['kaufpreisfaktor', 'nettomietrendite', 'cf_monat_j1', 'dscr', 'irr_ek'],

  regeln: [
    { id: 'faktor', label: 'Kaufpreisfaktor', kpi: 'kaufpreisfaktor',
      richtung: 'tief', gruen: 20, gelb: 26, einheit: 'x', gewicht: 1.5 },
  ],

  pruefungen: [checks.energieklasse, checks.ekDecktNebenkosten],

  // optional: eigene Kennzahlen
  extraKpis: (profil, proj) => ({
    miete_je_qm: profil.objekt.wohnflaeche
      ? profil.ertrag.kaltmiete_monat / profil.objekt.wohnflaeche : null,
  }),
};
```

2. In `src/modules/registry.js` importieren und in `MODULE` / `MODUL_LISTE` eintragen.
3. Für eigene Kennzahlen einen Eintrag in `src/ui/kpimeta.js` ergänzen (Label + Format).
4. Fertig – Tabs, Formular, Bewertung und Ampel entstehen daraus automatisch.
   Der Test `jedes Modul rechnet durch und bewertet` prüft das neue Modul sofort mit.

## Bausteine im Detail

### Felder (`gruppen`)

```js
{ key: 'kauf.kaufpreis', label: 'Kaufpreis', typ: 'zahl', einheit: '€', schritt: 1000, hinweis: '…' }
```

`typ`: `zahl` | `text` | `auswahl` (mit `optionen`, optional `labels`) | `ja_nein`.
`key` ist der Pfad im Profil – das UI liest und schreibt ausschließlich darüber.

### Regeln (`regeln`)

```js
{ id, label, kpi: 'dscr', richtung: 'hoch' | 'tief', gruen, gelb, einheit, gewicht, hinweis }
```

`richtung: 'hoch'` heißt: mehr ist besser (`≥ gruen` grün, `≥ gelb` gelb, sonst rot).
Fehlt der Wert, ist die Regel *neutral* und fließt nicht in den Score ein.
Score = gewichtete Punkte (grün 2, gelb 1, rot 0) in Prozent des Maximums.

### Prüfungen (`pruefungen`)

Funktionen `({ profil, proj, kpi }) => ({ status, text }) | null | Array`.
Wiederverwendbares steht in `checks.js`; ein Check darf keine Exception werfen –
die Engine fängt sie ab und zeigt sie als Hinweis.

### Nutzungsabhängigkeit (`nutzung.js`)

Bei Eigennutzung greifen Mietkennzahlen ins Leere. `regelnFuer()` entfernt daher
Faktor, Mietrendite, DSCR, Cashflow-Ziel und IRR und ergänzt Kriterien aus dem
Kaufen-vs-Mieten-Vergleich; `kpisFuer()` tauscht die Kachel-Auswahl entsprechend.
Kennzahlen, die ein Modul bereits selbst bewertet (z. B. Beleihung), werden nicht
doppelt ergänzt.

## Import-Adapter

Ein Adapter implementiert:

```js
{
  id, label, beschreibung,
  erkennt: (raw) => 0..1,               // wie sicher passt diese Quelle?
  mappe:   (raw) => ({ patch, gefunden, warnungen, modus })
}
```

- `patch` ist ein Teil-Profil, das über Standard + Modul-Defaults gelegt wird.
- `gefunden` dokumentiert jede Zuordnung (`ziel`, `quelle`, `wert`) für den Report.
- `modus: 'finanzierung'` merged nur in das bestehende Profil, statt es zu ersetzen.

Für Exposé-artige Quellen genügt meist ein Eintrag in der Alias-Tabelle `FELDER`
in `adapters.js` – Verschachtelung, deutsche Zahlformate und Einheiten übernimmt
`parse.js`.

Der Report unterscheidet bewusst zwischen „nicht in den Daten enthalten“ und
„Wert ist 0“: ein Default-Wert im Profil darf keine Vollständigkeit vortäuschen.

## Tests

`tests/run.mjs` läuft mit blankem Node, ohne Installation. Abgedeckt sind
Zahlenparser, Tilgungsplan (inkl. Anschlusszins und Sondertilgung), IRR,
Konsistenz der Projektion, Steuerlogik, Ampel-Schwellen, alle Module und
sämtliche Import-Adapter gegen die Dateien in `samples/`.

Beim Ergänzen eines Moduls oder einer Kennzahl reicht meist ein zusätzlicher Fall –
der generische Modul-Test greift automatisch.
