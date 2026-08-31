/**
 * Wiederverwendbare Plausibilitaets-Checks.
 *
 * Jeder Check bekommt den Kontext { profil, proj, kpi } und liefert
 * `null` (alles ok) oder { status, text }. Module setzen sich ihre Liste
 * daraus zusammen und ergaenzen eigene.
 */

import { AMPEL } from '../core/scoring.js';

export const energieklasse = ({ profil }) =>
  ['F', 'G', 'H'].includes(profil.objekt.energie?.klasse)
    ? {
        status: AMPEL.rot,
        text: `Energieklasse ${profil.objekt.energie.klasse}: Sanierungsrisiko und schlechtere Vermietbarkeit. Modernisierungsbudget einplanen.`,
      }
    : null;

export const instandhaltungRealistisch =
  (min = 8) =>
  ({ profil }) =>
    profil.kosten.instandhaltung_eur_qm_jahr < min
      ? {
          status: AMPEL.gelb,
          text: `Instandhaltungsansatz unter ${min} €/m²a ist für Bestandsobjekte meist zu optimistisch.`,
        }
      : null;

export const mieteUeberMarkt = ({ profil }) =>
  profil.ertrag.nutzung === 'vermietung' &&
  profil.ertrag.miete_marktueblich_monat > 0 &&
  profil.ertrag.kaltmiete_monat > profil.ertrag.miete_marktueblich_monat * 1.05
    ? { status: AMPEL.gelb, text: 'Ist-Miete liegt über der Marktmiete – bei Neuvermietung droht ein Rückgang.' }
    : null;

export const altbauRisiken = ({ profil }) =>
  profil.objekt.baujahr && profil.objekt.baujahr < 1978
    ? { status: AMPEL.gelb, text: 'Baujahr vor 1978: Leitungen, Dämmung und Schadstoffe (Asbest) gezielt prüfen.' }
    : null;

export const ekDecktNebenkosten = ({ proj }) =>
  proj.finanzierung.eigenkapital < proj.invest.nebenkosten
    ? {
        status: AMPEL.rot,
        text: 'Eigenkapital deckt die Kaufnebenkosten nicht – Vollfinanzierung inkl. Nebenkosten ist teuer und riskant.',
      }
    : null;

export const unterdeckungNachZinsbindung = ({ kpi }) =>
  kpi.unterdeckung_nach_zinsbindung
    ? {
        status: AMPEL.rot,
        text: 'Nach Ablauf der Zinsbindung deckt die bisherige Rate die Zinsen nicht mehr. Rate oder Tilgung anpassen.',
      }
    : null;

export const erbbaurecht = ({ profil }) =>
  profil.objekt.erbbaurecht
    ? {
        status: AMPEL.gelb,
        text: 'Erbbaurecht: Restlaufzeit, Zinsanpassung und Heimfall-Regelung prüfen – beeinflusst Finanzierung und Wiederverkauf.',
      }
    : null;

export const hausgeldPlausibel = ({ profil }) =>
  profil.kosten.hausgeld_monat > 0 && profil.kosten.nicht_umlagefaehig_monat > profil.kosten.hausgeld_monat
    ? { status: AMPEL.gelb, text: 'Nicht umlagefähiger Anteil ist größer als das gesamte Hausgeld – Eingabe prüfen.' }
    : null;

export const eigennutzungHinweis = ({ profil }) =>
  profil.ertrag.nutzung === 'eigennutzung'
    ? {
        status: AMPEL.neutral,
        text: 'Eigennutzung: keine AfA und keine Werbungskosten, dafür Verkauf jederzeit steuerfrei. Maßgeblich ist der Vergleich Kaufen/Mieten.',
      }
    : null;

export const zinsbindungKurz = ({ profil, proj }) =>
  (proj.angebot?.zinsbindung_jahre ?? 99) < 10 && profil.annahmen.betrachtungsdauer_jahre > 10
    ? {
        status: AMPEL.gelb,
        text: `Zinsbindung von nur ${proj.angebot.zinsbindung_jahre} Jahren: das Zinsänderungsrisiko trifft früh und voll. Längere Bindung gegenrechnen.`,
      }
    : null;
