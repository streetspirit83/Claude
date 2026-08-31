/**
 * Kennzahlen. Jede KPI ist ein eigenstaendiger Eintrag mit Wert, Einheit und
 * Kurzbeschreibung - die Module waehlen ueber `kpis: [...]` nur aus, welche
 * davon sie zeigen und bewerten.
 */

import { irr } from './finance.js';
import { projektion } from './cashflow.js';
import { kaufenVsMieten } from './eigennutzung.js';

export function kennzahlen(profil, proj = null) {
  const p = proj || projektion(profil);
  const j1 = p.jahre[0] || {};
  const inv = p.invest;
  const ek = p.finanzierung.eigenkapital;
  const flaeche = profil.objekt.wohnflaeche || 0;
  const grundFl = profil.objekt.grundstuecksflaeche || 0;
  const jahresmiete = p.basis.miete_brutto;

  // IRR auf das eingesetzte Eigenkapital inkl. Verkauf am Ende
  const cfs = [-ek, ...p.jahre.map((x) => x.cf_nach_steuer)];
  cfs[cfs.length - 1] += p.verkauf.nettoerloes;
  const irrEk = ek > 0 ? irr(cfs) : null;

  const kapitaldienstJ1 = j1.kapitaldienst || 0;
  const leerstandFaktor = 1 - (profil.ertrag.leerstand_pct || 0) / 100;
  const breakEven =
    leerstandFaktor > 0 ? (p.basis.bewirtschaftung + kapitaldienstJ1) / 12 / leerstandFaktor : null;

  const summeCf = p.jahre.reduce((s, x) => s + x.cf_nach_steuer, 0);
  const endvermoegen = p.verkauf.nettoerloes;

  return {
    gesamtinvest: inv.gesamt,
    nebenkosten_pct: inv.nebenkosten_pct,
    darlehen: p.finanzierung.darlehen,
    eigenkapital: ek,
    eigenkapitalquote: inv.gesamt ? (ek / inv.gesamt) * 100 : 0,
    preis_qm: flaeche ? inv.kaufpreis / flaeche : null,
    preis_qm_grund: grundFl ? inv.kaufpreis / grundFl : null,
    kaufpreisfaktor: jahresmiete ? inv.kaufpreis / jahresmiete : null,
    bruttomietrendite: jahresmiete && inv.kaufpreis ? (jahresmiete / inv.kaufpreis) * 100 : null,
    nettomietrendite: inv.gesamt ? (p.basis.noi / inv.gesamt) * 100 : null,
    rate_monat: p.plan.rate_monat_start,
    cf_monat_j1: j1.cf_monat ?? null,
    cf_vor_steuer_j1: j1.cf_vor_steuer ?? null,
    steuer_j1: j1.steuer ?? null,
    cash_on_cash: ek > 0 ? ((j1.cf_nach_steuer || 0) / ek) * 100 : null,
    dscr: kapitaldienstJ1 > 0 ? p.basis.noi / kapitaldienstJ1 : null,
    break_even_miete_monat: breakEven,
    mietpuffer_pct:
      breakEven && profil.ertrag.kaltmiete_monat
        ? ((profil.ertrag.kaltmiete_monat - breakEven) / profil.ertrag.kaltmiete_monat) * 100
        : null,
    restschuld_ende_zinsbindung: p.plan.restschuld_ende_zinsbindung,
    beleihung_ende_zinsbindung: (() => {
      const jahrZb = Math.min(p.angebot?.zinsbindung_jahre ?? 10, p.jahre.length);
      const wert = p.jahre[jahrZb - 1]?.wert ?? inv.kaufpreis;
      return wert ? (p.plan.restschuld_ende_zinsbindung / wert) * 100 : null;
    })(),
    zins_gesamt: p.plan.zins_gesamt,
    cf_summe: summeCf,
    nettoerloes_verkauf: endvermoegen,
    vermoegen_ende: summeCf + endvermoegen,
    gewinn_gesamt: summeCf + endvermoegen - ek,
    irr_ek: irrEk !== null ? irrEk * 100 : null,
    volltilgung_jahr: p.plan.volltilgung_jahr,
    unterdeckung_nach_zinsbindung: p.plan.unterdeckung,
  };
}

const ZINS_HOCH = {
  label: 'Anschlusszins +2 pp',
  patch: (x) => ((x.finanzierung.anschlusszins_pct += 2), x),
};
const ZINS_HOCH_RATE = {
  // Rate wird neu berechnet, damit die Tilgung erhalten bleibt: erst dann
  // zeigt sich das Zinsrisiko im Cashflow statt nur in der Restschuld.
  label: 'Anschlusszins +2 pp, Rate angepasst',
  patch: (x) => (
    (x.finanzierung.anschlusszins_pct += 2), (x.finanzierung.rate_nach_zinsbindung = 'tilgung_halten'), x
  ),
};
const KEINE_WERTSTEIGERUNG = {
  label: 'Wertsteigerung 0 %',
  patch: (x) => ((x.annahmen.wertsteigerung_pa_pct = 0), x),
};
const TEURE_INSTANDHALTUNG = {
  label: 'Instandhaltung ×1,5',
  patch: (x) => ((x.kosten.instandhaltung_eur_qm_jahr *= 1.5), x),
};

const FAELLE_VERMIETUNG = [
  { label: 'Basis', patch: (x) => x },
  { label: 'Miete -10 %', patch: (x) => ((x.ertrag.kaltmiete_monat *= 0.9), x) },
  { label: 'Leerstand 8 %', patch: (x) => ((x.ertrag.leerstand_pct = 8), x) },
  TEURE_INSTANDHALTUNG,
  ZINS_HOCH,
  ZINS_HOCH_RATE,
  KEINE_WERTSTEIGERUNG,
];

/** Bei Eigennutzung entscheiden andere Groessen als Miete und Leerstand. */
const FAELLE_EIGENNUTZUNG = [
  { label: 'Basis', patch: (x) => x },
  { label: 'Vergleichsmiete -10 %', patch: (x) => ((x.annahmen.vergleichsmiete_monat *= 0.9), x) },
  { label: 'Alternativrendite 7 %', patch: (x) => ((x.annahmen.alternativrendite_pa_pct = 7), x) },
  TEURE_INSTANDHALTUNG,
  ZINS_HOCH_RATE,
  KEINE_WERTSTEIGERUNG,
];

/**
 * Sensitivitaet: wie reagieren Cashflow, Rendite und Endvermoegen auf
 * die kritischen Annahmen?
 */
export function sensitivitaet(profil, varianten = null) {
  const eigennutzung = profil.ertrag.nutzung === 'eigennutzung';
  const faelle = varianten || (eigennutzung ? FAELLE_EIGENNUTZUNG : FAELLE_VERMIETUNG);

  return faelle.map(({ label, patch }) => {
    const variante = patch(JSON.parse(JSON.stringify(profil)));
    const p = projektion(variante);
    const k = kennzahlen(variante, p);
    const jahrNachZb = Math.min((p.angebot?.zinsbindung_jahre ?? 10) + 1, p.jahre.length);
    const eigen = eigennutzung ? kaufenVsMieten(variante, p) : null;
    return {
      label,
      cf_monat_j1: k.cf_monat_j1,
      cf_monat_nach_zb: p.jahre[jahrNachZb - 1]?.cf_monat ?? null,
      dscr: k.dscr,
      irr_ek: k.irr_ek,
      vermoegen_ende: k.vermoegen_ende,
      wohnkosten_monat: eigen?.wohnkosten_kauf_monat_j1 ?? null,
      vorteil_kauf_ende: eigen?.vorteil_ende ?? null,
      breakeven_jahr: eigen?.breakeven_jahr ?? null,
    };
  });
}
