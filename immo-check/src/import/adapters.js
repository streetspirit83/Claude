/**
 * Import-Adapter.
 *
 * Ein Adapter kennt genau eine Quelle und uebersetzt sie ins kanonische
 * Profil. Neue Quelle = neuer Adapter in dieser Datei, sonst aendert sich
 * nichts. Jeder Adapter liefert:
 *   erkennt(raw) -> 0..1   (wie sicher passt diese Quelle?)
 *   mappe(raw)   -> { patch, gefunden[], warnungen[] }
 */

import { flatten, finde, zuZahl, zuBool, zuText, normKey } from './parse.js';

/* ---------------------------------------------------------------- */
/* Feld-Aliase: eine Zeile pro Zielfeld im kanonischen Profil        */
/* ---------------------------------------------------------------- */

const FELDER = [
  { ziel: 'kauf.kaufpreis', typ: 'zahl', aliase: ['kaufpreis', 'preis', 'price', 'purchasePrice', 'kaufpreisEuro', 'angebotspreis', 'objektpreis'] },
  { ziel: 'objekt.wohnflaeche', typ: 'zahl', aliase: ['wohnflaeche', 'wohnflaecheQm', 'livingSpace', 'flaeche', 'wohnnutzflaeche', 'area'] },
  { ziel: 'objekt.grundstuecksflaeche', typ: 'zahl', aliase: ['grundstuecksflaeche', 'grundstueck', 'plotArea', 'landArea', 'grundflaeche'] },
  { ziel: 'objekt.zimmer', typ: 'zahl', aliase: ['zimmer', 'anzahlZimmer', 'numberOfRooms', 'rooms', 'zimmeranzahl'] },
  { ziel: 'objekt.baujahr', typ: 'zahl', aliase: ['baujahr', 'constructionYear', 'yearBuilt', 'baujahrSaniert'] },
  { ziel: 'objekt.etage', typ: 'zahl', aliase: ['etage', 'geschoss', 'floor'] },
  { ziel: 'objekt.adresse.strasse', typ: 'text', aliase: ['strasse', 'street', 'adresse', 'address'] },
  { ziel: 'objekt.adresse.plz', typ: 'text', aliase: ['plz', 'postleitzahl', 'postcode', 'zipCode', 'postalCode'] },
  { ziel: 'objekt.adresse.ort', typ: 'text', aliase: ['ort', 'stadt', 'city', 'gemeinde'] },
  { ziel: 'objekt.energie.kennwert', typ: 'zahl', aliase: ['energiekennwert', 'energieverbrauchskennwert', 'endenergiebedarf', 'energyConsumption', 'energiewert'] },
  { ziel: 'objekt.energie.klasse', typ: 'text', aliase: ['energieklasse', 'energieeffizienzklasse', 'energyClass', 'effizienzklasse'] },
  { ziel: 'objekt.energie.traeger', typ: 'text', aliase: ['energietraeger', 'heizungsart', 'befeuerung', 'heatingType'] },
  { ziel: 'objekt.bodenrichtwert_eur_qm', typ: 'zahl', aliase: ['bodenrichtwert', 'brw', 'bodenwertQm'] },
  { ziel: 'objekt.grz', typ: 'zahl', aliase: ['grz', 'grundflaechenzahl'] },
  { ziel: 'objekt.gfz', typ: 'zahl', aliase: ['gfz', 'geschossflaechenzahl'] },
  { ziel: 'ertrag.kaltmiete_monat', typ: 'zahl', aliase: ['kaltmiete', 'nettokaltmiete', 'miete', 'mieteinnahmen', 'baseRent', 'istmiete', 'monatsmiete'] },
  { ziel: 'ertrag.miete_marktueblich_monat', typ: 'zahl', aliase: ['marktmiete', 'vergleichsmiete', 'sollmiete', 'zielmiete'] },
  { ziel: 'ertrag.stellplatzmiete_monat', typ: 'zahl', aliase: ['stellplatzmiete', 'garagenmiete', 'parkingRent'] },
  { ziel: 'kosten.hausgeld_monat', typ: 'zahl', aliase: ['hausgeld', 'wohngeld', 'serviceCharge', 'nebenkosten'] },
  { ziel: 'kosten.grundsteuer_jahr', typ: 'zahl', aliase: ['grundsteuer', 'propertyTax'] },
  { ziel: 'kauf.makler_pct', typ: 'zahl', aliase: ['courtage', 'provision', 'maklerprovision', 'courtageProzent'] },
  { ziel: 'kauf.modernisierung', typ: 'zahl', aliase: ['modernisierungsbedarf', 'renovierungsbedarf', 'sanierungskosten', 'investitionsbedarf'] },
  { ziel: 'kauf.erschliessungskosten', typ: 'zahl', aliase: ['erschliessungskosten', 'erschliessungsbeitrag'] },
  { ziel: 'kauf.baukosten', typ: 'zahl', aliase: ['baukosten', 'bausumme', 'hauspreis', 'werkvertragssumme'] },
  { ziel: 'meta.bezeichnung', typ: 'text', aliase: ['titel', 'title', 'bezeichnung', 'objektname', 'headline', 'name'] },
  { ziel: 'objekt.erbbaurecht', typ: 'bool', aliase: ['erbbaurecht', 'erbpacht', 'leasehold'] },
  { ziel: 'objekt.altlasten_verdacht', typ: 'bool', aliase: ['altlasten', 'altlastenverdacht'] },
];

const OBJEKTTYP_MAP = [
  { re: /(etagen|eigentums|dachgeschoss|maisonette|penthouse|apartment|wohnung|flat)/i, typ: 'wohnung' },
  { re: /(einfamilien|reihenhaus|doppelhaus|stadthaus|bungalow|villa|haus|house)/i, typ: 'efh' },
  { re: /(grundstueck|grundstück|bauplatz|baugrundstueck|bauland|plot|land)/i, typ: 'grundstueck' },
  { re: /(neubau|bauvorhaben|newbuild|projektierung)/i, typ: 'neubau' },
];

function erkenneTyp(flat) {
  const kandidaten = ['objektart', 'objekttyp', 'typ', 'type', 'realEstateType', 'kategorie', 'titel', 'title'];
  for (const k of kandidaten) {
    const t = finde(flat, [k]);
    const s = zuText(t?.wert);
    if (!s) continue;
    const treffer = OBJEKTTYP_MAP.find((m) => m.re.test(s));
    if (treffer) return { typ: treffer.typ, quelle: t.pfad, roh: s };
  }
  return null;
}

function setzeTief(obj, pfad, wert) {
  const teile = pfad.split('.');
  const letzter = teile.pop();
  const ziel = teile.reduce((o, k) => (o[k] = o[k] ?? {}), obj);
  ziel[letzter] = wert;
}

function konvertiere(typ, wert) {
  if (typ === 'zahl') return zuZahl(wert);
  if (typ === 'bool') return zuBool(wert);
  return zuText(wert);
}

/** Gemeinsame Mapping-Logik fuer alle Exposé-artigen Quellen. */
function mappeExpose(raw) {
  const flat = flatten(raw);
  const patch = {};
  const gefunden = [];
  const warnungen = [];

  for (const feld of FELDER) {
    const treffer = finde(flat, feld.aliase);
    if (!treffer) continue;
    const wert = konvertiere(feld.typ, treffer.wert);
    if (wert === null) {
      warnungen.push(`Feld "${treffer.pfad}" konnte nicht gelesen werden (Wert: ${JSON.stringify(treffer.wert)}).`);
      continue;
    }
    setzeTief(patch, feld.ziel, wert);
    gefunden.push({ ziel: feld.ziel, quelle: treffer.pfad, wert });
  }

  const typ = erkenneTyp(flat);
  if (typ) {
    setzeTief(patch, 'objekt.typ', typ.typ);
    gefunden.push({ ziel: 'objekt.typ', quelle: typ.quelle, wert: `${typ.typ} (aus "${typ.roh}")` });
    if (typ.typ === 'grundstueck') setzeTief(patch, 'ertrag.nutzung', 'keine');
  } else {
    warnungen.push('Objekttyp nicht erkannt – bitte oben manuell wählen.');
  }

  // Eine gefundene Markt-/Vergleichsmiete ist auch der Maßstab fuer den
  // Kaufen-vs-Mieten-Vergleich bei Eigennutzung.
  const marktmiete = patch.ertrag?.miete_marktueblich_monat;
  if (marktmiete && !patch.annahmen?.vergleichsmiete_monat) {
    setzeTief(patch, 'annahmen.vergleichsmiete_monat', marktmiete);
    gefunden.push({
      ziel: 'annahmen.vergleichsmiete_monat',
      quelle: '(abgeleitet aus Marktmiete)',
      wert: marktmiete,
    });
  }

  // Plausibilitaet: Jahresmiete faelschlich als Monatsmiete importiert?
  const miete = patch.ertrag?.kaltmiete_monat;
  const preis = patch.kauf?.kaufpreis;
  if (miete && preis && miete * 12 > preis * 0.15) {
    warnungen.push('Die gefundene Miete wirkt wie eine Jahresmiete – bitte prüfen (erwartet wird €/Monat).');
  }
  if (patch.kauf?.makler_pct > 15) {
    warnungen.push('Courtage wurde als Betrag statt als Prozentsatz erkannt – bitte prüfen.');
  }

  return { patch, gefunden, warnungen };
}

/* ---------------------------------------------------------------- */
/* Finanzierungsangebote                                             */
/* ---------------------------------------------------------------- */

const FIN_FELDER = {
  name: ['bank', 'anbieter', 'institut', 'name', 'produkt', 'darlehensgeber'],
  sollzins_pct: ['sollzins', 'nominalzins', 'zinssatz', 'debitZins', 'sollzinssatz', 'interestRate'],
  effektivzins_pct: ['effektivzins', 'effektiverJahreszins', 'effZins'],
  zinsbindung_jahre: ['zinsbindung', 'sollzinsbindung', 'zinsfestschreibung', 'fixedRateYears', 'laufzeitZinsbindung'],
  tilgung_pct: ['tilgung', 'anfangstilgung', 'tilgungssatz', 'repaymentRate'],
  sondertilgung_pct_pa: ['sondertilgung', 'sondertilgungsrecht'],
  darlehensbetrag: ['darlehensbetrag', 'darlehen', 'nettodarlehensbetrag', 'kreditbetrag', 'loanAmount'],
  rate_monat: ['rate', 'monatsrate', 'annuitaet', 'monatlicheRate', 'monthlyPayment'],
};

function mappeAngebot(raw, idx) {
  const flat = flatten(raw);
  const angebot = { id: `imp${idx + 1}`, notiz: 'importiert' };
  const gefunden = [];
  for (const [ziel, aliase] of Object.entries(FIN_FELDER)) {
    const treffer = finde(flat, aliase);
    if (!treffer) continue;
    const wert = ziel === 'name' ? zuText(treffer.wert) : zuZahl(treffer.wert);
    if (wert === null) continue;
    angebot[ziel] = wert;
    gefunden.push({ ziel: `finanzierung.angebote[].${ziel}`, quelle: treffer.pfad, wert });
  }
  angebot.name = angebot.name || `Angebot ${idx + 1}`;
  return { angebot, gefunden };
}

function findeAngebotsListe(raw) {
  if (Array.isArray(raw)) return raw;
  for (const k of ['angebote', 'finanzierungsangebote', 'offers', 'darlehen', 'varianten', 'konditionen']) {
    const v = raw?.[k];
    if (Array.isArray(v)) return v;
  }
  if (raw?.finanzierung && Array.isArray(raw.finanzierung.angebote)) return raw.finanzierung.angebote;
  return null;
}

function hatFinanzKeys(raw) {
  const flat = flatten(raw);
  const treffer = ['sollzins', 'nominalzins', 'zinsbindung', 'anfangstilgung', 'effektivzins'].filter((k) =>
    flat.has(normKey(k)),
  );
  return treffer.length;
}

/* ---------------------------------------------------------------- */
/* Adapter                                                           */
/* ---------------------------------------------------------------- */

export const ADAPTER = [
  {
    id: 'reip',
    label: 'Natives Profil (reip/v1)',
    beschreibung: 'Vollständiges Profil, wie dieses Tool es exportiert.',
    erkennt: (raw) => (typeof raw?.schema === 'string' && raw.schema.startsWith('reip/') ? 1 : 0),
    mappe: (raw) => ({
      patch: raw,
      gefunden: [{ ziel: '(komplettes Profil)', quelle: 'schema', wert: raw.schema }],
      warnungen: [],
    }),
  },
  {
    id: 'finanzierung',
    label: 'Finanzierungsangebot(e)',
    beschreibung: 'Bank-/Vermittlerangebot mit Sollzins, Zinsbindung, Tilgung – auch als Liste.',
    erkennt: (raw) => {
      const liste = findeAngebotsListe(raw);
      const basis = hatFinanzKeys(raw) >= 2 ? 0.6 : 0;
      if (liste?.length && liste.some((x) => hatFinanzKeys(x) >= 2)) return 0.95;
      // reine Angebotsdatei (keine Objektdaten)
      const flat = flatten(raw);
      const hatObjekt = ['kaufpreis', 'wohnflaeche', 'objektart'].some((k) => flat.has(normKey(k)));
      return hatObjekt ? Math.min(basis, 0.4) : basis;
    },
    mappe: (raw) => {
      const liste = findeAngebotsListe(raw) || [raw];
      const gefunden = [];
      const angebote = liste.map((eintrag, i) => {
        const r = mappeAngebot(eintrag, i);
        gefunden.push(...r.gefunden);
        return r.angebot;
      });
      const warnungen = [];
      for (const a of angebote) {
        if (!a.sollzins_pct) warnungen.push(`"${a.name}": kein Sollzins gefunden.`);
        if (!a.zinsbindung_jahre) warnungen.push(`"${a.name}": keine Zinsbindung gefunden – 10 Jahre angenommen.`);
        if (!a.tilgung_pct) warnungen.push(`"${a.name}": keine Tilgung gefunden – 2 % angenommen.`);
        a.zinsbindung_jahre = a.zinsbindung_jahre || 10;
        a.tilgung_pct = a.tilgung_pct || 2;
        a.sollzins_pct = a.sollzins_pct || 0;
      }
      const patch = { finanzierung: { angebote, aktives_angebot: angebote[0]?.id } };
      const mitBetrag = angebote.find((a) => a.darlehensbetrag);
      if (mitBetrag) {
        warnungen.push(
          `Darlehensbetrag ${Math.round(mitBetrag.darlehensbetrag).toLocaleString('de-DE')} € aus dem Angebot: das Tool leitet das Darlehen aus Gesamtinvest minus Eigenkapital ab – Eigenkapital ggf. anpassen.`,
        );
      }
      return { patch, gefunden, warnungen, modus: 'finanzierung' };
    },
  },
  {
    id: 'expose',
    label: 'Exposé / Objektdaten',
    beschreibung: 'Flaches oder verschachteltes Objekt-JSON (Portal-Export, eigene Notizen, Scraper).',
    erkennt: (raw) => {
      const flat = flatten(raw);
      const kern = ['kaufpreis', 'preis', 'price', 'wohnflaeche', 'objektart', 'grundstuecksflaeche'];
      const treffer = kern.filter((k) => flat.has(normKey(k))).length;
      return treffer >= 2 ? 0.85 : treffer === 1 ? 0.5 : 0.1;
    },
    mappe: (raw) => ({ ...mappeExpose(raw), modus: 'objekt' }),
  },
];

export function waehleAdapter(raw) {
  return ADAPTER.map((a) => ({ adapter: a, score: a.erkennt(raw) }))
    .sort((x, y) => y.score - x.score)
    .filter((x) => x.score > 0);
}
