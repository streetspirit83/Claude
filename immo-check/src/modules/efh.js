/**
 * Modul: Einfamilienhaus (Bestand) – Kapitalanlage oder Eigenheim.
 *
 * Unterschiede zur ETW: kein Hausgeld/WEG, hoehere Instandhaltungslast,
 * groesserer Bodenwertanteil (= geringere AfA), Grundstueck relevant,
 * Heizung/GEG als eigenes Risiko.
 */

import { AMPEL } from '../core/scoring.js';
import * as checks from './checks.js';
import { wohnung } from './wohnung.js';

const uebernommen = (titel) => wohnung.gruppen.find((g) => g.titel === titel);

export const efh = {
  id: 'efh',
  label: 'Einfamilienhaus',
  icon: 'home',
  kurz: 'Haus im Bestand, Grundstück inklusive, keine WEG',
  zeigt: { ertrag: true, eigennutzung: true, weg: false, cashflow: true },

  defaults: {
    objekt: { typ: 'efh', wohnflaeche: 140, zimmer: 5, grundstuecksflaeche: 500 },
    kauf: { bodenwert_anteil_pct: 30 },
    kosten: {
      hausgeld_monat: 0,
      nicht_umlagefaehig_monat: 0,
      instandhaltung_eur_qm_jahr: 15,
      grundsteuer_jahr: 600,
      versicherung_jahr: 600,
    },
    ertrag: { nutzung: 'eigennutzung' },
    steuer: { afa_satz_pct: 2.0 },
  },

  gruppen: [
    {
      titel: 'Objekt',
      felder: [
        ...uebernommen('Objekt').felder.filter((f) => f.key !== 'objekt.erbbauzins_jahr'),
        { key: 'objekt.grundstuecksflaeche', label: 'Grundstücksfläche', typ: 'zahl', einheit: 'm²' },
        { key: 'objekt.bodenrichtwert_eur_qm', label: 'Bodenrichtwert', typ: 'zahl', einheit: '€/m²' },
        {
          key: 'objekt.energie.traeger',
          label: 'Heizung',
          typ: 'auswahl',
          optionen: ['Gas', 'Öl', 'Fernwärme', 'Wärmepumpe', 'Pellets', 'Nachtspeicher'],
        },
      ],
    },
    uebernommen('Kauf & Nebenkosten'),
    uebernommen('Ertrag'),
    {
      titel: 'Laufende Kosten',
      felder: uebernommen('Laufende Kosten').felder.filter(
        (f) => !['kosten.hausgeld_monat', 'kosten.nicht_umlagefaehig_monat'].includes(f.key),
      ),
    },
  ],

  kpis: [
    'kaufpreisfaktor',
    'bruttomietrendite',
    'cf_monat_j1',
    'rate_monat',
    'preis_qm',
    'bodenwert_gesamt',
    'gebaeudewert_rechnerisch',
    'irr_ek',
    'restschuld_ende_zinsbindung',
    'beleihung_ende_zinsbindung',
    'gewinn_gesamt',
  ],

  // Bodenwert getrennt ausweisen: beim EFH steckt oft der halbe Kaufpreis im Grundstueck
  extraKpis: (profil, proj) => {
    const bodenwert =
      (profil.objekt.bodenrichtwert_eur_qm || 0) * (profil.objekt.grundstuecksflaeche || 0);
    return {
      bodenwert_gesamt: bodenwert || null,
      bodenwert_anteil_real_pct: bodenwert && proj.invest.kaufpreis ? (bodenwert / proj.invest.kaufpreis) * 100 : null,
      gebaeudewert_rechnerisch: bodenwert ? proj.invest.kaufpreis - bodenwert : null,
      gebaeudewert_qm:
        bodenwert && profil.objekt.wohnflaeche
          ? (proj.invest.kaufpreis - bodenwert) / profil.objekt.wohnflaeche
          : null,
    };
  },

  regeln: [
    { id: 'faktor', label: 'Kaufpreisfaktor', kpi: 'kaufpreisfaktor', richtung: 'tief', gruen: 25, gelb: 32, einheit: 'x', gewicht: 1 },
    { id: 'cf', label: 'Cashflow n. St. (Jahr 1)', kpi: 'cf_monat_j1', richtung: 'hoch', gruen: 0, gelb: -250, einheit: '€/Mon', gewicht: 1.5 },
    { id: 'irr', label: 'Rendite auf EK (IRR)', kpi: 'irr_ek', richtung: 'hoch', gruen: 5, gelb: 2, einheit: '%', gewicht: 1.5 },
    { id: 'beleihung', label: 'Beleihung Ende Zinsbindung', kpi: 'beleihung_ende_zinsbindung', richtung: 'tief', gruen: 60, gelb: 80, einheit: '%', gewicht: 1.5 },
    { id: 'gebqm', label: 'Gebäudewert je m²', kpi: 'gebaeudewert_qm', richtung: 'tief', gruen: 2200, gelb: 3200, einheit: '€/m²', gewicht: 1, hinweis: 'Kaufpreis abzüglich Bodenwert je m² Wohnfläche – Vergleich zu Neubaukosten.' },
  ],

  pruefungen: [
    ({ profil }) =>
      ['Öl', 'Nachtspeicher'].includes(profil.objekt.energie?.traeger) || profil.objekt.baujahr < 1995
        ? { status: AMPEL.gelb, text: 'Heizungstausch nach GEG einplanen (65 %-Regel bei Defekt). Wärmepumpe + Heizkörper/Dämmung: grob 25.000–45.000 €.' }
        : null,
    ({ profil }) =>
      profil.kosten.instandhaltung_eur_qm_jahr < 12
        ? { status: AMPEL.gelb, text: 'Beim EFH trägt der Eigentümer Dach, Fassade, Heizung und Außenanlagen allein – unter 12 €/m²a ist knapp kalkuliert.' }
        : null,
    ({ kpi }) =>
      kpi.bodenwert_anteil_real_pct !== null && kpi.bodenwert_anteil_real_pct > 50
        ? { status: AMPEL.gelb, text: `Rechnerisch stecken ${kpi.bodenwert_anteil_real_pct.toFixed(0)} % des Kaufpreises im Grundstück – die AfA-Basis ist entsprechend klein. Bodenwertanteil im Kaufvertrag sauber aufteilen.` }
        : null,
    checks.energieklasse,
    checks.altbauRisiken,
    checks.ekDecktNebenkosten,
    checks.unterdeckungNachZinsbindung,
    checks.zinsbindungKurz,
    checks.eigennutzungHinweis,
  ],
};
