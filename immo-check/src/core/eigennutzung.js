/**
 * Eigennutzung: Kaufen vs. Mieten.
 *
 * Vergleicht das Vermoegen nach t Jahren in zwei Welten:
 *  Kauf   - Immobilienwert abzueglich Restschuld (Verkaufskosten optional)
 *  Miete  - Eigenkapital + monatlich gesparte Differenz, angelegt zur
 *           Alternativrendite
 *
 * Die Wohnkosten des Kaeufers sind Kapitaldienst + nicht umlagefaehige
 * Bewirtschaftungskosten; die des Mieters die Vergleichsmiete. Wer weniger
 * zahlt, legt die Differenz an.
 */

import { projektion } from './cashflow.js';

export function kaufenVsMieten(profil, proj = null) {
  const p = proj || projektion(profil);
  const alt = (profil.annahmen.alternativrendite_pa_pct || 0) / 100;
  const mietSteig = (profil.ertrag.mietsteigerung_pa_pct || 0) / 100;
  const verkaufskostenPct = (profil.annahmen.verkaufskosten_pct || 0) / 100;
  const ek = p.finanzierung.eigenkapital;

  let depot = ek; // Mieter behaelt das Eigenkapital und legt es an
  const jahre = [];

  for (const j of p.jahre) {
    const wohnkostenKauf = j.kapitaldienst + j.bewirtschaftung;
    const wohnkostenMiete =
      (profil.annahmen.vergleichsmiete_monat || 0) * 12 * Math.pow(1 + mietSteig, j.jahr - 1);
    const differenz = wohnkostenKauf - wohnkostenMiete; // > 0: Kauf teurer, Mieter spart

    depot = depot * (1 + alt) + differenz;

    const vermoegenKauf = j.wert * (1 - verkaufskostenPct) - j.restschuld;
    jahre.push({
      jahr: j.jahr,
      wohnkosten_kauf_monat: wohnkostenKauf / 12,
      wohnkosten_miete_monat: wohnkostenMiete / 12,
      differenz_monat: differenz / 12,
      vermoegen_kauf: vermoegenKauf,
      vermoegen_miete: depot,
      vorteil_kauf: vermoegenKauf - depot,
    });
  }

  const letztes = jahre.at(-1) || null;
  const breakEven = jahre.find((x) => x.vorteil_kauf >= 0)?.jahr ?? null;

  return {
    jahre,
    breakeven_jahr: breakEven, // ab wann liegt Kaufen vorn?
    vorteil_ende: letztes?.vorteil_kauf ?? 0,
    wohnkosten_kauf_monat_j1: jahre[0]?.wohnkosten_kauf_monat ?? 0,
    wohnkosten_miete_monat_j1: jahre[0]?.wohnkosten_miete_monat ?? 0,
    // Kalkulatorische Rendite der ersparten Miete auf die Gesamtinvestition
    ersparte_miete_rendite:
      p.invest.gesamt > 0
        ? (((profil.annahmen.vergleichsmiete_monat || 0) * 12 - p.basis.bewirtschaftung) /
            p.invest.gesamt) *
          100
        : null,
  };
}
