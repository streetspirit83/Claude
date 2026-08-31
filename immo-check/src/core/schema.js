/**
 * Kanonisches Datenmodell "reip/v1" (Real Estate Investment Profile).
 *
 * Alle Module (Wohnung, EFH, Grundstueck, Neubau) arbeiten auf diesem einen
 * Objekt. Module ergaenzen nur Defaults, Felder und Bewertungsregeln - sie
 * definieren KEIN eigenes Datenformat. Damit bleibt der Import (ein Adapter
 * pro Quelle) unabhaengig vom Objekttyp.
 */

export const SCHEMA_VERSION = 'reip/v1';

export function defaultProfil() {
  return {
    schema: SCHEMA_VERSION,
    meta: {
      bezeichnung: '',
      quelle: '',
      erfasst_am: new Date().toISOString().slice(0, 10),
      notizen: '',
    },
    objekt: {
      typ: 'wohnung', // wohnung | efh | grundstueck | neubau
      adresse: { strasse: '', plz: '', ort: '' },
      baujahr: 1990,
      wohnflaeche: 70, // m2
      grundstuecksflaeche: 0, // m2
      zimmer: 3,
      etage: 1,
      zustand: 'gut', // neuwertig | gut | mittel | sanierungsbeduerftig
      denkmal: false,
      erbbaurecht: false,
      erbbauzins_jahr: 0,
      energie: { kennwert: 130, klasse: 'D', traeger: 'Gas' },
      // nur Grundstueck / Neubau
      bodenrichtwert_eur_qm: 0,
      erschliessung: 'erschlossen', // erschlossen | teilerschlossen | unerschlossen
      grz: 0.4,
      gfz: 0.8,
      altlasten_verdacht: false,
    },
    kauf: {
      kaufpreis: 300000,
      grunderwerbsteuer_pct: 5.0,
      notar_pct: 1.5,
      makler_pct: 3.57,
      sonstige_nebenkosten: 0,
      modernisierung: 0, // sofortiger Investitionsbedarf
      erschliessungskosten: 0, // Grundstueck
      baukosten: 0, // Neubau (KG 300+400)
      baunebenkosten_pct: 18, // Neubau (KG 700, % auf Baukosten)
      bauzeit_monate: 0, // Neubau
      bodenwert_anteil_pct: 20, // nicht abschreibbarer Anteil
    },
    ertrag: {
      nutzung: 'vermietung', // vermietung | eigennutzung | keine
      kaltmiete_monat: 900,
      miete_marktueblich_monat: 950,
      stellplatzmiete_monat: 0,
      mietsteigerung_pa_pct: 1.5,
      leerstand_pct: 2,
    },
    kosten: {
      hausgeld_monat: 0, // gesamt (nur Info, WEG)
      nicht_umlagefaehig_monat: 60, // aus Hausgeld / Verwaltung
      instandhaltung_eur_qm_jahr: 12,
      verwaltung_eur_monat: 0,
      grundsteuer_jahr: 400,
      versicherung_jahr: 0,
      kostensteigerung_pa_pct: 2,
    },
    finanzierung: {
      eigenkapital: 80000,
      angebote: [
        {
          id: 'a1',
          name: 'Angebot A',
          sollzins_pct: 3.6,
          zinsbindung_jahre: 10,
          tilgung_pct: 2.0,
          sondertilgung_pct_pa: 5,
          effektivzins_pct: 3.68,
          notiz: '',
        },
      ],
      aktives_angebot: 'a1',
      anschlusszins_pct: 4.5,
      rate_nach_zinsbindung: 'annuitaet_halten', // annuitaet_halten | tilgung_halten
    },
    steuer: {
      grenzsteuersatz_pct: 42,
      afa_satz_pct: 2.0,
    },
    annahmen: {
      betrachtungsdauer_jahre: 15,
      wertsteigerung_pa_pct: 1.5,
      verkaufskosten_pct: 3,
      alternativrendite_pa_pct: 5,
      vergleichsmiete_monat: 1100, // Eigennutzung: was zahle ich sonst zur Miete?
    },
  };
}

/* ------------------------------------------------------------------ */
/* Pfad-Helfer: das gesamte UI adressiert Felder ueber "kauf.kaufpreis" */
/* ------------------------------------------------------------------ */

export function get(obj, pfad) {
  return pfad.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

export function set(obj, pfad, wert) {
  const teile = pfad.split('.');
  const letzter = teile.pop();
  const ziel = teile.reduce((o, k) => (o[k] = o[k] ?? {}), obj);
  ziel[letzter] = wert;
  return obj;
}

/** Tiefes Merge: nur definierte Werte des Patches ueberschreiben. Arrays ersetzen. */
export function merge(basis, patch) {
  if (patch === null || patch === undefined) return basis;
  if (Array.isArray(patch) || typeof patch !== 'object') return patch;
  const out = Array.isArray(basis) ? [...basis] : { ...(basis ?? {}) };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? merge(out[k], v) : v;
  }
  return out;
}

export function klone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/** Minimale Struktur-Pruefung fuer importierte/geladene Profile. */
export function validiere(profil) {
  const fehler = [];
  if (!profil || typeof profil !== 'object') return ['Kein gueltiges JSON-Objekt.'];
  if (!profil.objekt?.typ) fehler.push('objekt.typ fehlt.');
  if (!(profil.kauf?.kaufpreis > 0)) fehler.push('kauf.kaufpreis fehlt oder ist 0.');
  return fehler;
}
