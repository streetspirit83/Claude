/**
 * Import-Orchestrierung: JSON -> Adapter -> kanonisches Profil + Report.
 *
 * Der Report ist absichtlich ausfuehrlich: bei fremden Daten ist die Frage
 * "was wurde uebernommen, was fehlt, was wurde geraten?" wichtiger als die
 * reine Zahl.
 */

import { defaultProfil, merge, klone, get, validiere } from '../core/schema.js';
import { modul } from '../modules/registry.js';
import { waehleAdapter, ADAPTER } from './adapters.js';

/** Felder, ohne die eine Bewertung nicht sinnvoll ist – je Objekttyp. */
const WICHTIG = {
  wohnung: [
    ['kauf.kaufpreis', 'Kaufpreis'],
    ['objekt.wohnflaeche', 'Wohnfläche'],
    ['ertrag.kaltmiete_monat', 'Kaltmiete'],
    ['kosten.hausgeld_monat', 'Hausgeld'],
    ['objekt.baujahr', 'Baujahr'],
  ],
  efh: [
    ['kauf.kaufpreis', 'Kaufpreis'],
    ['objekt.wohnflaeche', 'Wohnfläche'],
    ['objekt.grundstuecksflaeche', 'Grundstücksfläche'],
    ['objekt.baujahr', 'Baujahr'],
  ],
  grundstueck: [
    ['kauf.kaufpreis', 'Kaufpreis'],
    ['objekt.grundstuecksflaeche', 'Fläche'],
    ['objekt.bodenrichtwert_eur_qm', 'Bodenrichtwert'],
    ['objekt.gfz', 'GFZ'],
  ],
  neubau: [
    ['kauf.kaufpreis', 'Grundstückspreis'],
    ['kauf.baukosten', 'Baukosten'],
    ['objekt.wohnflaeche', 'Wohnfläche'],
  ],
};

/**
 * @param {string|object} eingabe  JSON-Text oder bereits geparstes Objekt
 * @param {object} aktuellesProfil Profil, in das gemerged wird
 * @param {object} opt  { adapterId?: string, ersetzen?: boolean }
 */
export function importiere(eingabe, aktuellesProfil, opt = {}) {
  let raw;
  try {
    raw = typeof eingabe === 'string' ? JSON.parse(eingabe) : eingabe;
  } catch (e) {
    return { ok: false, fehler: `JSON konnte nicht gelesen werden: ${e.message}` };
  }
  if (!raw || typeof raw !== 'object') {
    return { ok: false, fehler: 'Das JSON enthält kein Objekt.' };
  }

  const kandidaten = waehleAdapter(raw);
  const gewaehlt = opt.adapterId
    ? { adapter: ADAPTER.find((a) => a.id === opt.adapterId), score: null }
    : kandidaten[0];

  if (!gewaehlt?.adapter) {
    return { ok: false, fehler: 'Kein passender Import-Adapter gefunden.', kandidaten };
  }

  const { patch, gefunden, warnungen = [], modus = 'objekt' } = gewaehlt.adapter.mappe(raw);

  let profil;
  if (gewaehlt.adapter.id === 'reip') {
    const fehler = validiere(patch);
    if (fehler.length) return { ok: false, fehler: fehler.join(' ') };
    profil = merge(defaultProfil(), patch);
  } else if (modus === 'finanzierung') {
    // Angebote ersetzen, Objektdaten bleiben unangetastet
    profil = merge(klone(aktuellesProfil), patch);
  } else {
    const typ = patch.objekt?.typ || aktuellesProfil.objekt.typ;
    const basis = opt.ersetzen === false ? klone(aktuellesProfil) : merge(defaultProfil(), modul(typ).defaults);
    profil = merge(basis, patch);
  }

  // "Fehlend" heisst: nicht aus den importierten Daten uebernommen. Ein
  // Default-Wert im Profil taeuscht sonst Vollstaendigkeit vor.
  const typ = profil.objekt.typ;
  const importiert = new Set(gefunden.map((g) => g.ziel));
  const fehlend =
    modus === 'finanzierung' || gewaehlt.adapter.id === 'reip'
      ? []
      : (WICHTIG[typ] || WICHTIG.wohnung)
          .filter(([pfad]) => {
            const w = get(profil, pfad);
            return !importiert.has(pfad) || w === null || w === undefined || w === '' || w === 0;
          })
          .map(([pfad, label]) => ({ pfad, label, aktuell: get(profil, pfad) }));

  return {
    ok: true,
    profil,
    modus,
    adapter: { id: gewaehlt.adapter.id, label: gewaehlt.adapter.label, score: gewaehlt.score },
    kandidaten: kandidaten.map((k) => ({ id: k.adapter.id, label: k.adapter.label, score: k.score })),
    report: { gefunden, fehlend, warnungen },
  };
}
