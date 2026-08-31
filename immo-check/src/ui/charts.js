/**
 * Minimale SVG-Charts ohne Bibliothek. Farben kommen aus CSS-Variablen,
 * damit Hell/Dunkel automatisch passt.
 */

import { eur, zahl } from '../core/format.js';

const B = 720; // Zeichenbreite (viewBox)
const H = 260;
const P = { oben: 16, rechts: 12, unten: 28, links: 62 };
const TICKS = 5;

/** Achse auf runde Schritte bringen – sonst stehen krumme Werte an der Skala. */
function skala(werte) {
  const alle = werte.flat().filter((v) => Number.isFinite(v));
  const rohMin = Math.min(0, ...alle);
  const rohMax = Math.max(...alle, 1);
  const spanne = (rohMax - rohMin) / TICKS || 1;
  const mag = Math.pow(10, Math.floor(Math.log10(spanne)));
  const norm = spanne / mag;
  const schritt = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
  return {
    min: Math.floor(rohMin / schritt) * schritt,
    max: Math.ceil(rohMax / schritt) * schritt,
    schritt,
  };
}

/** Ein Format fuer die ganze Achse – kein Mischen von "706 €" und "2 k€". */
export function achsenFormat(werte) {
  const gross = Math.max(...werte.flat().map((v) => Math.abs(v || 0))) >= 10000;
  return gross ? (v) => `${zahl(v / 1000, 0)} k€` : (v) => eur(v);
}

function pfad(werte, xs, y) {
  return werte
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ');
}

/**
 * @param serien [{label, werte:[], klasse:'s0'|'s1'|'s2', flaeche?:boolean}]
 * @param xLabels Beschriftung der X-Achse (gleiche Laenge wie werte)
 */
export function linienChart(serien, xLabels, { yFormat = null, titel = '' } = {}) {
  if (!serien.length || !serien[0].werte.length) return '';
  const n = serien[0].werte.length;
  const alle = serien.map((s) => s.werte);
  const { min, max, schritt } = skala(alle);
  const fmt = yFormat || achsenFormat(alle);
  const xs = (i) => P.links + (i * (B - P.links - P.rechts)) / Math.max(1, n - 1);
  const y = (v) => P.oben + ((max - v) / (max - min)) * (H - P.oben - P.unten);

  const gitter = Array.from({ length: Math.round((max - min) / schritt) + 1 }, (_, i) => {
    const v = min + schritt * i;
    return `<line class="grid" x1="${P.links}" y1="${y(v).toFixed(1)}" x2="${B - P.rechts}" y2="${y(v).toFixed(1)}"/>
            <text class="tick" x="${P.links - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`;
  }).join('');

  const xSchritt = Math.max(1, Math.ceil(n / 10));
  const xachse = xLabels
    .map((l, i) =>
      i % xSchritt === 0 || i === n - 1
        ? `<text class="tick" x="${xs(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${l}</text>`
        : '',
    )
    .join('');

  const nulllinie =
    min < 0 ? `<line class="null" x1="${P.links}" y1="${y(0).toFixed(1)}" x2="${B - P.rechts}" y2="${y(0).toFixed(1)}"/>` : '';

  const linien = serien
    .map((s) => {
      const flaeche = s.flaeche
        ? `<path class="area ${s.klasse}" d="${pfad(s.werte, xs, y)} L${xs(n - 1).toFixed(1)},${y(Math.max(0, min)).toFixed(1)} L${xs(0).toFixed(1)},${y(Math.max(0, min)).toFixed(1)} Z"/>`
        : '';
      return `${flaeche}<path class="linie ${s.klasse}" d="${pfad(s.werte, xs, y)}"/>`;
    })
    .join('');

  const legende = serien
    .map((s) => `<span class="leg ${s.klasse}"><i></i>${s.label}</span>`)
    .join('');

  return `<figure class="chart">
    ${titel ? `<figcaption>${titel}</figcaption>` : ''}
    <svg viewBox="0 0 ${B} ${H}" role="img" aria-label="${titel}" preserveAspectRatio="xMidYMid meet">
      ${gitter}${nulllinie}${linien}${xachse}
    </svg>
    <div class="legende">${legende}</div>
  </figure>`;
}

/** Balken fuer den jaehrlichen Cashflow (positiv/negativ eingefaerbt). */
export function balkenChart(werte, xLabels, { titel = '', yFormat = null } = {}) {
  if (!werte.length) return '';
  const { min, max, schritt } = skala([werte]);
  const fmt = yFormat || achsenFormat([werte]);
  const n = werte.length;
  const breite = ((B - P.links - P.rechts) / n) * 0.6;
  const xs = (i) => P.links + (i + 0.5) * ((B - P.links - P.rechts) / n);
  const y = (v) => P.oben + ((max - v) / (max - min)) * (H - P.oben - P.unten);
  const y0 = y(0);

  const balken = werte
    .map((v, i) => {
      const oben = Math.min(y(v), y0);
      const hoehe = Math.abs(y(v) - y0) || 1;
      return `<rect class="bar ${v >= 0 ? 'pos' : 'neg'}" x="${(xs(i) - breite / 2).toFixed(1)}" y="${oben.toFixed(1)}" width="${breite.toFixed(1)}" height="${hoehe.toFixed(1)}"><title>Jahr ${xLabels[i]}: ${eur(v)}</title></rect>`;
    })
    .join('');

  const gitter = Array.from({ length: Math.round((max - min) / schritt) + 1 }, (_, i) => {
    const v = min + schritt * i;
    return `<line class="grid" x1="${P.links}" y1="${y(v).toFixed(1)}" x2="${B - P.rechts}" y2="${y(v).toFixed(1)}"/>
            <text class="tick" x="${P.links - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`;
  }).join('');

  const xSchritt = Math.max(1, Math.ceil(n / 12));
  const xachse = xLabels
    .map((l, i) => (i % xSchritt === 0 || i === n - 1 ? `<text class="tick" x="${xs(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${l}</text>` : ''))
    .join('');

  return `<figure class="chart">
    ${titel ? `<figcaption>${titel}</figcaption>` : ''}
    <svg viewBox="0 0 ${B} ${H}" role="img" aria-label="${titel}" preserveAspectRatio="xMidYMid meet">
      ${gitter}${balken}<line class="null" x1="${P.links}" y1="${y0.toFixed(1)}" x2="${B - P.rechts}" y2="${y0.toFixed(1)}"/>${xachse}
    </svg>
  </figure>`;
}
