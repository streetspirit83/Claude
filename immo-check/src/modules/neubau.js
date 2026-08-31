/**
 * Modul: Neubau / Bauvorhaben  –  STATUS: Entwurf (v0.2).
 *
 * Rechnet bereits grob: Grundstück + Baukosten + Baunebenkosten laufen als
 * Gesamtinvestition durch dieselbe Projektion, AfA-Basis ist der Bauanteil.
 *
 * Bewusst noch NICHT abgebildet (siehe `roadmap`) – das UI weist darauf hin,
 * damit niemand die Zahlen für belastbarer haelt, als sie sind.
 */

import { AMPEL } from '../core/scoring.js';
import * as checks from './checks.js';

export const neubau = {
  id: 'neubau',
  label: 'Neubau',
  icon: 'hard-hat',
  kurz: 'Grundstück + Baukosten – Entwurfsstand',
  status: 'entwurf',
  zeigt: { ertrag: true, eigennutzung: true, weg: false, cashflow: true },

  roadmap: [
    'Zahlungsplan nach MaBV und daraus abgeleitete Bauzeitzinsen (heute nur pauschal geschätzt)',
    'Bereitstellungszinsen ab dem 7. Monat und deren Cashflow-Wirkung',
    'KfW-/Landesförderung als zweites Darlehen mit eigener Kondition und tilgungsfreien Jahren',
    'Degressive AfA (5 %) und Sonderabschreibung § 7b EStG als wählbare Varianten',
    'Baukostensteigerung zwischen Vertrag und Fertigstellung als Szenario',
    'Mietbeginn erst ab Fertigstellung (heute: Ertrag ab Jahr 1)',
  ],

  defaults: {
    objekt: { typ: 'neubau', baujahr: new Date().getFullYear() + 2, wohnflaeche: 130, grundstuecksflaeche: 500 },
    kauf: {
      bodenwert_anteil_pct: 100, // Grundstück ist der "Kaufpreis", Bau ist voll abschreibbar
      makler_pct: 3.57,
      baukosten: 420000,
      baunebenkosten_pct: 18,
      bauzeit_monate: 14,
    },
    kosten: { instandhaltung_eur_qm_jahr: 7, nicht_umlagefaehig_monat: 30, hausgeld_monat: 0 },
    steuer: { afa_satz_pct: 3.0 },
    annahmen: { wertsteigerung_pa_pct: 1.5, betrachtungsdauer_jahre: 20 },
  },

  gruppen: [
    {
      titel: 'Grundstück',
      felder: [
        { key: 'meta.bezeichnung', label: 'Bezeichnung', typ: 'text' },
        { key: 'objekt.adresse.plz', label: 'PLZ', typ: 'text' },
        { key: 'objekt.adresse.ort', label: 'Ort', typ: 'text' },
        { key: 'kauf.kaufpreis', label: 'Grundstückspreis', typ: 'zahl', einheit: '€', schritt: 1000 },
        { key: 'objekt.grundstuecksflaeche', label: 'Grundstücksfläche', typ: 'zahl', einheit: 'm²' },
        { key: 'kauf.grunderwerbsteuer_pct', label: 'Grunderwerbsteuer', typ: 'zahl', einheit: '%', schritt: 0.1 },
        { key: 'kauf.notar_pct', label: 'Notar & Grundbuch', typ: 'zahl', einheit: '%', schritt: 0.1 },
        { key: 'kauf.makler_pct', label: 'Makler', typ: 'zahl', einheit: '%', schritt: 0.01 },
        { key: 'kauf.erschliessungskosten', label: 'Erschließung', typ: 'zahl', einheit: '€', schritt: 1000 },
      ],
    },
    {
      titel: 'Bau',
      felder: [
        { key: 'objekt.wohnflaeche', label: 'Wohnfläche', typ: 'zahl', einheit: 'm²' },
        { key: 'kauf.baukosten', label: 'Baukosten (KG 300+400)', typ: 'zahl', einheit: '€', schritt: 5000, hinweis: 'Rohbau + Technik, ohne Nebenkosten.' },
        { key: 'kauf.baunebenkosten_pct', label: 'Baunebenkosten', typ: 'zahl', einheit: '%', hinweis: 'Architekt, Statik, Genehmigung, Versicherung – typ. 15–20 % der Baukosten.' },
        { key: 'kauf.bauzeit_monate', label: 'Bauzeit', typ: 'zahl', einheit: 'Monate', schritt: 1 },
        { key: 'kauf.modernisierung', label: 'Außenanlagen / Sonstiges', typ: 'zahl', einheit: '€', schritt: 1000 },
        { key: 'steuer.afa_satz_pct', label: 'AfA-Satz', typ: 'zahl', einheit: '%', schritt: 0.5, hinweis: 'Neubau ab 2023: 3 % linear.' },
      ],
    },
    {
      titel: 'Ertrag & Kosten',
      felder: [
        { key: 'ertrag.nutzung', label: 'Nutzung', typ: 'auswahl', optionen: ['vermietung', 'eigennutzung'] },
        { key: 'ertrag.kaltmiete_monat', label: 'Kaltmiete nach Fertigstellung', typ: 'zahl', einheit: '€/Mon' },
        { key: 'annahmen.vergleichsmiete_monat', label: 'Vergleichsmiete (Eigennutzung)', typ: 'zahl', einheit: '€/Mon' },
        { key: 'kosten.instandhaltung_eur_qm_jahr', label: 'Instandhaltung', typ: 'zahl', einheit: '€/m²a' },
        { key: 'kosten.grundsteuer_jahr', label: 'Grundsteuer p.a.', typ: 'zahl', einheit: '€' },
        { key: 'kosten.kostensteigerung_pa_pct', label: 'Kostensteigerung p.a.', typ: 'zahl', einheit: '%', schritt: 0.1 },
      ],
    },
  ],

  kpis: [
    'gesamtinvest',
    'baukosten_qm',
    'bauzeitzinsen_grob',
    'kaufpreisfaktor',
    'bruttomietrendite',
    'cf_monat_j1',
    'rate_monat',
    'irr_ek',
    'grundstuecksanteil_pct',
    'gewinn_gesamt',
  ],

  extraKpis: (profil, proj) => {
    const bau = (profil.kauf.baukosten || 0) * (1 + (profil.kauf.baunebenkosten_pct || 0) / 100);
    const zins = proj.angebot?.sollzins_pct || 0;
    const monate = profil.kauf.bauzeit_monate || 0;
    return {
      baukosten_gesamt: bau || null,
      baukosten_qm: profil.objekt.wohnflaeche ? bau / profil.objekt.wohnflaeche : null,
      grundstuecksanteil_pct: proj.invest.gesamt ? ((proj.invest.kaufpreis + proj.invest.nebenkosten) / proj.invest.gesamt) * 100 : null,
      // Naeherung: im Mittel ist die Haelfte der Bausumme ueber die Bauzeit abgerufen
      bauzeitzinsen_grob: (bau * (zins / 100) * (monate / 12)) / 2 || null,
    };
  },

  regeln: [
    { id: 'bauqm', label: 'Baukosten je m²', kpi: 'baukosten_qm', richtung: 'tief', gruen: 3200, gelb: 4200, einheit: '€/m²', gewicht: 1.5 },
    { id: 'grundanteil', label: 'Grundstücksanteil an Gesamtkosten', kpi: 'grundstuecksanteil_pct', richtung: 'tief', gruen: 30, gelb: 45, einheit: '%', gewicht: 1 },
    { id: 'brutto', label: 'Bruttomietrendite', kpi: 'bruttomietrendite', richtung: 'hoch', gruen: 3.5, gelb: 2.5, einheit: '%', gewicht: 1 },
    { id: 'cf', label: 'Cashflow n. St. (Jahr 1)', kpi: 'cf_monat_j1', richtung: 'hoch', gruen: 0, gelb: -300, einheit: '€/Mon', gewicht: 1.5 },
    { id: 'irr', label: 'Rendite auf EK (IRR)', kpi: 'irr_ek', richtung: 'hoch', gruen: 5, gelb: 2, einheit: '%', gewicht: 1.5 },
  ],

  pruefungen: [
    () => ({
      status: AMPEL.gelb,
      text: 'Neubau-Modul ist Entwurfsstand: Bauzeitzinsen, Zahlungsplan und Förderdarlehen sind noch nicht im Cashflow enthalten. Zahlen als Richtwert lesen.',
    }),
    ({ kpi }) =>
      kpi.bauzeitzinsen_grob
        ? { status: AMPEL.neutral, text: `Geschätzte Bauzeitzinsen: rund ${Math.round(kpi.bauzeitzinsen_grob).toLocaleString('de-DE')} € – als Eigenkapitalbedarf zusätzlich einplanen.` }
        : null,
    ({ profil }) =>
      (profil.kauf.baunebenkosten_pct || 0) < 12
        ? { status: AMPEL.gelb, text: 'Baunebenkosten unter 12 % sind selten realistisch (Architekt, Statik, Prüfstatik, Genehmigung, Bauversicherungen).' }
        : null,
    ({ profil }) =>
      !profil.kauf.modernisierung
        ? { status: AMPEL.gelb, text: 'Außenanlagen, Zuwegung, Terrasse und Küche fehlen im Budget – typischerweise 20.000–50.000 €.' }
        : null,
    checks.ekDecktNebenkosten,
    checks.unterdeckungNachZinsbindung,
    checks.zinsbindungKurz,
    checks.eigennutzungHinweis,
  ],
};
