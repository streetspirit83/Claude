/**
 * Modul-Registry. Neues Objektmodul = Datei anlegen + hier eintragen.
 * Sonst muss nichts angefasst werden.
 */

import { wohnung } from './wohnung.js';
import { efh } from './efh.js';
import { grundstueck } from './grundstueck.js';
import { neubau } from './neubau.js';

export const MODULE = { wohnung, efh, grundstueck, neubau };

export const MODUL_LISTE = [wohnung, efh, grundstueck, neubau];

export function modul(id) {
  return MODULE[id] || wohnung;
}

/** Alle KPI-Schluessel, die ein Modul zusaetzlich beisteuert. */
export function extraKpis(modulId, profil, proj) {
  const m = modul(modulId);
  return m.extraKpis ? m.extraKpis(profil, proj) : {};
}
