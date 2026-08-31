/**
 * Bewertungs-Engine (Ampel).
 *
 * Ein Modul liefert `regeln` (Schwellwerte auf Kennzahlen) und `pruefungen`
 * (freie Plausibilitaets-Checks). Beides wird hier einheitlich ausgewertet -
 * neue Objekttypen brauchen keine eigene Bewertungslogik.
 */

export const AMPEL = { gruen: 'gruen', gelb: 'gelb', rot: 'rot', neutral: 'neutral' };

const PUNKTE = { gruen: 2, gelb: 1, rot: 0 };

/**
 * @param {Array} regeln  [{id, label, kpi, richtung:'hoch'|'tief', gruen, gelb, einheit, gewicht, hinweis}]
 */
export function bewerte(regeln, kpi) {
  return regeln.map((r) => {
    const wert = typeof r.wert === 'function' ? r.wert(kpi) : kpi[r.kpi];
    if (wert === null || wert === undefined || Number.isNaN(wert)) {
      return { ...r, wert: null, status: AMPEL.neutral };
    }
    let status;
    if (r.richtung === 'tief') {
      status = wert <= r.gruen ? AMPEL.gruen : wert <= r.gelb ? AMPEL.gelb : AMPEL.rot;
    } else {
      status = wert >= r.gruen ? AMPEL.gruen : wert >= r.gelb ? AMPEL.gelb : AMPEL.rot;
    }
    return { ...r, wert, status };
  });
}

/** Gewichteter Score 0-100 ueber alle bewertbaren Regeln. */
export function gesamtscore(bewertungen) {
  const relevant = bewertungen.filter((b) => b.status !== AMPEL.neutral);
  if (!relevant.length) return { score: null, status: AMPEL.neutral, anzahl: 0 };
  const maxP = relevant.reduce((s, b) => s + (b.gewicht ?? 1) * 2, 0);
  const p = relevant.reduce((s, b) => s + (b.gewicht ?? 1) * PUNKTE[b.status], 0);
  const score = Math.round((p / maxP) * 100);
  return {
    score,
    status: score >= 70 ? AMPEL.gruen : score >= 45 ? AMPEL.gelb : AMPEL.rot,
    anzahl: relevant.length,
    rot: relevant.filter((b) => b.status === AMPEL.rot).length,
  };
}

/** Freie Checks eines Moduls ausfuehren; liefert Liste von Hinweisen. */
export function pruefe(pruefungen, ctx) {
  const out = [];
  for (const fn of pruefungen || []) {
    try {
      const r = fn(ctx);
      if (Array.isArray(r)) out.push(...r.filter(Boolean));
      else if (r) out.push(r);
    } catch (e) {
      out.push({ status: AMPEL.neutral, text: `Check fehlgeschlagen: ${e.message}` });
    }
  }
  return out;
}
