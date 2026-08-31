/**
 * Smoke-Tests des Rechenkerns: node tests/run.mjs
 * Kein Framework, keine Abhaengigkeiten – laeuft mit blankem Node.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { defaultProfil, merge, get, set } from '../src/core/schema.js';
import { investition, tilgungsplan, irr, darlehensbedarf } from '../src/core/finance.js';
import { afaBasis, afaJahr } from '../src/core/tax.js';
import { projektion, jahresbasis } from '../src/core/cashflow.js';
import { kennzahlen, sensitivitaet } from '../src/core/kpi.js';
import { bewerte, gesamtscore, pruefe } from '../src/core/scoring.js';
import { kaufenVsMieten } from '../src/core/eigennutzung.js';
import { zuZahl, zuBool } from '../src/import/parse.js';
import { importiere } from '../src/import/import.js';
import { MODUL_LISTE, modul, extraKpis } from '../src/modules/registry.js';
import { regelnFuer, kpisFuer, eigennutzungKpis } from '../src/modules/nutzung.js';

let bestanden = 0;
let fehlgeschlagen = 0;
const test = (name, fn) => {
  try {
    fn();
    bestanden++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    fehlgeschlagen++;
    console.log(`  FAIL ${name}\n       ${e.message}`);
  }
};
const nahe = (a, b, tol, msg) =>
  assert.ok(Math.abs(a - b) <= tol, `${msg || ''} erwartet ~${b}, war ${a}`);

const lade = (datei) => JSON.parse(readFileSync(new URL(`../samples/${datei}`, import.meta.url)));

console.log('\nZahlen-Parser');
test('deutsche und englische Formate', () => {
  assert.equal(zuZahl('320.000 €'), 320000);
  assert.equal(zuZahl('1.234,56'), 1234.56);
  assert.equal(zuZahl('3,65 %'), 3.65);
  assert.equal(zuZahl('78,5 m²'), 78.5);
  assert.equal(zuZahl('3.65'), 3.65);
  assert.equal(zuZahl(2500), 2500);
  assert.equal(zuZahl('ca. 620 m²'), 620);
  assert.equal(zuZahl({ value: '289.000 €', currency: 'EUR' }), 289000);
  assert.equal(zuZahl(''), null);
  assert.equal(zuBool('ja'), true);
  assert.equal(zuBool('nein'), false);
});

console.log('\nInvestition & Finanzierung');
test('Nebenkosten und Gesamtinvestition', () => {
  const p = defaultProfil();
  p.kauf = { ...p.kauf, kaufpreis: 300000, grunderwerbsteuer_pct: 5, notar_pct: 1.5, makler_pct: 3.57, modernisierung: 10000 };
  const i = investition(p);
  nahe(i.nebenkosten, 300000 * 0.1007, 1, 'Nebenkosten');
  nahe(i.gesamt, 300000 + 30210 + 10000, 1, 'Gesamtinvest');
  nahe(i.nebenkosten_pct, 10.07, 0.01);
});

test('Annuitaet und Tilgungsverlauf', () => {
  const plan = tilgungsplan({
    darlehen: 250000,
    sollzinsPct: 3.5,
    tilgungPct: 2,
    zinsbindungJahre: 10,
    anschlusszinsPct: 3.5,
    jahre: 10,
  });
  nahe(plan.rate_monat_start, (250000 * 0.055) / 12, 0.01, 'Rate');
  // Restschuld nach 10 Jahren bei 3,5/2,0 liegt bei rund 190-195k
  assert.ok(plan.restschuld_ende < 250000, 'Restschuld muss sinken');
  nahe(plan.restschuld_ende, 191000, 4000, 'Restschuld nach 10 J');
  // Zinsanteil sinkt, Tilgungsanteil steigt
  assert.ok(plan.jahre[9].zinsen < plan.jahre[0].zinsen);
  assert.ok(plan.jahre[9].tilgung > plan.jahre[0].tilgung);
  // Summe der Jahreswerte konsistent
  const summeTilgung = plan.jahre.reduce((s, j) => s + j.tilgung + j.sondertilgung, 0);
  nahe(250000 - summeTilgung, plan.restschuld_ende, 1, 'Tilgungssumme');
});

test('Volltilgung wird erkannt', () => {
  const plan = tilgungsplan({
    darlehen: 100000, sollzinsPct: 4, tilgungPct: 6, zinsbindungJahre: 20, anschlusszinsPct: 4, jahre: 40,
  });
  assert.ok(plan.volltilgung_jahr && plan.volltilgung_jahr < 20, `Volltilgung in Jahr ${plan.volltilgung_jahr}`);
  assert.equal(Math.round(plan.restschuld_ende), 0);
});

test('Anschlusszins wirkt nach Zinsbindung', () => {
  const basis = { darlehen: 200000, sollzinsPct: 3, tilgungPct: 2, zinsbindungJahre: 10, jahre: 20 };
  const guenstig = tilgungsplan({ ...basis, anschlusszinsPct: 3 });
  const teuer = tilgungsplan({ ...basis, anschlusszinsPct: 6 });
  assert.ok(teuer.restschuld_ende > guenstig.restschuld_ende, 'hoeherer Zins -> mehr Restschuld');
  nahe(teuer.restschuld_ende_zinsbindung, guenstig.restschuld_ende_zinsbindung, 1, 'bis Zinsbindung identisch');
});

test('Sondertilgung verkuerzt die Laufzeit', () => {
  const ohne = tilgungsplan({ darlehen: 200000, sollzinsPct: 3.5, tilgungPct: 2, zinsbindungJahre: 15, anschlusszinsPct: 4, jahre: 15 });
  const mit = tilgungsplan({ darlehen: 200000, sollzinsPct: 3.5, tilgungPct: 2, zinsbindungJahre: 15, anschlusszinsPct: 4, jahre: 15, sondertilgungPctPa: 5 });
  assert.ok(mit.restschuld_ende < ohne.restschuld_ende);
});

test('IRR', () => {
  nahe(irr([-100, 110]) * 100, 10, 0.01);
  nahe(irr([-1000, 500, 500, 500]) * 100, 23.375, 0.1);
  assert.equal(irr([100, 100]), null, 'ohne Vorzeichenwechsel kein IRR');
});

console.log('\nProjektion & Kennzahlen');
const beispiel = () => {
  const p = merge(defaultProfil(), modul('wohnung').defaults);
  p.kauf.kaufpreis = 289000;
  p.objekt.wohnflaeche = 78.5;
  p.ertrag.kaltmiete_monat = 845;
  p.kosten.hausgeld_monat = 268;
  p.kosten.nicht_umlagefaehig_monat = 95;
  p.finanzierung.eigenkapital = 70000;
  p.annahmen.betrachtungsdauer_jahre = 15;
  return p;
};

test('Jahresbasis und NOI', () => {
  const p = beispiel();
  const b = jahresbasis(p);
  nahe(b.miete_brutto, 845 * 12, 0.01);
  nahe(b.mieteinnahmen, 845 * 12 * 0.98, 0.01, 'Leerstand 2 %');
  nahe(b.instandhaltung, 12 * 78.5, 0.01);
  assert.ok(b.noi < b.mieteinnahmen);
});

test('Projektion ist in sich konsistent', () => {
  const p = beispiel();
  const proj = projektion(p);
  assert.equal(proj.jahre.length, 15);
  for (const j of proj.jahre) {
    nahe(j.kapitaldienst, j.zinsen + j.tilgung, 0.01, `Jahr ${j.jahr} Kapitaldienst`);
    nahe(j.cf_vor_steuer, j.noi - j.kapitaldienst, 0.01, `Jahr ${j.jahr} CF`);
    nahe(j.cf_nach_steuer, j.cf_vor_steuer - j.steuer, 0.01);
  }
  assert.ok(proj.jahre[14].restschuld < proj.jahre[0].restschuld);
  assert.ok(proj.jahre[14].wert > proj.jahre[0].wert, 'Wertsteigerung');
});

test('Kennzahlen plausibel', () => {
  const p = beispiel();
  const k = kennzahlen(p);
  nahe(k.kaufpreisfaktor, 289000 / (845 * 12), 0.01);
  nahe(k.bruttomietrendite, ((845 * 12) / 289000) * 100, 0.01);
  nahe(k.preis_qm, 289000 / 78.5, 0.01);
  assert.ok(k.gesamtinvest > 289000);
  assert.ok(k.darlehen === k.gesamtinvest - 70000);
  assert.ok(k.dscr > 0 && k.dscr < 3);
  assert.ok(k.break_even_miete_monat > 0);
  assert.ok(k.irr_ek !== null);
});

test('Steuer: Vermietung vs. Eigennutzung', () => {
  const p = beispiel();
  assert.ok(afaJahr(p) > 0, 'AfA bei Vermietung');
  nahe(afaBasis(p), (investition(p).kaufpreis + investition(p).nebenkosten) * 0.8 + 0, 1);

  const eigen = beispiel();
  eigen.ertrag.nutzung = 'eigennutzung';
  assert.equal(afaJahr(eigen), 0, 'keine AfA bei Eigennutzung');
  const projE = projektion(eigen);
  assert.equal(projE.jahre[0].steuer, 0);
  assert.equal(projE.jahre[0].mieteinnahmen, 0);
});

test('Verkauf: Spekulationsfrist', () => {
  const kurz = beispiel();
  kurz.annahmen.betrachtungsdauer_jahre = 8;
  const lang = beispiel();
  lang.annahmen.betrachtungsdauer_jahre = 12;
  assert.ok(projektion(kurz).verkauf.spekulationssteuer > 0, 'innerhalb 10 Jahre steuerpflichtig');
  assert.equal(projektion(lang).verkauf.spekulationssteuer, 0, 'nach 10 Jahren steuerfrei');
});

test('Sensitivitaet reagiert richtig', () => {
  const s = sensitivitaet(beispiel());
  const basis = s.find((x) => x.label === 'Basis');
  const wenigerMiete = s.find((x) => x.label === 'Miete -10 %');
  const hoehererZins = s.find((x) => x.label === 'Anschlusszins +2 pp');
  const zinsRate = s.find((x) => x.label === 'Anschlusszins +2 pp, Rate angepasst');
  assert.ok(wenigerMiete.cf_monat_j1 < basis.cf_monat_j1);
  // Bei gleichbleibender Annuitaet trifft der hoehere Zins die Tilgung,
  // nicht den Cashflow – sichtbar wird er im Endvermoegen und im IRR.
  assert.ok(hoehererZins.vermoegen_ende < basis.vermoegen_ende, 'Endvermoegen sinkt');
  assert.ok(hoehererZins.irr_ek < basis.irr_ek, 'IRR sinkt');
  // Wird die Rate angepasst, schlaegt der Zins direkt in den Cashflow durch
  assert.ok(zinsRate.cf_monat_nach_zb < basis.cf_monat_nach_zb, 'CF nach Zinsbindung sinkt');
});

console.log('\nEigennutzung');
test('Kaufen vs. Mieten', () => {
  const p = beispiel();
  p.ertrag.nutzung = 'eigennutzung';
  p.annahmen.vergleichsmiete_monat = 1100;
  const v = kaufenVsMieten(p);
  assert.equal(v.jahre.length, 15);
  assert.ok(v.jahre[0].wohnkosten_kauf_monat > 0);
  assert.ok(v.jahre.at(-1).vermoegen_kauf > v.jahre[0].vermoegen_kauf, 'Vermoegen waechst durch Tilgung');
  // Bei sehr hoher Alternativrendite muss Mieten besser dastehen
  const p2 = { ...p, annahmen: { ...p.annahmen, alternativrendite_pa_pct: 15 } };
  assert.ok(kaufenVsMieten(p2).vorteil_ende < v.vorteil_ende);
});

test('Eigennutzung: eigenes Regelwerk statt Mietkennzahlen', () => {
  const p = beispiel();
  p.ertrag.nutzung = 'eigennutzung';
  p.annahmen.vergleichsmiete_monat = 1100;
  const proj = projektion(p);
  const eigen = kaufenVsMieten(p, proj);
  const kpi = { ...kennzahlen(p, proj), ...eigennutzungKpis(eigen) };
  const regeln = regelnFuer(modul('wohnung'), p);
  const ids = regeln.map((r) => r.id);
  assert.ok(!ids.includes('faktor') && !ids.includes('dscr') && !ids.includes('cf'), 'Mietkriterien entfernt');
  assert.ok(ids.includes('vorteil') && ids.includes('breakeven'), 'Eigennutzungskriterien ergänzt');
  const bew = bewerte(regeln, kpi);
  assert.equal(bew.filter((b) => b.status === 'neutral' && b.kpi !== 'breakeven_jahr').length, 0, 'alle Regeln bewertbar');
  for (const key of kpisFuer(modul('wohnung'), p)) assert.ok(key in kpi, `KPI "${key}" fehlt`);
  // bei Vermietung bleibt das Standardregelwerk
  assert.deepEqual(regelnFuer(modul('wohnung'), beispiel()), modul('wohnung').regeln);
});

console.log('\nModule & Bewertung');
test('jedes Modul rechnet durch und bewertet', () => {
  for (const m of MODUL_LISTE) {
    const p = merge(defaultProfil(), m.defaults);
    const proj = projektion(p);
    const kpi = { ...kennzahlen(p, proj), ...extraKpis(m.id, p, proj) };
    const bew = bewerte(m.regeln, kpi);
    const score = gesamtscore(bew);
    const hinweise = pruefe(m.pruefungen, { profil: p, proj, kpi });
    assert.ok(bew.length === m.regeln.length, `${m.id}: Regeln`);
    assert.ok(score.score === null || (score.score >= 0 && score.score <= 100), `${m.id}: Score ${score.score}`);
    assert.ok(Array.isArray(hinweise), `${m.id}: Hinweise`);
    assert.ok(!hinweise.some((h) => h.text.startsWith('Check fehlgeschlagen')), `${m.id}: ${JSON.stringify(hinweise.find((h) => h.text.startsWith('Check fehlgeschlagen')))}`);
    // alle in kpis[] gelisteten Kennzahlen existieren auch
    for (const key of m.kpis) assert.ok(key in kpi, `${m.id}: KPI "${key}" fehlt`);
  }
});

test('Grundstueck: kein Ertrag, keine AfA', () => {
  const p = merge(defaultProfil(), modul('grundstueck').defaults);
  const proj = projektion(p);
  assert.equal(proj.jahre[0].mieteinnahmen, 0);
  assert.equal(proj.jahre[0].afa, 0);
  assert.equal(proj.jahre[0].steuer, 0);
  const kpi = { ...kennzahlen(p, proj), ...extraKpis('grundstueck', p, proj) };
  nahe(kpi.preis_qm_grund, p.kauf.kaufpreis / p.objekt.grundstuecksflaeche, 0.01);
  nahe(kpi.moegliche_geschossflaeche, 600 * 0.8, 0.01);
});

test('Ampel-Schwellen', () => {
  const regeln = [
    { id: 'a', label: 'hoch besser', kpi: 'x', richtung: 'hoch', gruen: 5, gelb: 2 },
    { id: 'b', label: 'tief besser', kpi: 'y', richtung: 'tief', gruen: 25, gelb: 30 },
    { id: 'c', label: 'fehlt', kpi: 'z', richtung: 'hoch', gruen: 1, gelb: 0 },
  ];
  const b = bewerte(regeln, { x: 6, y: 28, z: null });
  assert.equal(b[0].status, 'gruen');
  assert.equal(b[1].status, 'gelb');
  assert.equal(b[2].status, 'neutral');
  const s = gesamtscore(b);
  assert.equal(s.anzahl, 2);
  assert.equal(s.score, 75);
});

console.log('\nImport');
test('Wohnungs-Exposé', () => {
  const r = importiere(lade('wohnung-expose.json'), defaultProfil());
  assert.ok(r.ok, r.fehler);
  assert.equal(r.adapter.id, 'expose');
  assert.equal(r.profil.objekt.typ, 'wohnung');
  assert.equal(r.profil.kauf.kaufpreis, 289000);
  assert.equal(r.profil.objekt.wohnflaeche, 78.5);
  assert.equal(r.profil.ertrag.kaltmiete_monat, 845);
  assert.equal(r.profil.kosten.hausgeld_monat, 268);
  assert.equal(r.profil.objekt.baujahr, 1972);
  assert.equal(r.profil.objekt.energie.klasse, 'E');
  assert.equal(r.profil.kauf.makler_pct, 3.57);
  assert.equal(r.profil.kauf.modernisierung, 15000);
  assert.equal(r.profil.objekt.adresse.ort, 'Köln');
  assert.ok(r.report.gefunden.length > 10);
  // rechnet anschliessend durch
  assert.ok(kennzahlen(r.profil).kaufpreisfaktor > 0);
});

test('Grundstuecks-Exposé', () => {
  const r = importiere(lade('grundstueck-expose.json'), defaultProfil());
  assert.ok(r.ok, r.fehler);
  assert.equal(r.profil.objekt.typ, 'grundstueck');
  assert.equal(r.profil.ertrag.nutzung, 'keine');
  assert.equal(r.profil.objekt.grundstuecksflaeche, 620);
  assert.equal(r.profil.objekt.bodenrichtwert_eur_qm, 245);
  assert.equal(r.profil.objekt.gfz, 0.8);
  assert.equal(r.profil.kauf.erschliessungskosten, 18500);
  assert.equal(r.profil.objekt.altlasten_verdacht, false);
});

test('EFH-Exposé', () => {
  const r = importiere(lade('efh-expose.json'), defaultProfil());
  assert.ok(r.ok, r.fehler);
  assert.equal(r.profil.objekt.typ, 'efh');
  assert.equal(r.profil.objekt.grundstuecksflaeche, 540);
  assert.equal(r.profil.kosten.instandhaltung_eur_qm_jahr, 15, 'EFH-Default greift');
});

test('Finanzierungsangebote ersetzen nur die Finanzierung', () => {
  const objekt = importiere(lade('wohnung-expose.json'), defaultProfil()).profil;
  const r = importiere(lade('finanzierungsangebote.json'), objekt);
  assert.ok(r.ok, r.fehler);
  assert.equal(r.adapter.id, 'finanzierung');
  assert.equal(r.modus, 'finanzierung');
  assert.equal(r.profil.finanzierung.angebote.length, 3);
  assert.equal(r.profil.kauf.kaufpreis, 289000, 'Objektdaten bleiben erhalten');
  const a = r.profil.finanzierung.angebote[0];
  assert.equal(a.sollzins_pct, 3.49);
  assert.equal(a.zinsbindung_jahre, 10);
  assert.equal(a.tilgung_pct, 2);
  assert.equal(r.profil.finanzierung.angebote[1].zinsbindung_jahre, 15);
  // Vergleich der Angebote liefert unterschiedliche Raten
  const raten = r.profil.finanzierung.angebote.map((ang) => projektion(r.profil, ang).plan.rate_monat_start);
  assert.ok(new Set(raten.map((x) => Math.round(x))).size === 3, 'drei verschiedene Raten');
});

test('natives Profil (Round-Trip)', () => {
  const p = beispiel();
  p.meta.bezeichnung = 'Testobjekt';
  const r = importiere(JSON.stringify(p), defaultProfil());
  assert.ok(r.ok, r.fehler);
  assert.equal(r.adapter.id, 'reip');
  assert.equal(r.profil.meta.bezeichnung, 'Testobjekt');
  assert.equal(r.profil.kauf.kaufpreis, 289000);
});

test('fehlerhafte Eingaben werden abgefangen', () => {
  assert.equal(importiere('kein json', defaultProfil()).ok, false);
  assert.equal(importiere('[]', defaultProfil()).ok, true, 'leeres Array: Adapter greift, Report meldet Luecken');
  const r = importiere({ irgendwas: 1 }, defaultProfil());
  assert.ok(r.report.fehlend.length > 0, 'fehlende Pflichtfelder werden gemeldet');
});

console.log('\nSchema-Helfer');
test('get/set/merge', () => {
  const o = { a: { b: 1 } };
  assert.equal(get(o, 'a.b'), 1);
  set(o, 'a.c.d', 5);
  assert.equal(o.a.c.d, 5);
  const m = merge({ x: 1, y: { z: 2, w: 3 } }, { y: { z: 9 } });
  assert.deepEqual(m, { x: 1, y: { z: 9, w: 3 } });
});

console.log(`\n${bestanden} bestanden, ${fehlgeschlagen} fehlgeschlagen\n`);
process.exit(fehlgeschlagen ? 1 : 0);
