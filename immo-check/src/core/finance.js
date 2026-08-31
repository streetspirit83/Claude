/**
 * Finanzierung: Investitionssumme, Annuitaetendarlehen, Tilgungsplan,
 * Anschlussfinanzierung nach Ablauf der Zinsbindung.
 *
 * Rechnet monatsgenau (nachschuessig) und aggregiert auf Jahre.
 */

/** Kaufnebenkosten + Gesamtinvestition. */
export function investition(profil) {
  const k = profil.kauf;
  const basis = k.kaufpreis;
  const grunderwerbsteuer = (basis * k.grunderwerbsteuer_pct) / 100;
  const notar = (basis * k.notar_pct) / 100;
  const makler = (basis * k.makler_pct) / 100;
  const nebenkosten = grunderwerbsteuer + notar + makler + (k.sonstige_nebenkosten || 0);
  const bau =
    (k.baukosten || 0) * (1 + (k.baunebenkosten_pct || 0) / 100) + (k.erschliessungskosten || 0);
  const gesamt = basis + nebenkosten + (k.modernisierung || 0) + bau;
  return {
    kaufpreis: basis,
    grunderwerbsteuer,
    notar,
    makler,
    sonstige: k.sonstige_nebenkosten || 0,
    nebenkosten,
    nebenkosten_pct: basis ? (nebenkosten / basis) * 100 : 0,
    modernisierung: k.modernisierung || 0,
    bau,
    gesamt,
  };
}

export function darlehensbedarf(profil) {
  const gesamt = investition(profil).gesamt;
  const ek = Math.min(profil.finanzierung.eigenkapital || 0, gesamt);
  return { gesamt, eigenkapital: ek, darlehen: Math.max(0, gesamt - ek) };
}

export function aktivesAngebot(profil) {
  const a = profil.finanzierung.angebote || [];
  return a.find((x) => x.id === profil.finanzierung.aktives_angebot) || a[0] || null;
}

/**
 * Monatsgenauer Tilgungsplan ueber `jahre` Jahre.
 * Nach Ablauf der Zinsbindung greift `anschlusszins_pct`.
 *
 * rateModus:
 *  - 'annuitaet_halten': Rate bleibt gleich (Tilgung sinkt bei hoeherem Zins)
 *  - 'tilgung_halten':   Rate wird neu berechnet, anfaengliche Tilgung bleibt
 */
export function tilgungsplan({
  darlehen,
  sollzinsPct,
  tilgungPct,
  zinsbindungJahre,
  anschlusszinsPct,
  jahre,
  sondertilgungPctPa = 0,
  rateModus = 'annuitaet_halten',
}) {
  const jahresListe = [];
  let restschuld = darlehen;
  let annuitaetJahr = darlehen * ((sollzinsPct + tilgungPct) / 100);
  let rate = annuitaetJahr / 12;
  const sondertilgungMax = (darlehen * sondertilgungPctPa) / 100;

  let zinsGesamt = 0;
  let restschuldEndeZinsbindung = null;
  let unterdeckung = false;

  for (let jahr = 1; jahr <= jahre; jahr++) {
    const zinssatz = jahr <= zinsbindungJahre ? sollzinsPct : anschlusszinsPct;

    // Umstellung im ersten Jahr nach Zinsbindung
    if (jahr === zinsbindungJahre + 1 && restschuld > 0) {
      restschuldEndeZinsbindung = restschuld;
      if (rateModus === 'tilgung_halten') {
        annuitaetJahr = restschuld * ((anschlusszinsPct + tilgungPct) / 100);
        rate = annuitaetJahr / 12;
      }
      if (rate * 12 <= restschuld * (zinssatz / 100)) unterdeckung = true;
    }

    let zinsenJahr = 0;
    let tilgungJahr = 0;
    for (let m = 0; m < 12 && restschuld > 0; m++) {
      const zinsMonat = (restschuld * zinssatz) / 100 / 12;
      let tilgMonat = rate - zinsMonat;
      if (tilgMonat < 0) tilgMonat = 0; // Rate deckt Zins nicht (Negativtilgung vermeiden)
      if (tilgMonat > restschuld) tilgMonat = restschuld;
      restschuld -= tilgMonat;
      zinsenJahr += zinsMonat;
      tilgungJahr += tilgMonat;
    }

    let sonder = 0;
    if (sondertilgungMax > 0 && restschuld > 0) {
      sonder = Math.min(sondertilgungMax, restschuld);
      restschuld -= sonder;
    }

    zinsGesamt += zinsenJahr;
    jahresListe.push({
      jahr,
      zinssatz,
      rate_monat: restschuld > 0 || tilgungJahr > 0 ? rate : 0,
      zinsen: zinsenJahr,
      tilgung: tilgungJahr,
      sondertilgung: sonder,
      kapitaldienst: zinsenJahr + tilgungJahr + sonder,
      restschuld,
    });
  }

  if (restschuldEndeZinsbindung === null) {
    const idx = Math.min(zinsbindungJahre, jahre) - 1;
    restschuldEndeZinsbindung = idx >= 0 ? jahresListe[idx]?.restschuld ?? 0 : darlehen;
  }

  return {
    rate_monat_start: darlehen > 0 ? annuitaetJahr / 12 : 0,
    jahre: jahresListe,
    zins_gesamt: zinsGesamt,
    restschuld_ende: jahresListe.at(-1)?.restschuld ?? darlehen,
    restschuld_ende_zinsbindung: restschuldEndeZinsbindung,
    unterdeckung, // Rate reicht nach Zinsbindung nicht mehr fuer die Zinsen
    volltilgung_jahr: jahresListe.find((j) => j.restschuld <= 0.01)?.jahr ?? null,
  };
}

/** Tilgungsplan direkt aus einem Profil + Angebot. */
export function planFuerAngebot(profil, angebot) {
  const { darlehen } = darlehensbedarf(profil);
  return tilgungsplan({
    darlehen,
    sollzinsPct: angebot?.sollzins_pct ?? 0,
    tilgungPct: angebot?.tilgung_pct ?? 0,
    zinsbindungJahre: angebot?.zinsbindung_jahre ?? 10,
    anschlusszinsPct: profil.finanzierung.anschlusszins_pct ?? angebot?.sollzins_pct ?? 0,
    jahre: profil.annahmen.betrachtungsdauer_jahre,
    sondertilgungPctPa: 0, // Sondertilgung ist Option, nicht Basisannahme
    rateModus: profil.finanzierung.rate_nach_zinsbindung,
  });
}

/** Interner Zinsfuss per Bisektion. cashflows[0] ist der Einsatz (negativ). */
export function irr(cashflows, min = -0.99, max = 1.0, iter = 200) {
  const npv = (r) => cashflows.reduce((s, cf, t) => s + cf / Math.pow(1 + r, t), 0);
  let lo = min;
  let hi = max;
  const nlo = npv(lo);
  const nhi = npv(hi);
  if (!isFinite(nlo) || !isFinite(nhi) || nlo * nhi > 0) return null; // kein Vorzeichenwechsel
  for (let i = 0; i < iter; i++) {
    const mid = (lo + hi) / 2;
    const n = npv(mid);
    if (Math.abs(n) < 1e-7) return mid;
    if (n * npv(lo) < 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}
