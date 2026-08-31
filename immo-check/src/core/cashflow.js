/**
 * Cashflow-Projektion ueber die Betrachtungsdauer.
 *
 * Ein Rechenweg fuer alle Objekttypen: Grundstuecke laufen mit
 * Mieteinnahmen = 0 und AfA = 0 durch dieselbe Projektion.
 */

import { investition, darlehensbedarf, aktivesAngebot, planFuerAngebot } from './finance.js';
import { afaJahr, steuerJahr, veraeusserungssteuer } from './tax.js';

/** Jahreswerte im ersten Jahr (Basis fuer alle Renditekennzahlen). */
export function jahresbasis(profil) {
  const e = profil.ertrag;
  const k = profil.kosten;
  const vermietet = e.nutzung === 'vermietung';

  const mieteBrutto = vermietet ? (e.kaltmiete_monat + (e.stellplatzmiete_monat || 0)) * 12 : 0;
  const mieteinnahmen = mieteBrutto * (1 - (e.leerstand_pct || 0) / 100);

  const instandhaltung = (k.instandhaltung_eur_qm_jahr || 0) * (profil.objekt.wohnflaeche || 0);
  const bewirtschaftung =
    (k.nicht_umlagefaehig_monat || 0) * 12 +
    (k.verwaltung_eur_monat || 0) * 12 +
    (k.grundsteuer_jahr || 0) +
    (k.versicherung_jahr || 0) +
    (profil.objekt.erbbauzins_jahr || 0) +
    instandhaltung;

  return {
    miete_brutto: mieteBrutto,
    mieteinnahmen,
    instandhaltung,
    bewirtschaftung,
    noi: mieteinnahmen - bewirtschaftung, // Net Operating Income
  };
}

/**
 * Vollstaendige Projektion.
 * @returns {{invest, finanzierung, plan, jahre: Array, verkauf: Object}}
 */
export function projektion(profil, angebotOverride = null) {
  const angebot = angebotOverride || aktivesAngebot(profil);
  const inv = investition(profil);
  const fin = darlehensbedarf(profil);
  const plan = planFuerAngebot(profil, angebot);
  const n = profil.annahmen.betrachtungsdauer_jahre;

  const basis = jahresbasis(profil);
  const afa = afaJahr(profil);
  const mietSteig = (profil.ertrag.mietsteigerung_pa_pct || 0) / 100;
  const kostenSteig = (profil.kosten.kostensteigerung_pa_pct || 0) / 100;
  const wertSteig = (profil.annahmen.wertsteigerung_pa_pct || 0) / 100;

  const jahre = [];
  let afaKumuliert = 0;

  for (let t = 1; t <= n; t++) {
    const p = plan.jahre[t - 1] || { zinsen: 0, tilgung: 0, sondertilgung: 0, restschuld: 0, rate_monat: 0 };
    const mieteinnahmen = basis.mieteinnahmen * Math.pow(1 + mietSteig, t - 1);
    const bewirtschaftung = basis.bewirtschaftung * Math.pow(1 + kostenSteig, t - 1);
    const noi = mieteinnahmen - bewirtschaftung;
    const kapitaldienst = p.zinsen + p.tilgung + p.sondertilgung;

    afaKumuliert += afa;
    const { einkuenfte, steuer } = steuerJahr({
      profil,
      mieteinnahmen,
      bewirtschaftung,
      zinsen: p.zinsen,
      afa,
    });

    const cfVorSteuer = noi - kapitaldienst;
    const wert = inv.kaufpreis * Math.pow(1 + wertSteig, t);

    jahre.push({
      jahr: t,
      mieteinnahmen,
      bewirtschaftung,
      noi,
      zinsen: p.zinsen,
      tilgung: p.tilgung + p.sondertilgung,
      kapitaldienst,
      rate_monat: p.rate_monat,
      afa,
      einkuenfte,
      steuer,
      cf_vor_steuer: cfVorSteuer,
      cf_nach_steuer: cfVorSteuer - steuer,
      cf_monat: (cfVorSteuer - steuer) / 12,
      restschuld: p.restschuld,
      wert,
      eigenkapital_gebunden: wert - p.restschuld,
    });
  }

  const letztes = jahre.at(-1);
  const verkaufspreis = letztes?.wert ?? inv.kaufpreis;
  const verkaufskosten = (verkaufspreis * (profil.annahmen.verkaufskosten_pct || 0)) / 100;
  const spekusteuer = veraeusserungssteuer({
    profil,
    verkaufspreis,
    verkaufskosten,
    afaKumuliert,
    haltedauerJahre: n,
  });
  const nettoerloes = verkaufspreis - verkaufskosten - (letztes?.restschuld ?? 0) - spekusteuer;

  return {
    angebot,
    invest: inv,
    finanzierung: fin,
    plan,
    basis,
    jahre,
    verkauf: {
      verkaufspreis,
      verkaufskosten,
      restschuld: letztes?.restschuld ?? 0,
      spekulationssteuer: spekusteuer,
      afa_kumuliert: afaKumuliert,
      nettoerloes,
    },
  };
}
