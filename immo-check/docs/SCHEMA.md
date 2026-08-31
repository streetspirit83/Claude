# Datenmodell `reip/v1`

Real Estate Investment Profile – das kanonische Format, in das alle Importe übersetzt
werden und mit dem der Rechenkern arbeitet. Definiert in `src/core/schema.js`.

Ein exportiertes Profil ist vollständig und kann jederzeit wieder importiert werden
(Adapter `reip`).

## Felder

### `meta`

| Feld | Typ | Bedeutung |
|---|---|---|
| `bezeichnung` | Text | frei wählbarer Name |
| `quelle` | Text | Herkunft der Daten |
| `erfasst_am` | Datum | ISO, `YYYY-MM-DD` |
| `notizen` | Text | – |

### `objekt`

| Feld | Einheit | Bedeutung |
|---|---|---|
| `typ` | – | `wohnung` \| `efh` \| `grundstueck` \| `neubau` |
| `adresse.strasse/plz/ort` | Text | – |
| `baujahr` | Jahr | – |
| `wohnflaeche` | m² | Basis für Instandhaltung und €/m² |
| `grundstuecksflaeche` | m² | EFH, Grundstück, Neubau |
| `zimmer`, `etage` | – | – |
| `zustand` | – | `neuwertig` \| `gut` \| `mittel` \| `sanierungsbeduerftig` |
| `energie.kennwert` | kWh/m²a | – |
| `energie.klasse` | A+ … H | `F`/`G`/`H` lösen einen roten Hinweis aus |
| `energie.traeger` | Text | Öl/Nachtspeicher lösen beim EFH einen Hinweis aus |
| `erbbaurecht` | ja/nein | – |
| `erbbauzins_jahr` | € | fließt in die Bewirtschaftungskosten |
| `bodenrichtwert_eur_qm` | €/m² | Grundstück, EFH |
| `erschliessung` | – | `erschlossen` \| `teilerschlossen` \| `unerschlossen` |
| `grz`, `gfz` | – | Bebaubarkeit; GFZ × Fläche = mögliche Geschossfläche |
| `altlasten_verdacht` | ja/nein | roter Hinweis |

### `kauf`

| Feld | Einheit | Bedeutung |
|---|---|---|
| `kaufpreis` | € | beim Neubau: Grundstückspreis |
| `grunderwerbsteuer_pct` | % | 3,5–6,5 je Bundesland |
| `notar_pct` | % | Notar und Grundbuch, typisch 1,5–2,0 |
| `makler_pct` | % | typisch 3,57 (inkl. USt) |
| `sonstige_nebenkosten` | € | Gutachten, Vermessung, Abriss |
| `modernisierung` | € | sofortiger Investitionsbedarf |
| `erschliessungskosten` | € | Grundstück |
| `baukosten` | € | Neubau, KG 300 + 400 |
| `baunebenkosten_pct` | % | Neubau, KG 700 auf Baukosten |
| `bauzeit_monate` | Monate | Neubau, Basis der Bauzeitzins-Schätzung |
| `bodenwert_anteil_pct` | % | nicht abschreibbarer Anteil; mindert die AfA-Basis |

**Gesamtinvestition** = Kaufpreis + Nebenkosten + Modernisierung
+ Baukosten × (1 + Baunebenkosten) + Erschließung.

### `ertrag`

| Feld | Einheit | Bedeutung |
|---|---|---|
| `nutzung` | – | `vermietung` \| `eigennutzung` \| `keine` (Grundstück) |
| `kaltmiete_monat` | €/Mon | Nettokaltmiete |
| `miete_marktueblich_monat` | €/Mon | Vergleich; über 105 % der Ist-Miete = Hinweis |
| `stellplatzmiete_monat` | €/Mon | – |
| `mietsteigerung_pa_pct` | % | – |
| `leerstand_pct` | % | Abschlag auf die Jahresmiete |

Bei `eigennutzung` und `keine` sind die Mieteinnahmen 0, es gibt keine AfA und keine
Steuerwirkung.

### `kosten` (Bewirtschaftung, jährlich außer wo anders angegeben)

| Feld | Einheit | Bedeutung |
|---|---|---|
| `hausgeld_monat` | €/Mon | nur informativ (WEG gesamt) |
| `nicht_umlagefaehig_monat` | €/Mon | der Anteil, den der Eigentümer trägt |
| `instandhaltung_eur_qm_jahr` | €/m²a | 10–15 im Bestand, ≥ 12 beim EFH |
| `verwaltung_eur_monat` | €/Mon | – |
| `grundsteuer_jahr`, `versicherung_jahr` | € | – |
| `kostensteigerung_pa_pct` | % | – |

**NOI** = Mieteinnahmen − Bewirtschaftungskosten (inkl. Instandhaltung und Erbbauzins).

### `finanzierung`

| Feld | Bedeutung |
|---|---|
| `eigenkapital` | Darlehen = Gesamtinvestition − Eigenkapital |
| `angebote[]` | `{ id, name, sollzins_pct, zinsbindung_jahre, tilgung_pct, sondertilgung_pct_pa, effektivzins_pct, notiz }` |
| `aktives_angebot` | `id` des Angebots, das Cashflow und Kennzahlen bestimmt |
| `anschlusszins_pct` | Annahme nach Ablauf der Zinsbindung |
| `rate_nach_zinsbindung` | `annuitaet_halten` (Rate bleibt) oder `tilgung_halten` (Rate wird neu berechnet) |

Der Tilgungsplan rechnet monatsgenau und nachschüssig; Sondertilgungen werden am
Jahresende verrechnet.

### `steuer`

| Feld | Bedeutung |
|---|---|
| `grenzsteuersatz_pct` | konstanter Näherungssatz |
| `afa_satz_pct` | Bestand 2,0; Neubau ab 2023 3,0; Grundstück 0 |

AfA-Basis = (Kaufpreis + Nebenkosten) × (1 − Bodenwertanteil) + Modernisierung + Bau.

### `annahmen`

| Feld | Bedeutung |
|---|---|
| `betrachtungsdauer_jahre` | Länge der Projektion, Verkauf am Ende |
| `wertsteigerung_pa_pct` | Annahme, keine Prognose |
| `verkaufskosten_pct` | Makler/Notar beim Verkauf |
| `alternativrendite_pa_pct` | Maßstab für Kaufen vs. Mieten |
| `vergleichsmiete_monat` | Miete, die bei Eigennutzung sonst zu zahlen wäre |

## Beispiel (gekürzt)

```json
{
  "schema": "reip/v1",
  "meta": { "bezeichnung": "3-Zimmer-ETW Köln-Nippes" },
  "objekt": { "typ": "wohnung", "wohnflaeche": 78.5, "baujahr": 1972,
              "energie": { "klasse": "E", "kennwert": 148 } },
  "kauf": { "kaufpreis": 289000, "grunderwerbsteuer_pct": 6.5, "notar_pct": 1.5,
            "makler_pct": 3.57, "modernisierung": 15000, "bodenwert_anteil_pct": 20 },
  "ertrag": { "nutzung": "vermietung", "kaltmiete_monat": 845, "leerstand_pct": 2 },
  "kosten": { "nicht_umlagefaehig_monat": 95, "instandhaltung_eur_qm_jahr": 12 },
  "finanzierung": {
    "eigenkapital": 70000,
    "angebote": [{ "id": "a1", "name": "Bank A", "sollzins_pct": 3.6,
                   "zinsbindung_jahre": 10, "tilgung_pct": 2 }],
    "aktives_angebot": "a1", "anschlusszins_pct": 4.5
  },
  "steuer": { "grenzsteuersatz_pct": 42, "afa_satz_pct": 2 },
  "annahmen": { "betrachtungsdauer_jahre": 15, "wertsteigerung_pa_pct": 1.5 }
}
```

## Import: eigene Quelle anbinden

Für flache oder verschachtelte Objektdaten reicht meist eine Ergänzung der
Alias-Tabelle `FELDER` in `src/import/adapters.js`:

```js
{ ziel: 'kosten.hausgeld_monat', typ: 'zahl',
  aliase: ['hausgeld', 'wohngeld', 'serviceCharge', 'mein_feldname'] }
```

Gesucht wird über den **letzten Pfadbestandteil**, normalisiert (klein, ohne Umlaute
und Sonderzeichen) – `gebaeude.baujahr`, `Baujahr` und `BAU_JAHR` treffen denselben Alias.
Container werden mitgeprüft, `{ "price": { "value": 289000 } }` wird also aufgelöst.

Für strukturell andere Quellen einen eigenen Adapter mit `erkennt`/`mappe` ergänzen
(siehe `docs/ARCHITEKTUR.md`).
