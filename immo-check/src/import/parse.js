/**
 * Robustes Parsen von Werten aus fremdem JSON.
 * Exposé-Exporte liefern Zahlen mal als Number, mal als "320.000 €",
 * mal als "1.234,56 EUR" oder "ca. 85 m²".
 */

export function zuZahl(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'object') {
    // z. B. { value: 320000, currency: "EUR" }
    for (const k of ['value', 'amount', 'betrag', 'wert']) {
      if (v[k] !== undefined) return zuZahl(v[k]);
    }
    return null;
  }
  let s = String(v).trim().replace(/^(ca\.|rund|etwa|ab)\s*/i, '');
  s = s.replace(/[^\d,.\-]/g, ''); // Waehrung, Einheiten, Leerzeichen weg
  if (!s) return null;
  const komma = s.lastIndexOf(',');
  const punkt = s.lastIndexOf('.');
  if (komma > -1 && punkt > -1) {
    // das hintere Zeichen ist das Dezimaltrennzeichen
    s = komma > punkt ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  } else if (komma > -1) {
    s = s.split(',').length > 2 ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (punkt > -1) {
    // "320.000" ist ein Tausenderpunkt, "3.65" eine Dezimalzahl
    const nach = s.length - punkt - 1;
    if (nach === 3 && s.split('.').length >= 2 && !s.startsWith('0.')) s = s.replace(/\./g, '');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function zuBool(v) {
  if (typeof v === 'boolean') return v;
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (['ja', 'yes', 'true', '1', 'vorhanden'].includes(s)) return true;
  if (['nein', 'no', 'false', '0', 'nicht vorhanden', 'keine'].includes(s)) return false;
  return null;
}

export function zuText(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'object') return null;
  const s = String(v).trim();
  return s || null;
}

/**
 * Flacht ein beliebig verschachteltes Objekt ab.
 * @returns Map<normalisierterSchluessel, {pfad, wert}> - der letzte Pfadteil
 *          wird normalisiert (lowercase, ohne Umlaute/Sonderzeichen).
 */
export function flatten(obj, prefix = '', out = new Map()) {
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    const pfad = prefix ? `${prefix}.${k}` : k;
    const norm = normKey(k);
    // Container mitnehmen (z. B. price: { value, currency }) und trotzdem absteigen
    if (!out.has(norm)) out.set(norm, { pfad, wert: v });
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, pfad, out);
  }
  return out;
}

export function normKey(k) {
  return String(k)
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '');
}

/** Ersten Treffer aus einer Alias-Liste holen. */
export function finde(flat, aliase) {
  for (const a of aliase) {
    const key = normKey(a);
    if (flat.has(key)) {
      const eintrag = flat.get(key);
      if (eintrag.wert !== null && eintrag.wert !== undefined && eintrag.wert !== '') return eintrag;
    }
  }
  return null;
}
