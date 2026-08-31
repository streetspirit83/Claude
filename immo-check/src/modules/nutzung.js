/**
 * Nutzungsabhaengige Auswahl von Kennzahlen und Regeln.
 *
 * Bei Eigennutzung gibt es keine Miete: Kaufpreisfaktor, Mietrendite, DSCR und
 * das Cashflow-Ziel waeren dauerhaft rot und wuerden den Score verzerren.
 * Stattdessen zaehlt der Vergleich mit dem Mieten.
 */

const NUR_VERMIETUNG = ['faktor', 'brutto', 'netto', 'cf', 'dscr', 'puffer', 'irr'];

export const EIGENNUTZUNG_REGELN = [
  {
    id: 'vorteil',
    label: 'Vorteil Kaufen ggü. Mieten',
    kpi: 'vorteil_kauf_ende',
    richtung: 'hoch',
    gruen: 0,
    gelb: -25000,
    einheit: '€',
    gewicht: 2,
    hinweis: 'Vermögen am Ende der Betrachtung gegenüber Mieten plus Anlage der Differenz.',
  },
  {
    id: 'breakeven',
    label: 'Kauf lohnt sich ab',
    kpi: 'breakeven_jahr',
    richtung: 'tief',
    gruen: 10,
    gelb: 15,
    einheit: 'Jahre',
    gewicht: 1.5,
    hinweis: 'Ab diesem Jahr liegt das Vermögen beim Kauf vor dem Mieten.',
  },
  {
    id: 'mehrkosten',
    label: 'Wohnkosten ggü. Vergleichsmiete',
    kpi: 'wohnkosten_differenz_monat',
    richtung: 'tief',
    gruen: 0,
    gelb: 400,
    einheit: '€/Mon',
    gewicht: 1,
    hinweis: 'Kapitaldienst und Bewirtschaftung abzüglich der Miete, die sonst fällig wäre.',
  },
  {
    id: 'beleihung_en',
    label: 'Beleihung Ende Zinsbindung',
    kpi: 'beleihung_ende_zinsbindung',
    richtung: 'tief',
    gruen: 60,
    gelb: 80,
    einheit: '%',
    gewicht: 1.5,
  },
];

const EIGENNUTZUNG_KPIS = [
  'wohnkosten_kauf_monat',
  'wohnkosten_miete_monat',
  'wohnkosten_differenz_monat',
  'rate_monat',
  'vorteil_kauf_ende',
  'breakeven_jahr',
  'gesamtinvest',
  'preis_qm',
  'restschuld_ende_zinsbindung',
  'beleihung_ende_zinsbindung',
];

const istEigennutzung = (profil) => profil.ertrag.nutzung === 'eigennutzung';

export function regelnFuer(modulObj, profil) {
  if (!istEigennutzung(profil)) return modulObj.regeln;
  const behalten = modulObj.regeln.filter((r) => !NUR_VERMIETUNG.includes(r.id));
  const vorhanden = new Set(behalten.map((r) => r.kpi));
  // Module bringen teils dieselbe Kennzahl schon mit (z. B. Beleihung) –
  // nicht doppelt bewerten, sonst zaehlt sie im Score zweifach.
  return [...behalten, ...EIGENNUTZUNG_REGELN.filter((r) => !vorhanden.has(r.kpi))];
}

export function kpisFuer(modulObj, profil) {
  if (!istEigennutzung(profil)) return modulObj.kpis;
  // modulspezifische Kennzahlen (z. B. Gebäudewert je m²) hinten anhängen
  const eigen = modulObj.kpis.filter(
    (k) => !['kaufpreisfaktor', 'bruttomietrendite', 'nettomietrendite', 'cf_monat_j1', 'dscr', 'irr_ek', 'break_even_miete_monat', 'gewinn_gesamt'].includes(k),
  );
  return [...new Set([...EIGENNUTZUNG_KPIS, ...eigen])];
}

/** Kennzahlen aus dem Kaufen-vs-Mieten-Vergleich in die KPI-Map heben. */
export function eigennutzungKpis(eigen) {
  if (!eigen) return {};
  return {
    wohnkosten_kauf_monat: eigen.wohnkosten_kauf_monat_j1,
    wohnkosten_miete_monat: eigen.wohnkosten_miete_monat_j1,
    wohnkosten_differenz_monat: eigen.wohnkosten_kauf_monat_j1 - eigen.wohnkosten_miete_monat_j1,
    vorteil_kauf_ende: eigen.vorteil_ende,
    breakeven_jahr: eigen.breakeven_jahr,
    ersparte_miete_rendite: eigen.ersparte_miete_rendite,
  };
}
