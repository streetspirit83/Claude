/**
 * Feldgruppen, die alle Module teilen: Finanzierung, Steuer, Annahmen.
 * Objektspezifische Felder kommen aus dem jeweiligen Modul.
 */

export const GEMEINSAME_GRUPPEN = [
  {
    titel: 'Finanzierung',
    felder: [
      { key: 'finanzierung.eigenkapital', label: 'Eigenkapital', typ: 'zahl', einheit: '€', schritt: 1000 },
      {
        key: 'finanzierung.anschlusszins_pct',
        label: 'Anschlusszins',
        typ: 'zahl',
        einheit: '%',
        schritt: 0.1,
        hinweis: 'Angenommener Zins nach Ablauf der Zinsbindung – der wichtigste Risikoparameter.',
      },
      {
        key: 'finanzierung.rate_nach_zinsbindung',
        label: 'Rate danach',
        typ: 'auswahl',
        optionen: ['annuitaet_halten', 'tilgung_halten'],
        labels: { annuitaet_halten: 'Rate bleibt gleich', tilgung_halten: 'Tilgung bleibt gleich' },
        hinweis: 'Bleibt die Rate konstant, trifft ein höherer Zins die Tilgung statt den Cashflow.',
      },
    ],
  },
  {
    titel: 'Steuer',
    felder: [
      { key: 'steuer.grenzsteuersatz_pct', label: 'Grenzsteuersatz', typ: 'zahl', einheit: '%', schritt: 1 },
      { key: 'steuer.afa_satz_pct', label: 'AfA-Satz', typ: 'zahl', einheit: '%', schritt: 0.5, hinweis: 'Bestand ab 1925: 2 %, Neubau ab 2023: 3 %.' },
    ],
  },
  {
    titel: 'Annahmen',
    felder: [
      { key: 'annahmen.betrachtungsdauer_jahre', label: 'Betrachtungsdauer', typ: 'zahl', einheit: 'Jahre', schritt: 1 },
      { key: 'annahmen.wertsteigerung_pa_pct', label: 'Wertsteigerung p.a.', typ: 'zahl', einheit: '%', schritt: 0.1 },
      { key: 'annahmen.verkaufskosten_pct', label: 'Verkaufskosten', typ: 'zahl', einheit: '%', schritt: 0.5 },
      {
        key: 'annahmen.alternativrendite_pa_pct',
        label: 'Alternativrendite',
        typ: 'zahl',
        einheit: '%',
        schritt: 0.5,
        hinweis: 'Was das Geld sonst bringen würde – Maßstab für den Vergleich Kaufen/Mieten.',
      },
    ],
  },
];

/** Labels fuer Auswahlfelder, die im Datenmodell technische Werte tragen. */
export const OPTION_LABELS = {
  vermietung: 'Vermietung',
  eigennutzung: 'Eigennutzung',
  keine: 'keine Nutzung',
  neuwertig: 'neuwertig',
  gut: 'gut',
  mittel: 'mittel',
  sanierungsbeduerftig: 'sanierungsbedürftig',
  erschlossen: 'erschlossen',
  teilerschlossen: 'teilerschlossen',
  unerschlossen: 'unerschlossen',
};
