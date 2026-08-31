/**
 * Stark vereinfachte Steuerlogik (Deutschland, Privatperson).
 *
 * Bewusst als eigenes Modul, damit Sonderfaelle (Denkmal-AfA, degressive AfA,
 * Sonder-AfA 7b beim Neubau) spaeter hier und nur hier ergaenzt werden.
 *
 * ACHTUNG: Naeherungsrechnung mit konstantem Grenzsteuersatz - keine
 * Steuerberatung. Kein Soli, keine Kirchensteuer, keine Progression.
 */

import { investition } from './finance.js';

/**
 * AfA-Bemessungsgrundlage: Gebaeudeanteil von Kaufpreis + Nebenkosten
 * (ohne Grund und Boden) zzgl. Modernisierung/Baukosten.
 */
export function afaBasis(profil) {
  const inv = investition(profil);
  const gebaeudeAnteil = 1 - (profil.kauf.bodenwert_anteil_pct || 0) / 100;
  const kaufTeil = (inv.kaufpreis + inv.nebenkosten) * gebaeudeAnteil;
  return Math.max(0, kaufTeil + inv.modernisierung + inv.bau);
}

export function afaJahr(profil) {
  if (profil.ertrag.nutzung !== 'vermietung') return 0; // keine AfA bei Eigennutzung
  if (profil.objekt.typ === 'grundstueck') return 0; // Grund und Boden ist nicht abschreibbar
  return (afaBasis(profil) * (profil.steuer.afa_satz_pct || 0)) / 100;
}

/**
 * Einkuenfte aus Vermietung und Verpachtung + Steuerwirkung.
 * Negativer Wert von `steuer` = Erstattung (Verlustverrechnung).
 */
export function steuerJahr({ profil, mieteinnahmen, bewirtschaftung, zinsen, afa }) {
  if (profil.ertrag.nutzung !== 'vermietung') {
    return { einkuenfte: 0, steuer: 0 };
  }
  const einkuenfte = mieteinnahmen - bewirtschaftung - zinsen - afa;
  const steuer = (einkuenfte * (profil.steuer.grenzsteuersatz_pct || 0)) / 100;
  return { einkuenfte, steuer };
}

/**
 * Veraeusserungsgewinn-Besteuerung (Spekulationsfrist 10 Jahre).
 * Bei Eigennutzung steuerfrei, bei Vermietung nach 10 Jahren steuerfrei;
 * innerhalb der Frist mindern kumulierte AfA die Anschaffungskosten.
 */
export function veraeusserungssteuer({ profil, verkaufspreis, verkaufskosten, afaKumuliert, haltedauerJahre }) {
  if (profil.ertrag.nutzung === 'eigennutzung') return 0;
  if (haltedauerJahre > 10) return 0;
  const anschaffung = investition(profil).gesamt - afaKumuliert;
  const gewinn = verkaufspreis - verkaufskosten - anschaffung;
  if (gewinn <= 0) return 0;
  return (gewinn * (profil.steuer.grenzsteuersatz_pct || 0)) / 100;
}
