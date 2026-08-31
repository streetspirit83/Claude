/**
 * Darstellung der Kennzahlen: Label, Format, Erklaerung.
 * Rein fuer die Anzeige - der Rechenkern kennt keine Labels.
 */

import { eur, pct, zahl, qm } from '../core/format.js';

const F = {
  eur: (v) => eur(v),
  eur2: (v) => eur(v, 2),
  eurMonat: (v) => (v === null || v === undefined ? '–' : `${eur(v)}/Mon`),
  eurQm: (v) => (v === null || v === undefined ? '–' : `${eur(v)}/m²`),
  pct: (v) => pct(v),
  faktor: (v) => (v === null || v === undefined ? '–' : `${zahl(v, 1)}×`),
  qm: (v) => qm(v),
  jahr: (v) => (v === null || v === undefined ? '–' : `Jahr ${zahl(v, 0)}`),
};

export const KPI_META = {
  gesamtinvest: { label: 'Gesamtinvestition', fmt: F.eur, hinweis: 'Kaufpreis + Nebenkosten + Modernisierung/Bau.' },
  nebenkosten_pct: { label: 'Kaufnebenkosten', fmt: F.pct, hinweis: 'Anteil am Kaufpreis – verbrennt sofort Eigenkapital.' },
  darlehen: { label: 'Darlehen', fmt: F.eur },
  eigenkapital: { label: 'Eigenkapital', fmt: F.eur },
  eigenkapitalquote: { label: 'Eigenkapitalquote', fmt: F.pct },
  preis_qm: { label: 'Preis je m² Wohnfläche', fmt: F.eurQm },
  preis_qm_grund: { label: 'Preis je m² Grundstück', fmt: F.eurQm },
  kaufpreisfaktor: { label: 'Kaufpreisfaktor', fmt: F.faktor, hinweis: 'Kaufpreis / Jahreskaltmiete. Kehrwert der Bruttorendite.' },
  bruttomietrendite: { label: 'Bruttomietrendite', fmt: F.pct, hinweis: 'Jahreskaltmiete / Kaufpreis – ohne Kosten.' },
  nettomietrendite: { label: 'Nettomietrendite', fmt: F.pct, hinweis: 'NOI / Gesamtinvestition – nach Bewirtschaftung, vor Finanzierung.' },
  rate_monat: { label: 'Kreditrate', fmt: F.eurMonat },
  cf_monat_j1: { label: 'Cashflow n. St. (Jahr 1)', fmt: F.eurMonat, hinweis: 'Was pro Monat übrig bleibt bzw. zugeschossen werden muss.' },
  cf_vor_steuer_j1: { label: 'Cashflow v. St. (Jahr 1)', fmt: F.eurMonat },
  steuer_j1: { label: 'Steuerwirkung (Jahr 1)', fmt: F.eur, hinweis: 'Negativ = Erstattung durch Verlustverrechnung.' },
  cash_on_cash: { label: 'Cash-on-Cash-Rendite', fmt: F.pct, hinweis: 'Cashflow Jahr 1 / eingesetztes Eigenkapital.' },
  dscr: { label: 'Kapitaldienstdeckung', fmt: F.faktor, hinweis: 'NOI / Kapitaldienst. Unter 1,0 trägt sich das Objekt nicht selbst.' },
  break_even_miete_monat: { label: 'Break-even-Miete', fmt: F.eurMonat, hinweis: 'Miete, ab der der Cashflow null ist.' },
  mietpuffer_pct: { label: 'Mietpuffer', fmt: F.pct, hinweis: 'Wie weit die Miete bis zum Break-even fallen darf.' },
  restschuld_ende_zinsbindung: { label: 'Restschuld Ende Zinsbindung', fmt: F.eur },
  beleihung_ende_zinsbindung: { label: 'Beleihung Ende Zinsbindung', fmt: F.pct, hinweis: 'Restschuld / Objektwert – bestimmt die Anschlusskondition.' },
  zins_gesamt: { label: 'Zinsen gesamt', fmt: F.eur },
  cf_summe: { label: 'Summe Cashflows', fmt: F.eur },
  nettoerloes_verkauf: { label: 'Nettoerlös Verkauf', fmt: F.eur, hinweis: 'Nach Verkaufskosten, Restschuld und ggf. Spekulationssteuer.' },
  vermoegen_ende: { label: 'Vermögen am Ende', fmt: F.eur },
  gewinn_gesamt: { label: 'Gewinn über Laufzeit', fmt: F.eur, hinweis: 'Endvermögen abzüglich eingesetztem Eigenkapital.' },
  irr_ek: { label: 'Rendite auf EK (IRR)', fmt: F.pct, hinweis: 'Interner Zinsfuß inkl. Verkauf – die Vergleichszahl zu anderen Anlagen.' },
  volltilgung_jahr: { label: 'Volltilgung', fmt: F.jahr },

  // Eigennutzung
  wohnkosten_kauf_monat: { label: 'Wohnkosten bei Kauf', fmt: F.eurMonat, hinweis: 'Kapitaldienst plus Bewirtschaftung – die tatsächliche monatliche Belastung.' },
  wohnkosten_miete_monat: { label: 'Vergleichsmiete', fmt: F.eurMonat },
  wohnkosten_differenz_monat: { label: 'Mehrkosten ggü. Miete', fmt: F.eurMonat, hinweis: 'Negativ = Kaufen ist monatlich günstiger als Mieten.' },
  vorteil_kauf_ende: { label: 'Vermögensvorteil Kauf', fmt: F.eur, hinweis: 'Gegenüber Mieten und Anlage der Differenz, am Ende der Betrachtung.' },
  breakeven_jahr: { label: 'Kauf lohnt sich ab', fmt: (v) => (v ? `Jahr ${v}` : 'nicht im Zeitraum') },
  ersparte_miete_rendite: { label: 'Rendite der ersparten Miete', fmt: F.pct },

  // EFH
  bodenwert_gesamt: { label: 'Bodenwert (BRW × Fläche)', fmt: F.eur },
  bodenwert_anteil_real_pct: { label: 'Bodenwertanteil rechnerisch', fmt: F.pct },
  gebaeudewert_rechnerisch: { label: 'Gebäudewert rechnerisch', fmt: F.eur, hinweis: 'Kaufpreis abzüglich Bodenwert.' },
  gebaeudewert_qm: { label: 'Gebäudewert je m²', fmt: F.eurQm, hinweis: 'Vergleich zu heutigen Neubaukosten.' },

  // Grundstück
  abweichung_bodenrichtwert_pct: { label: 'Abweichung Bodenrichtwert', fmt: F.pct, hinweis: 'Kaufpreis je m² gegenüber BORIS-Bodenrichtwert.' },
  gesamtkosten_baureif: { label: 'Kosten bis baureif', fmt: F.eur, hinweis: 'Inkl. Nebenkosten und Erschließung.' },
  moegliche_geschossflaeche: { label: 'Mögliche Geschossfläche', fmt: F.qm, hinweis: 'Fläche × GFZ.' },
  grundstueckskosten_je_qm_gfl: { label: 'Grundstückskosten je m² GFL', fmt: F.eurQm },
  haltekosten_monat: { label: 'Haltekosten', fmt: F.eurMonat, hinweis: 'Grundsteuer und Zinsen – ohne Ertrag zu tragen.' },

  // Neubau
  baukosten_gesamt: { label: 'Baukosten inkl. NK', fmt: F.eur },
  baukosten_qm: { label: 'Baukosten je m²', fmt: F.eurQm },
  grundstuecksanteil_pct: { label: 'Grundstücksanteil', fmt: F.pct },
  bauzeitzinsen_grob: { label: 'Bauzeitzinsen (Schätzung)', fmt: F.eur, hinweis: 'Näherung – noch nicht im Cashflow enthalten.' },
};

export function kpiLabel(key) {
  return KPI_META[key]?.label || key;
}

export function kpiWert(key, wert) {
  const meta = KPI_META[key];
  if (!meta) return wert === null || wert === undefined ? '–' : String(wert);
  return meta.fmt(wert);
}
