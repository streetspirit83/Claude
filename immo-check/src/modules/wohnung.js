/**
 * Modul: Eigentumswohnung (vermietet oder eigengenutzt).
 *
 * Ein Modul besteht aus:
 *  defaults    - Vorbelegung des kanonischen Profils
 *  gruppen     - Eingabefelder (rein deklarativ, das UI rendert daraus)
 *  kpis        - welche Kennzahlen gezeigt werden (Reihenfolge)
 *  regeln      - Ampel-Schwellen
 *  pruefungen  - freie Plausibilitaets-Checks
 *  extraKpis   - optionale objekttyp-spezifische Kennzahlen
 */

import * as checks from './checks.js';

export const wohnung = {
  id: 'wohnung',
  label: 'Eigentumswohnung',
  icon: 'building-2',
  kurz: 'ETW im Bestand, WEG-Verwaltung, Hausgeld',
  zeigt: { ertrag: true, eigennutzung: true, weg: true, cashflow: true },

  defaults: {
    objekt: { typ: 'wohnung', wohnflaeche: 70, zimmer: 3 },
    kauf: { bodenwert_anteil_pct: 20, makler_pct: 3.57 },
    kosten: { nicht_umlagefaehig_monat: 60, instandhaltung_eur_qm_jahr: 12, hausgeld_monat: 220 },
    steuer: { afa_satz_pct: 2.0 },
  },

  gruppen: [
    {
      titel: 'Objekt',
      felder: [
        { key: 'meta.bezeichnung', label: 'Bezeichnung', typ: 'text' },
        { key: 'objekt.adresse.plz', label: 'PLZ', typ: 'text' },
        { key: 'objekt.adresse.ort', label: 'Ort', typ: 'text' },
        { key: 'objekt.wohnflaeche', label: 'Wohnfläche', typ: 'zahl', einheit: 'm²' },
        { key: 'objekt.zimmer', label: 'Zimmer', typ: 'zahl', schritt: 0.5 },
        { key: 'objekt.baujahr', label: 'Baujahr', typ: 'zahl', schritt: 1 },
        {
          key: 'objekt.zustand',
          label: 'Zustand',
          typ: 'auswahl',
          optionen: ['neuwertig', 'gut', 'mittel', 'sanierungsbeduerftig'],
        },
        {
          key: 'objekt.energie.klasse',
          label: 'Energieklasse',
          typ: 'auswahl',
          optionen: ['A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
        },
        { key: 'objekt.energie.kennwert', label: 'Energiekennwert', typ: 'zahl', einheit: 'kWh/m²a' },
        { key: 'objekt.erbbaurecht', label: 'Erbbaurecht', typ: 'ja_nein' },
        { key: 'objekt.erbbauzins_jahr', label: 'Erbbauzins p.a.', typ: 'zahl', einheit: '€' },
      ],
    },
    {
      titel: 'Kauf & Nebenkosten',
      felder: [
        { key: 'kauf.kaufpreis', label: 'Kaufpreis', typ: 'zahl', einheit: '€', schritt: 1000 },
        { key: 'kauf.grunderwerbsteuer_pct', label: 'Grunderwerbsteuer', typ: 'zahl', einheit: '%', schritt: 0.1 },
        { key: 'kauf.notar_pct', label: 'Notar & Grundbuch', typ: 'zahl', einheit: '%', schritt: 0.1 },
        { key: 'kauf.makler_pct', label: 'Makler', typ: 'zahl', einheit: '%', schritt: 0.01 },
        { key: 'kauf.sonstige_nebenkosten', label: 'Sonstige NK', typ: 'zahl', einheit: '€' },
        { key: 'kauf.modernisierung', label: 'Sofort-Modernisierung', typ: 'zahl', einheit: '€', schritt: 1000 },
        {
          key: 'kauf.bodenwert_anteil_pct',
          label: 'Bodenwertanteil',
          typ: 'zahl',
          einheit: '%',
          hinweis: 'Nicht abschreibbar – mindert die AfA-Basis.',
        },
      ],
    },
    {
      titel: 'Ertrag',
      felder: [
        {
          key: 'ertrag.nutzung',
          label: 'Nutzung',
          typ: 'auswahl',
          optionen: ['vermietung', 'eigennutzung'],
        },
        { key: 'ertrag.kaltmiete_monat', label: 'Kaltmiete', typ: 'zahl', einheit: '€/Mon' },
        { key: 'ertrag.miete_marktueblich_monat', label: 'Marktmiete', typ: 'zahl', einheit: '€/Mon' },
        { key: 'ertrag.stellplatzmiete_monat', label: 'Stellplatz', typ: 'zahl', einheit: '€/Mon' },
        { key: 'ertrag.mietsteigerung_pa_pct', label: 'Mietsteigerung p.a.', typ: 'zahl', einheit: '%', schritt: 0.1 },
        { key: 'ertrag.leerstand_pct', label: 'Leerstandsansatz', typ: 'zahl', einheit: '%', schritt: 0.5 },
        {
          key: 'annahmen.vergleichsmiete_monat',
          label: 'Vergleichsmiete (Eigennutzung)',
          typ: 'zahl',
          einheit: '€/Mon',
          hinweis: 'Was würde ich sonst zur Miete zahlen?',
        },
      ],
    },
    {
      titel: 'Laufende Kosten',
      felder: [
        { key: 'kosten.hausgeld_monat', label: 'Hausgeld gesamt', typ: 'zahl', einheit: '€/Mon' },
        {
          key: 'kosten.nicht_umlagefaehig_monat',
          label: 'davon nicht umlagefähig',
          typ: 'zahl',
          einheit: '€/Mon',
          hinweis: 'Verwaltung + Rücklage – trägt der Eigentümer.',
        },
        {
          key: 'kosten.instandhaltung_eur_qm_jahr',
          label: 'Instandhaltung',
          typ: 'zahl',
          einheit: '€/m²a',
          hinweis: 'Realistisch 10–15 €/m²a bei Bestand.',
        },
        { key: 'kosten.grundsteuer_jahr', label: 'Grundsteuer p.a.', typ: 'zahl', einheit: '€' },
        { key: 'kosten.versicherung_jahr', label: 'Versicherung p.a.', typ: 'zahl', einheit: '€' },
        { key: 'kosten.kostensteigerung_pa_pct', label: 'Kostensteigerung p.a.', typ: 'zahl', einheit: '%', schritt: 0.1 },
      ],
    },
  ],

  kpis: [
    'kaufpreisfaktor',
    'bruttomietrendite',
    'nettomietrendite',
    'cf_monat_j1',
    'rate_monat',
    'dscr',
    'irr_ek',
    'preis_qm',
    'break_even_miete_monat',
    'restschuld_ende_zinsbindung',
    'beleihung_ende_zinsbindung',
    'gewinn_gesamt',
  ],

  regeln: [
    { id: 'faktor', label: 'Kaufpreisfaktor', kpi: 'kaufpreisfaktor', richtung: 'tief', gruen: 25, gelb: 30, einheit: 'x', gewicht: 1.5, hinweis: 'Kaufpreis / Jahreskaltmiete.' },
    { id: 'brutto', label: 'Bruttomietrendite', kpi: 'bruttomietrendite', richtung: 'hoch', gruen: 4, gelb: 3, einheit: '%', gewicht: 1 },
    { id: 'netto', label: 'Nettomietrendite', kpi: 'nettomietrendite', richtung: 'hoch', gruen: 3, gelb: 2, einheit: '%', gewicht: 1.5 },
    { id: 'cf', label: 'Cashflow n. St. (Jahr 1)', kpi: 'cf_monat_j1', richtung: 'hoch', gruen: 0, gelb: -150, einheit: '€/Mon', gewicht: 2 },
    { id: 'dscr', label: 'Kapitaldienstdeckung', kpi: 'dscr', richtung: 'hoch', gruen: 1.25, gelb: 1.0, einheit: 'x', gewicht: 1.5 },
    { id: 'irr', label: 'Rendite auf EK (IRR)', kpi: 'irr_ek', richtung: 'hoch', gruen: 6, gelb: 3, einheit: '%', gewicht: 1.5 },
    { id: 'beleihung', label: 'Beleihung Ende Zinsbindung', kpi: 'beleihung_ende_zinsbindung', richtung: 'tief', gruen: 60, gelb: 80, einheit: '%', gewicht: 1 },
    { id: 'puffer', label: 'Mietpuffer bis Break-even', kpi: 'mietpuffer_pct', richtung: 'hoch', gruen: 15, gelb: 0, einheit: '%', gewicht: 1 },
  ],

  pruefungen: [
    checks.energieklasse,
    checks.instandhaltungRealistisch(8),
    checks.mieteUeberMarkt,
    checks.altbauRisiken,
    checks.ekDecktNebenkosten,
    checks.unterdeckungNachZinsbindung,
    checks.zinsbindungKurz,
    checks.erbbaurecht,
    checks.hausgeldPlausibel,
    checks.eigennutzungHinweis,
  ],
};
