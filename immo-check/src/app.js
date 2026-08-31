/**
 * App-Schale: Zustand, Rendering, Events.
 *
 * Der Zustand ist genau ein kanonisches Profil. Alles andere wird bei jedem
 * Rendern neu berechnet - kein Zwischenzustand, keine Synchronisationsfehler.
 */

import { defaultProfil, merge, klone } from './core/schema.js';
import { projektion } from './core/cashflow.js';
import { kennzahlen, sensitivitaet } from './core/kpi.js';
import { bewerte, gesamtscore, pruefe } from './core/scoring.js';
import { kaufenVsMieten } from './core/eigennutzung.js';
import { MODUL_LISTE, modul, extraKpis } from './modules/registry.js';
import { regelnFuer, kpisFuer, eigennutzungKpis } from './modules/nutzung.js';
import { importiere } from './import/import.js';
import { ADAPTER } from './import/adapters.js';
import { renderFormular, uebernimm, renderAngebote, uebernimmAngebot } from './ui/form.js';
import { GEMEINSAME_GRUPPEN } from './ui/felder.js';
import { renderErgebnis } from './ui/results.js';
import { eur } from './core/format.js';

const SPEICHER = 'immo-check.profil.v1';

const el = (id) => document.getElementById(id);

let profil = laden();
let importErgebnis = null;

/* ----------------------------- Zustand ----------------------------- */

function laden() {
  try {
    const roh = localStorage.getItem(SPEICHER);
    if (roh) return merge(defaultProfil(), JSON.parse(roh));
  } catch {
    /* defekter Speicher: mit Standardprofil weiterarbeiten */
  }
  return merge(defaultProfil(), modul('wohnung').defaults);
}

function speichern() {
  try {
    localStorage.setItem(SPEICHER, JSON.stringify(profil));
  } catch {
    /* privater Modus o. Ä. – nicht kritisch */
  }
}

/**
 * Modulwechsel: frisch aus Standard + Modul-Defaults aufbauen und nur die
 * erfassten Objektdaten mitnehmen. Sonst schleppt man typfremde Werte mit
 * (z. B. Baukosten aus dem Neubau-Modul in eine Bestandswohnung).
 */
function wechsleModul(id) {
  // Leere Werte nicht mitnehmen – sonst ueberschreibt eine 0 den sinnvollen
  // Modul-Default (z. B. Grundstuecksflaeche beim Wechsel von der ETW).
  const nurGesetzte = (obj) =>
    Object.fromEntries(
      Object.entries(obj).filter(([, v]) => (typeof v === 'object' ? true : v !== 0 && v !== '' && v != null)),
    );

  const bewahren = klone({
    meta: profil.meta,
    objekt: nurGesetzte({
      adresse: profil.objekt.adresse,
      wohnflaeche: profil.objekt.wohnflaeche,
      grundstuecksflaeche: profil.objekt.grundstuecksflaeche,
      baujahr: profil.objekt.baujahr,
      energie: profil.objekt.energie,
    }),
    kauf: nurGesetzte({ kaufpreis: profil.kauf.kaufpreis }),
    finanzierung: profil.finanzierung,
    steuer: { grenzsteuersatz_pct: profil.steuer.grenzsteuersatz_pct },
  });
  profil = merge(merge(defaultProfil(), modul(id).defaults), bewahren);
  profil.objekt.typ = id;
  rendern();
}

/* ----------------------------- Rechnen ----------------------------- */

function auswerten() {
  const m = modul(profil.objekt.typ);
  const proj = projektion(profil);
  const eigen = profil.ertrag.nutzung === 'eigennutzung' ? kaufenVsMieten(profil, proj) : null;
  const kpi = {
    ...kennzahlen(profil, proj),
    ...extraKpis(m.id, profil, proj),
    ...eigennutzungKpis(eigen),
  };
  const bewertungen = bewerte(regelnFuer(m, profil), kpi);
  const score = gesamtscore(bewertungen);
  const hinweise = pruefe(m.pruefungen, { profil, proj, kpi });

  const vergleich = (profil.finanzierung.angebote || []).map((a) => {
    const p = projektion(profil, a);
    const k = kennzahlen(profil, p);
    return {
      name: a.name,
      aktiv: a.id === profil.finanzierung.aktives_angebot,
      sollzins_pct: a.sollzins_pct,
      zinsbindung_jahre: a.zinsbindung_jahre,
      tilgung_pct: a.tilgung_pct,
      rate_monat: p.plan.rate_monat_start,
      restschuld_zb: p.plan.restschuld_ende_zinsbindung,
      zins_gesamt: p.plan.zins_gesamt,
      cf_monat: k.cf_monat_j1,
      irr_ek: k.irr_ek,
    };
  });

  return {
    profil,
    modulObj: m,
    kpiListe: kpisFuer(m, profil),
    proj,
    kpi,
    bewertungen,
    score,
    hinweise,
    vergleich,
    sens: sensitivitaet(profil),
    eigen,
  };
}

/** Kopfzeile: bei Eigennutzung ist "Cashflow" die monatliche Belastung. */
function kopfText(ctx) {
  const cf =
    ctx.eigen !== null
      ? `${eur(ctx.kpi.wohnkosten_kauf_monat)}/Mon Wohnkosten`
      : `${eur(ctx.kpi.cf_monat_j1)}/Mon Cashflow`;
  return `${ctx.modulObj.label} · ${eur(ctx.kpi.gesamtinvest)} Gesamtinvest · ${cf}`;
}

/* ----------------------------- Rendern ----------------------------- */

function rendern() {
  const m = modul(profil.objekt.typ);

  el('module').innerHTML = MODUL_LISTE.map(
    (x) => `<button class="tab${x.id === m.id ? ' aktiv' : ''}" data-modul="${x.id}">
      <span>${x.label}</span><small>${x.kurz}</small>${x.status === 'entwurf' ? '<em class="beta">Entwurf</em>' : ''}
    </button>`,
  ).join('');

  renderFormular(el('formular'), [...m.gruppen, ...GEMEINSAME_GRUPPEN], profil);
  renderAngebote(el('angebote'), profil);

  const ctx = auswerten();
  el('ergebnis').innerHTML = renderErgebnis(ctx);
  el('kopfzeile').textContent = kopfText(ctx);
  speichern();
}

/* ----------------------------- Events ----------------------------- */

function bindeEvents() {
  el('module').addEventListener('click', (e) => {
    const b = e.target.closest('[data-modul]');
    if (b) wechsleModul(b.dataset.modul);
  });

  el('formular').addEventListener('input', (e) => {
    if (uebernimm(e.target, profil)) neuBerechnen();
  });
  el('formular').addEventListener('change', (e) => {
    if (e.target.dataset.typ === 'bool' || e.target.tagName === 'SELECT') {
      uebernimm(e.target, profil);
      rendern(); // Auswahl kann Felder ein-/ausblenden
    }
  });

  el('angebote').addEventListener('input', (e) => {
    if (e.target.dataset.ang !== undefined && uebernimmAngebot(e.target, profil)) neuBerechnen();
  });
  el('angebote').addEventListener('change', (e) => {
    if (e.target.name === 'aktives_angebot') {
      profil.finanzierung.aktives_angebot = e.target.value;
      rendern();
    }
  });
  el('angebote').addEventListener('click', (e) => {
    if (e.target.id === 'angebot-neu') {
      const n = profil.finanzierung.angebote.length + 1;
      profil.finanzierung.angebote.push({
        id: `a${Date.now().toString(36)}`,
        name: `Angebot ${n}`,
        sollzins_pct: 3.6,
        zinsbindung_jahre: 10,
        tilgung_pct: 2,
        sondertilgung_pct_pa: 5,
      });
      rendern();
    }
    const del = e.target.dataset.angDel;
    if (del !== undefined && profil.finanzierung.angebote.length > 1) {
      const [weg] = profil.finanzierung.angebote.splice(Number(del), 1);
      if (profil.finanzierung.aktives_angebot === weg.id) {
        profil.finanzierung.aktives_angebot = profil.finanzierung.angebote[0].id;
      }
      rendern();
    }
  });

  el('btn-import').addEventListener('click', () => el('dlg-import').showModal());
  el('btn-export').addEventListener('click', exportieren);
  el('btn-drucken').addEventListener('click', () => window.print());
  el('btn-reset').addEventListener('click', () => {
    if (confirm('Alle Eingaben zurücksetzen?')) {
      profil = merge(defaultProfil(), modul(profil.objekt.typ).defaults);
      rendern();
    }
  });

  // Import-Dialog
  el('imp-analyse').addEventListener('click', analysiereImport);
  el('imp-uebernehmen').addEventListener('click', uebernehmeImport);
  el('imp-datei').addEventListener('change', async (e) => {
    const datei = e.target.files?.[0];
    if (!datei) return;
    el('imp-text').value = await datei.text();
    analysiereImport();
  });
  el('imp-beispiele').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-beispiel]');
    if (!b) return;
    try {
      const res = await fetch(`samples/${b.dataset.beispiel}`);
      el('imp-text').value = JSON.stringify(await res.json(), null, 2);
      analysiereImport();
    } catch (err) {
      el('imp-report').innerHTML = `<p class="fehler">Beispiel konnte nicht geladen werden (${err.message}). Datei manuell einfügen.</p>`;
    }
  });

  const flaeche = el('drop');
  ['dragover', 'dragleave', 'drop'].forEach((typ) =>
    flaeche.addEventListener(typ, async (e) => {
      e.preventDefault();
      flaeche.classList.toggle('hover', typ === 'dragover');
      if (typ === 'drop') {
        const datei = e.dataTransfer.files?.[0];
        if (datei) {
          el('imp-text').value = await datei.text();
          analysiereImport();
        }
      }
    }),
  );
}

let timer = null;
function neuBerechnen() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    const ctx = auswerten();
    el('ergebnis').innerHTML = renderErgebnis(ctx);
    el('kopfzeile').textContent = kopfText(ctx);
    speichern();
  }, 120);
}

/* ----------------------------- Import ----------------------------- */

function analysiereImport() {
  const text = el('imp-text').value.trim();
  const adapterId = el('imp-adapter').value || undefined;
  if (!text) {
    el('imp-report').innerHTML = '<p class="fehler">Bitte JSON einfügen, Datei wählen oder ein Beispiel laden.</p>';
    return;
  }
  const r = importiere(text, profil, { adapterId });
  importErgebnis = r.ok ? r : null;
  el('imp-uebernehmen').disabled = !r.ok;

  if (!r.ok) {
    el('imp-report').innerHTML = `<p class="fehler">${r.fehler}</p>`;
    return;
  }

  const zeilen = r.report.gefunden
    .map((g) => {
      // Jahreszahlen, Zimmer & Co. nicht mit Tausenderpunkt anzeigen
      const w =
        typeof g.wert === 'number' && !(Number.isInteger(g.wert) && Math.abs(g.wert) < 10000)
          ? g.wert.toLocaleString('de-DE')
          : g.wert;
      return `<tr><td>${g.ziel}</td><td class="quelle">${g.quelle}</td><td class="num">${w}</td></tr>`;
    })
    .join('');

  el('imp-report').innerHTML = `
    <div class="imp-kopf">
      <strong>Erkannt: ${r.adapter.label}</strong>
      ${r.adapter.score !== null ? `<span class="tag">Sicherheit ${Math.round(r.adapter.score * 100)} %</span>` : ''}
      <span class="tag">${r.report.gefunden.length} Felder übernommen</span>
      ${r.modus === 'finanzierung' ? '<span class="tag">ersetzt nur die Finanzierung</span>' : ''}
    </div>
    ${
      r.report.warnungen.length
        ? `<ul class="warnungen">${r.report.warnungen.map((w) => `<li>${w}</li>`).join('')}</ul>`
        : ''
    }
    ${
      r.report.fehlend.length
        ? `<p class="fehlend"><strong>Nicht in den Daten enthalten</strong> – es gelten Standardwerte, bitte prüfen:<br>${r.report.fehlend
            .map((f) => `${f.label} <em>(${f.aktuell ?? '–'})</em>`)
            .join(' · ')}</p>`
        : ''
    }
    <details><summary>Feld-Zuordnung anzeigen</summary>
      <div class="tabelle-scroll"><table class="kompakt">
        <thead><tr><th>Zielfeld</th><th>Quelle im JSON</th><th class="num">Wert</th></tr></thead>
        <tbody>${zeilen}</tbody>
      </table></div>
    </details>`;
}

function uebernehmeImport() {
  if (!importErgebnis) return;
  profil = importErgebnis.profil;
  importErgebnis = null;
  el('dlg-import').close();
  el('imp-report').innerHTML = '';
  el('imp-text').value = '';
  el('imp-uebernehmen').disabled = true;
  rendern();
}

function exportieren() {
  const blob = new Blob([JSON.stringify(profil, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = (profil.meta.bezeichnung || profil.objekt.typ).replace(/[^\wäöüß\- ]/gi, '').trim() || 'objekt';
  a.href = url;
  a.download = `${name}.reip.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ----------------------------- Start ----------------------------- */

el('imp-adapter').innerHTML =
  '<option value="">automatisch erkennen</option>' +
  ADAPTER.map((a) => `<option value="${a.id}">${a.label}</option>`).join('');

bindeEvents();
rendern();
