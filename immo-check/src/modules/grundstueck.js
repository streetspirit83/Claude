/**
 * Modul: Grundstück (unbebaut).
 *
 * Kein Mietertrag – der Wert entsteht aus Bodenwert, Bebaubarkeit und
 * Haltedauer. Rechnet ueber dieselbe Projektion (Mieteinnahmen = 0),
 * bewertet aber komplett andere Kennzahlen.
 */

import { AMPEL } from '../core/scoring.js';
import * as checks from './checks.js';

export const grundstueck = {
  id: 'grundstueck',
  label: 'Grundstück',
  icon: 'land-plot',
  kurz: 'Unbebaut – Bodenwert, Bebaubarkeit, Haltekosten',
  zeigt: { ertrag: false, eigennutzung: false, weg: false, cashflow: true },

  defaults: {
    objekt: {
      typ: 'grundstueck',
      wohnflaeche: 0,
      grundstuecksflaeche: 600,
      bodenrichtwert_eur_qm: 300,
      erschliessung: 'erschlossen',
      grz: 0.4,
      gfz: 0.8,
    },
    kauf: { bodenwert_anteil_pct: 100, makler_pct: 3.57, modernisierung: 0 },
    ertrag: { nutzung: 'keine', kaltmiete_monat: 0, stellplatzmiete_monat: 0, leerstand_pct: 0 },
    kosten: {
      hausgeld_monat: 0,
      nicht_umlagefaehig_monat: 0,
      instandhaltung_eur_qm_jahr: 0,
      grundsteuer_jahr: 250,
      versicherung_jahr: 0,
    },
    steuer: { afa_satz_pct: 0 },
    annahmen: { betrachtungsdauer_jahre: 10, wertsteigerung_pa_pct: 2 },
  },

  gruppen: [
    {
      titel: 'Grundstück',
      felder: [
        { key: 'meta.bezeichnung', label: 'Bezeichnung', typ: 'text' },
        { key: 'objekt.adresse.plz', label: 'PLZ', typ: 'text' },
        { key: 'objekt.adresse.ort', label: 'Ort', typ: 'text' },
        { key: 'objekt.grundstuecksflaeche', label: 'Fläche', typ: 'zahl', einheit: 'm²' },
        { key: 'objekt.bodenrichtwert_eur_qm', label: 'Bodenrichtwert', typ: 'zahl', einheit: '€/m²', hinweis: 'Aus BORIS des jeweiligen Bundeslandes.' },
        {
          key: 'objekt.erschliessung',
          label: 'Erschließung',
          typ: 'auswahl',
          optionen: ['erschlossen', 'teilerschlossen', 'unerschlossen'],
        },
        { key: 'objekt.grz', label: 'GRZ', typ: 'zahl', schritt: 0.05, hinweis: 'Grundflächenzahl – überbaubarer Anteil.' },
        { key: 'objekt.gfz', label: 'GFZ', typ: 'zahl', schritt: 0.1, hinweis: 'Geschossflächenzahl – zulässige Geschossfläche je m² Grundstück.' },
        { key: 'objekt.altlasten_verdacht', label: 'Altlastenverdacht', typ: 'ja_nein' },
        { key: 'objekt.erbbaurecht', label: 'Erbbaurecht', typ: 'ja_nein' },
      ],
    },
    {
      titel: 'Kauf & Nebenkosten',
      felder: [
        { key: 'kauf.kaufpreis', label: 'Kaufpreis', typ: 'zahl', einheit: '€', schritt: 1000 },
        { key: 'kauf.grunderwerbsteuer_pct', label: 'Grunderwerbsteuer', typ: 'zahl', einheit: '%', schritt: 0.1 },
        { key: 'kauf.notar_pct', label: 'Notar & Grundbuch', typ: 'zahl', einheit: '%', schritt: 0.1 },
        { key: 'kauf.makler_pct', label: 'Makler', typ: 'zahl', einheit: '%', schritt: 0.01 },
        { key: 'kauf.erschliessungskosten', label: 'Erschließungskosten', typ: 'zahl', einheit: '€', schritt: 1000, hinweis: 'Straße, Kanal, Strom, Wasser, Telekom – bei unerschlossenen Lagen 15.000–50.000 €.' },
        { key: 'kauf.sonstige_nebenkosten', label: 'Vermessung, Gutachten, Abriss', typ: 'zahl', einheit: '€' },
      ],
    },
    {
      titel: 'Halten & Annahmen',
      felder: [
        { key: 'kosten.grundsteuer_jahr', label: 'Grundsteuer p.a.', typ: 'zahl', einheit: '€' },
        { key: 'kosten.kostensteigerung_pa_pct', label: 'Kostensteigerung p.a.', typ: 'zahl', einheit: '%', schritt: 0.1 },
        { key: 'annahmen.wertsteigerung_pa_pct', label: 'Wertsteigerung p.a.', typ: 'zahl', einheit: '%', schritt: 0.1 },
        { key: 'annahmen.betrachtungsdauer_jahre', label: 'Haltedauer', typ: 'zahl', einheit: 'Jahre', schritt: 1 },
        { key: 'annahmen.verkaufskosten_pct', label: 'Verkaufskosten', typ: 'zahl', einheit: '%', schritt: 0.5 },
      ],
    },
  ],

  kpis: [
    'preis_qm_grund',
    'abweichung_bodenrichtwert_pct',
    'gesamtkosten_baureif',
    'haltekosten_monat',
    'moegliche_geschossflaeche',
    'grundstueckskosten_je_qm_gfl',
    'rate_monat',
    'irr_ek',
    'gewinn_gesamt',
    'restschuld_ende_zinsbindung',
  ],

  extraKpis: (profil, proj) => {
    const flaeche = profil.objekt.grundstuecksflaeche || 0;
    const brw = profil.objekt.bodenrichtwert_eur_qm || 0;
    const preisQm = flaeche ? proj.invest.kaufpreis / flaeche : null;
    const gfl = flaeche * (profil.objekt.gfz || 0); // moegliche Geschossflaeche
    const haltekostenJahr = proj.basis.bewirtschaftung;
    return {
      preis_qm_grund: preisQm,
      bodenwert_gesamt: brw ? brw * flaeche : null,
      abweichung_bodenrichtwert_pct: brw && preisQm ? ((preisQm - brw) / brw) * 100 : null,
      gesamtkosten_baureif: proj.invest.gesamt,
      moegliche_geschossflaeche: gfl || null,
      grundstueckskosten_je_qm_gfl: gfl ? proj.invest.gesamt / gfl : null,
      haltekosten_monat: (haltekostenJahr + (proj.jahre[0]?.zinsen || 0)) / 12,
    };
  },

  regeln: [
    { id: 'brw', label: 'Abweichung vom Bodenrichtwert', kpi: 'abweichung_bodenrichtwert_pct', richtung: 'tief', gruen: 10, gelb: 30, einheit: '%', gewicht: 2 },
    { id: 'gfl', label: 'Grundstückskosten je m² Geschossfläche', kpi: 'grundstueckskosten_je_qm_gfl', richtung: 'tief', gruen: 600, gelb: 1000, einheit: '€/m²', gewicht: 1.5, hinweis: 'Faustregel: Grundstück sollte 20–30 % der Gesamtkosten eines Bauprojekts nicht überschreiten.' },
    { id: 'irr', label: 'Rendite auf EK (IRR)', kpi: 'irr_ek', richtung: 'hoch', gruen: 5, gelb: 2, einheit: '%', gewicht: 1.5 },
    { id: 'halte', label: 'Haltekosten', kpi: 'haltekosten_monat', richtung: 'tief', gruen: 200, gelb: 500, einheit: '€/Mon', gewicht: 1 },
    { id: 'beleihung', label: 'Beleihung Ende Zinsbindung', kpi: 'beleihung_ende_zinsbindung', richtung: 'tief', gruen: 50, gelb: 70, einheit: '%', gewicht: 1, hinweis: 'Banken beleihen unbebaute Grundstücke deutlich zurückhaltender.' },
  ],

  pruefungen: [
    ({ profil }) =>
      profil.objekt.altlasten_verdacht
        ? { status: AMPEL.rot, text: 'Altlastenverdacht: Auskunft aus dem Altlastenkataster einholen. Sanierungskosten können den Bodenwert übersteigen.' }
        : null,
    ({ profil }) =>
      profil.objekt.erschliessung !== 'erschlossen' && !profil.kauf.erschliessungskosten
        ? { status: AMPEL.rot, text: `Grundstück ist ${profil.objekt.erschliessung}, es sind aber keine Erschließungskosten angesetzt.` }
        : null,
    ({ profil }) =>
      !profil.objekt.gfz
        ? { status: AMPEL.gelb, text: 'Ohne GFZ/GRZ lässt sich das Bauvolumen nicht abschätzen – B-Plan oder Bauvoranfrage (§ 34 BauGB) klären.' }
        : null,
    () => ({
      status: AMPEL.neutral,
      text: 'Steuerlich: keine AfA auf Grund und Boden. Ohne Einkünfteerzielung sind Zinsen und Haltekosten nicht absetzbar – der Rechner setzt daher keinen Steuervorteil an.',
    }),
    ({ profil }) =>
      profil.annahmen.betrachtungsdauer_jahre <= 10
        ? { status: AMPEL.gelb, text: 'Verkauf innerhalb von 10 Jahren: Gewinn ist als privates Veräußerungsgeschäft steuerpflichtig (im Ergebnis berücksichtigt).' }
        : null,
    checks.ekDecktNebenkosten,
    checks.unterdeckungNachZinsbindung,
    checks.erbbaurecht,
  ],
};
