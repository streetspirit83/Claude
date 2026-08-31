/**
 * Ergebnisdarstellung: Score, Kennzahlen, Ampeln, Hinweise, Vergleiche,
 * Cashflow-Tabelle, Sensitivitaet, Kaufen-vs-Mieten.
 */

import { eur, pct, zahl } from '../core/format.js';
import { kpiLabel, kpiWert, KPI_META } from './kpimeta.js';
import { linienChart, balkenChart } from './charts.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function kachel(key, kpi) {
  const meta = KPI_META[key] || {};
  const wert = kpi[key];
  const negativ =
    typeof wert === 'number' &&
    wert < 0 &&
    ['cf_monat_j1', 'gewinn_gesamt', 'cf_vor_steuer_j1', 'vorteil_kauf_ende'].includes(key);
  return `<div class="kachel${negativ ? ' negativ' : ''}"${meta.hinweis ? ` title="${esc(meta.hinweis)}"` : ''}>
    <span class="k-label">${esc(kpiLabel(key))}</span>
    <span class="k-wert">${esc(kpiWert(key, wert))}</span>
  </div>`;
}

function ampelZeile(b) {
  const ziel =
    b.status === 'neutral'
      ? 'keine Daten'
      : `Ziel ${b.richtung === 'tief' ? '≤' : '≥'} ${zahl(b.gruen, b.gruen % 1 ? 2 : 0)} ${(b.einheit ?? '').replace(/^x$/, '×')}`;
  return `<tr class="ampel-${b.status}">
    <td><span class="punkt"></span>${esc(b.label)}${b.hinweis ? `<span class="hint" title="${esc(b.hinweis)}">?</span>` : ''}</td>
    <td class="num">${esc(kpiWert(b.kpi, b.wert))}</td>
    <td class="ziel">${esc(ziel)}</td>
  </tr>`;
}

export function renderErgebnis(ctx) {
  const { profil, modulObj, kpiListe, proj, kpi, bewertungen, score, hinweise, vergleich, sens, eigen } = ctx;
  const jahre = proj.jahre;
  const xLabels = jahre.map((j) => String(j.jahr));

  const scoreKlasse = `score-${score.status}`;
  const kopf = `
    <div class="score ${scoreKlasse}">
      <div class="score-zahl">${score.score ?? '–'}<small>/100</small></div>
      <div class="score-text">
        <strong>${esc(modulObj.label)}${profil.meta.bezeichnung ? ` · ${esc(profil.meta.bezeichnung)}` : ''}</strong>
        <span>${score.rot ? `${score.rot} Kriterium/Kriterien im roten Bereich` : 'keine roten Kriterien'} · ${eur(kpi.gesamtinvest)} Gesamtinvest · ${eigen ? `${eur(kpi.wohnkosten_kauf_monat)}/Mon Wohnkosten` : `${eur(kpi.cf_monat_j1)}/Mon Cashflow`}</span>
      </div>
    </div>`;

  const kacheln = `<div class="kacheln">${(kpiListe || modulObj.kpis).map((k) => kachel(k, kpi)).join('')}</div>`;

  const ampeln = `
    <section class="block">
      <h2>Bewertung</h2>
      <table class="ampeln">
        <tbody>${bewertungen.map(ampelZeile).join('')}</tbody>
      </table>
    </section>`;

  const hinweisBlock = hinweise.length
    ? `<section class="block">
        <h2>Hinweise & Risiken</h2>
        <ul class="hinweise">
          ${hinweise.map((h) => `<li class="ampel-${h.status}"><span class="punkt"></span>${esc(h.text)}</li>`).join('')}
        </ul>
      </section>`
    : '';

  const vermoegenChart = linienChart(
    [
      { label: 'Objektwert', werte: jahre.map((j) => j.wert), klasse: 's0' },
      { label: 'Restschuld', werte: jahre.map((j) => j.restschuld), klasse: 's1' },
      { label: 'gebundenes Eigenkapital', werte: jahre.map((j) => j.eigenkapital_gebunden), klasse: 's2', flaeche: true },
    ],
    xLabels,
    { titel: 'Wert, Restschuld und Eigenkapital' },
  );

  const cfChart = balkenChart(
    jahre.map((j) => j.cf_nach_steuer),
    xLabels,
    { titel: eigen ? 'Jährliche Wohnkosten (Kapitaldienst + Bewirtschaftung)' : 'Cashflow nach Steuern je Jahr' },
  );

  const finanzierung = `
    <section class="block">
      <h2>Finanzierungsvergleich</h2>
      <div class="tabelle-scroll">
        <table>
          <thead><tr>
            <th>Angebot</th><th class="num">Zins</th><th class="num">Bindung</th><th class="num">Tilgung</th>
            <th class="num">Rate</th><th class="num">Restschuld Ende Bindung</th><th class="num">Zinsen gesamt</th>
            <th class="num">CF/Mon</th><th class="num">IRR</th>
          </tr></thead>
          <tbody>
            ${vergleich
              .map(
                (v) => `<tr${v.aktiv ? ' class="aktiv"' : ''}>
                  <td>${esc(v.name)}${v.aktiv ? ' <span class="tag">gewählt</span>' : ''}</td>
                  <td class="num">${pct(v.sollzins_pct, 2)}</td>
                  <td class="num">${zahl(v.zinsbindung_jahre, 0)} J</td>
                  <td class="num">${pct(v.tilgung_pct, 1)}</td>
                  <td class="num">${eur(v.rate_monat)}</td>
                  <td class="num">${eur(v.restschuld_zb)}</td>
                  <td class="num">${eur(v.zins_gesamt)}</td>
                  <td class="num${v.cf_monat < 0 ? ' negativ' : ''}">${eur(v.cf_monat)}</td>
                  <td class="num">${pct(v.irr_ek)}</td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
      <p class="fussnote">Das Darlehen ergibt sich aus Gesamtinvestition minus Eigenkapital (${eur(kpi.darlehen)}); die Angebote unterscheiden sich nur in den Konditionen.</p>
    </section>`;

  // Bei Eigennutzung zaehlen andere Spalten: Belastung und Vermoegensvergleich
  const sensSpalten = eigen
    ? [
        ['Wohnkosten/Mon', (s) => ({ text: eur(s.wohnkosten_monat) })],
        ['Belastung nach Zinsbindung', (s) => ({ text: eur(-s.cf_monat_nach_zb) })],
        ['Kauf lohnt ab', (s) => ({ text: s.breakeven_jahr ? `Jahr ${s.breakeven_jahr}` : 'nicht im Zeitraum' })],
        ['Vermögensvorteil Kauf', (s) => ({ text: eur(s.vorteil_kauf_ende), negativ: s.vorteil_kauf_ende < 0 })],
      ]
    : [
        ['CF/Mon Jahr 1', (s) => ({ text: eur(s.cf_monat_j1), negativ: s.cf_monat_j1 < 0 })],
        ['CF/Mon nach Zinsbindung', (s) => ({ text: eur(s.cf_monat_nach_zb), negativ: s.cf_monat_nach_zb < 0 })],
        ['DSCR', (s) => ({ text: zahl(s.dscr, 2) })],
        ['IRR', (s) => ({ text: pct(s.irr_ek) })],
        ['Vermögen Ende', (s) => ({ text: eur(s.vermoegen_ende) })],
      ];

  const sensitivitaet = `
    <section class="block">
      <h2>Sensitivität</h2>
      <div class="tabelle-scroll">
        <table>
          <thead><tr><th>Szenario</th>${sensSpalten.map(([t]) => `<th class="num">${esc(t)}</th>`).join('')}</tr></thead>
          <tbody>
            ${sens
              .map(
                (s) => `<tr${s.label === 'Basis' ? ' class="aktiv"' : ''}>
                  <td>${esc(s.label)}</td>
                  ${sensSpalten
                    .map(([, fn]) => {
                      const z = fn(s);
                      return `<td class="num${z.negativ ? ' negativ' : ''}">${esc(z.text)}</td>`;
                    })
                    .join('')}
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
      ${
        eigen
          ? ''
          : `<p class="fussnote">
              Bleibt die Rate nach der Zinsbindung unverändert, trifft ein höherer Zins zuerst die Tilgung –
              der Cashflow kann durch die höhere Steuererstattung sogar leicht steigen, während Restschuld und
              Endvermögen sich verschlechtern. Die Zeile „Rate angepasst“ hält stattdessen die Tilgung konstant
              und zeigt die Belastung im Cashflow.
            </p>`
      }
    </section>`;

  const eigenBlock =
    eigen && profil.ertrag.nutzung === 'eigennutzung'
      ? `<section class="block">
          <h2>Kaufen oder mieten?</h2>
          ${linienChart(
            [
              { label: 'Vermögen bei Kauf', werte: eigen.jahre.map((j) => j.vermoegen_kauf), klasse: 's0' },
              { label: 'Vermögen bei Miete + Anlage', werte: eigen.jahre.map((j) => j.vermoegen_miete), klasse: 's1' },
            ],
            xLabels,
            { titel: 'Vermögensentwicklung im Vergleich' },
          )}
          <p class="fussnote">Der Mieter legt sein Eigenkapital und die monatliche Kostendifferenz zu ${pct(profil.annahmen.alternativrendite_pa_pct)} p.a. an. Beim Kauf sind Verkaufskosten von ${pct(profil.annahmen.verkaufskosten_pct)} bereits abgezogen.</p>
        </section>`
      : '';

  const cfTabelle = `
    <details class="block">
      <summary><h2>Cashflow-Tabelle (${jahre.length} Jahre)</h2></summary>
      <div class="tabelle-scroll">
        <table class="kompakt">
          <thead><tr>
            <th>Jahr</th><th class="num">Miete</th><th class="num">Bewirtschaftung</th><th class="num">Zinsen</th>
            <th class="num">Tilgung</th><th class="num">AfA</th><th class="num">Steuer</th>
            <th class="num">CF n. St.</th><th class="num">Restschuld</th><th class="num">Objektwert</th>
          </tr></thead>
          <tbody>
            ${jahre
              .map(
                (j) => `<tr>
                  <td>${j.jahr}</td>
                  <td class="num">${eur(j.mieteinnahmen)}</td>
                  <td class="num">${eur(-j.bewirtschaftung)}</td>
                  <td class="num">${eur(-j.zinsen)}</td>
                  <td class="num">${eur(-j.tilgung)}</td>
                  <td class="num">${eur(j.afa)}</td>
                  <td class="num${j.steuer < 0 ? ' positiv' : ''}">${eur(-j.steuer)}</td>
                  <td class="num${j.cf_nach_steuer < 0 ? ' negativ' : ''}"><strong>${eur(j.cf_nach_steuer)}</strong></td>
                  <td class="num">${eur(j.restschuld)}</td>
                  <td class="num">${eur(j.wert)}</td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>
      <p class="fussnote">Verkauf im Jahr ${jahre.length}: ${eur(proj.verkauf.verkaufspreis)} abzüglich ${eur(proj.verkauf.verkaufskosten)} Verkaufskosten, ${eur(proj.verkauf.restschuld)} Restschuld${proj.verkauf.spekulationssteuer ? ` und ${eur(proj.verkauf.spekulationssteuer)} Spekulationssteuer` : ''} ⇒ ${eur(proj.verkauf.nettoerloes)} netto.</p>
    </details>`;

  const roadmap = modulObj.roadmap
    ? `<section class="block entwurf">
        <h2>Modul im Entwurfsstand</h2>
        <p>Diese Punkte fehlen noch und beeinflussen das Ergebnis:</p>
        <ul>${modulObj.roadmap.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
      </section>`
    : '';

  return `${kopf}${kacheln}${ampeln}${hinweisBlock}
    <section class="block">${vermoegenChart}${cfChart}</section>
    ${finanzierung}${sensitivitaet}${eigenBlock}${cfTabelle}${roadmap}`;
}
