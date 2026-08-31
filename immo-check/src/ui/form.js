/**
 * Rendert Eingabefelder aus den deklarativen Gruppen eines Moduls.
 * Kein Framework - ein Formular, ein Change-Handler, ein Neurendern.
 */

import { get, set } from '../core/schema.js';
import { OPTION_LABELS } from './felder.js';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function feldHtml(feld, profil) {
  const wert = get(profil, feld.key);
  const id = `f_${feld.key.replace(/\./g, '_')}`;
  const hinweis = feld.hinweis ? `<span class="hint" title="${esc(feld.hinweis)}">?</span>` : '';
  let eingabe;

  if (feld.typ === 'auswahl') {
    const opts = feld.optionen
      .map((o) => {
        const label = feld.labels?.[o] || OPTION_LABELS[o] || o;
        return `<option value="${esc(o)}"${o === wert ? ' selected' : ''}>${esc(label)}</option>`;
      })
      .join('');
    eingabe = `<select id="${id}" data-key="${esc(feld.key)}" data-typ="text">${opts}</select>`;
  } else if (feld.typ === 'ja_nein') {
    eingabe = `<label class="switch"><input type="checkbox" id="${id}" data-key="${esc(feld.key)}" data-typ="bool"${wert ? ' checked' : ''}><span>${wert ? 'ja' : 'nein'}</span></label>`;
  } else if (feld.typ === 'text') {
    eingabe = `<input type="text" id="${id}" data-key="${esc(feld.key)}" data-typ="text" value="${esc(wert ?? '')}">`;
  } else {
    const schritt = feld.schritt ?? (feld.einheit === '%' ? 0.1 : 1);
    eingabe = `<input type="number" id="${id}" data-key="${esc(feld.key)}" data-typ="zahl" step="${schritt}" value="${wert ?? 0}">`;
  }

  return `<div class="feld">
    <label for="${id}">${esc(feld.label)}${hinweis}</label>
    <div class="eingabe">${eingabe}${feld.einheit ? `<span class="einheit">${esc(feld.einheit)}</span>` : ''}</div>
  </div>`;
}

export function renderFormular(container, gruppen, profil) {
  container.innerHTML = gruppen
    .filter(Boolean)
    .map(
      (g) => `<section class="gruppe">
        <h3>${esc(g.titel)}</h3>
        <div class="felder">${g.felder.map((f) => feldHtml(f, profil)).join('')}</div>
      </section>`,
    )
    .join('');
}

/** Liest ein geaendertes Eingabefeld ins Profil zurueck. */
export function uebernimm(el, profil) {
  const key = el.dataset.key;
  if (!key) return false;
  let wert;
  if (el.dataset.typ === 'bool') wert = el.checked;
  else if (el.dataset.typ === 'zahl') wert = el.value === '' ? 0 : Number(el.value);
  else wert = el.value;
  set(profil, key, wert);
  return true;
}

/* ---------------- Finanzierungsangebote (dynamische Liste) ---------------- */

export function renderAngebote(container, profil) {
  const angebote = profil.finanzierung.angebote || [];
  container.innerHTML = `
    <div class="angebote">
      ${angebote
        .map(
          (a, i) => `
        <div class="angebot${a.id === profil.finanzierung.aktives_angebot ? ' aktiv' : ''}">
          <div class="angebot-kopf">
            <label class="radio">
              <input type="radio" name="aktives_angebot" value="${esc(a.id)}"${a.id === profil.finanzierung.aktives_angebot ? ' checked' : ''}>
              <input class="angebot-name" type="text" data-ang="${i}" data-feld="name" value="${esc(a.name ?? '')}">
            </label>
            <button class="mini" data-ang-del="${i}" title="Angebot entfernen" ${angebote.length < 2 ? 'disabled' : ''}>×</button>
          </div>
          <div class="angebot-felder">
            <label>Sollzins<input type="number" step="0.01" data-ang="${i}" data-feld="sollzins_pct" value="${a.sollzins_pct ?? 0}"><span>%</span></label>
            <label>Zinsbindung<input type="number" step="1" data-ang="${i}" data-feld="zinsbindung_jahre" value="${a.zinsbindung_jahre ?? 10}"><span>J</span></label>
            <label>Tilgung<input type="number" step="0.1" data-ang="${i}" data-feld="tilgung_pct" value="${a.tilgung_pct ?? 2}"><span>%</span></label>
            <label>Sondertilgung<input type="number" step="1" data-ang="${i}" data-feld="sondertilgung_pct_pa" value="${a.sondertilgung_pct_pa ?? 0}"><span>%/a</span></label>
          </div>
        </div>`,
        )
        .join('')}
    </div>
    <button class="sekundaer" id="angebot-neu">+ Angebot hinzufügen</button>`;
}

export function uebernimmAngebot(el, profil) {
  const idx = Number(el.dataset.ang);
  const feld = el.dataset.feld;
  const a = profil.finanzierung.angebote[idx];
  if (!a) return false;
  a[feld] = feld === 'name' ? el.value : Number(el.value);
  return true;
}
