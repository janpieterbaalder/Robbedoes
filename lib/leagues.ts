// Competitions Robbedoes searches. Leagues with an open feed (openfootball, OpenLigaDB) place
// matches through the club catalogue; ESPN-only leagues place them through the stadium table
// in lib/venues.ts. ESPN is the last fallback for the open feeds and the first source for the
// European cups, because it names the stadium of every match, anywhere in Europe.
export type League = {
  id: string;
  name: string;
  /** Countries whose clubs play in this league, as used by the club catalogue. */
  countries: readonly string[];
  /** Time zone of the kick-off times published by openfootball. */
  timezone: string;
  openLigaDb?: string;
  openfootball?: string;
  footballData?: string;
  /** League slug in ESPN's site API. */
  espn?: string;
};

// prettier-ignore
export const LEAGUES: League[] = [
  { id: "nl.1", name: "Eredivisie", countries: ["NL"], timezone: "Europe/Amsterdam", openfootball: "nl.1", footballData: "DED", espn: "ned.1" },
  { id: "nl.2", name: "Keuken Kampioen Divisie", countries: ["NL"], timezone: "Europe/Amsterdam", espn: "ned.2" },
  { id: "de.1", name: "Bundesliga", countries: ["DE"], timezone: "Europe/Berlin", openLigaDb: "bl1", openfootball: "de.1", footballData: "BL1", espn: "ger.1" },
  { id: "de.2", name: "2. Bundesliga", countries: ["DE"], timezone: "Europe/Berlin", openLigaDb: "bl2", openfootball: "de.2", espn: "ger.2" },
  { id: "de.3", name: "3. Liga", countries: ["DE"], timezone: "Europe/Berlin", openLigaDb: "bl3", openfootball: "de.3" },
  { id: "en.1", name: "Premier League", countries: ["EN", "WA"], timezone: "Europe/London", openfootball: "en.1", footballData: "PL", espn: "eng.1" },
  { id: "en.2", name: "Championship", countries: ["EN", "WA"], timezone: "Europe/London", openfootball: "en.2", footballData: "ELC", espn: "eng.2" },
  { id: "en.3", name: "League One", countries: ["EN", "WA"], timezone: "Europe/London", espn: "eng.3" },
  { id: "en.4", name: "League Two", countries: ["EN", "WA"], timezone: "Europe/London", espn: "eng.4" },
  { id: "en.5", name: "National League", countries: ["EN", "WA"], timezone: "Europe/London", espn: "eng.5" },
  { id: "sc.1", name: "Scottish Premiership", countries: ["SC"], timezone: "Europe/London", espn: "sco.1" },
  { id: "sc.2", name: "Scottish Championship", countries: ["SC"], timezone: "Europe/London", espn: "sco.2" },
  { id: "es.1", name: "LaLiga", countries: ["ES"], timezone: "Europe/Madrid", openfootball: "es.1", footballData: "PD", espn: "esp.1" },
  { id: "es.2", name: "LaLiga 2", countries: ["ES"], timezone: "Europe/Madrid", espn: "esp.2" },
  { id: "it.1", name: "Serie A", countries: ["IT"], timezone: "Europe/Rome", openfootball: "it.1", footballData: "SA", espn: "ita.1" },
  { id: "it.2", name: "Serie B", countries: ["IT"], timezone: "Europe/Rome", espn: "ita.2" },
  { id: "fr.1", name: "Ligue 1", countries: ["FR", "MC"], timezone: "Europe/Paris", openfootball: "fr.1", footballData: "FL1", espn: "fra.1" },
  { id: "fr.2", name: "Ligue 2", countries: ["FR"], timezone: "Europe/Paris", espn: "fra.2" },
  { id: "pt.1", name: "Liga Portugal", countries: ["PT"], timezone: "Europe/Lisbon", openfootball: "pt.1", footballData: "PPL", espn: "por.1" },
  { id: "be.1", name: "Belgische Pro League", countries: ["BE"], timezone: "Europe/Brussels", espn: "bel.1" },
  { id: "at.1", name: "Oostenrijkse Bundesliga", countries: ["AT"], timezone: "Europe/Vienna", espn: "aut.1" },
  { id: "dk.1", name: "Superligaen", countries: ["DK"], timezone: "Europe/Copenhagen", espn: "den.1" },
  { id: "se.1", name: "Allsvenskan", countries: ["SE"], timezone: "Europe/Stockholm", espn: "swe.1" },
  { id: "no.1", name: "Eliteserien", countries: ["NO"], timezone: "Europe/Oslo", espn: "nor.1" },
  { id: "gr.1", name: "Griekse Super League", countries: ["GR"], timezone: "Europe/Athens", espn: "gre.1" },
  { id: "tr.1", name: "Süper Lig", countries: ["TR"], timezone: "Europe/Istanbul", espn: "tur.1" },
];

/** European cups. Clubs from every country take part, so the list of countries is empty. */
// prettier-ignore
export const CUPS: League[] = [
  { id: "uefa.cl", name: "Champions League", countries: [], timezone: "UTC", footballData: "CL", espn: "uefa.champions" },
  { id: "uefa.el", name: "Europa League", countries: [], timezone: "UTC", espn: "uefa.europa" },
  { id: "uefa.ecl", name: "Conference League", countries: [], timezone: "UTC", espn: "uefa.europa.conf" },
];

/** Season label for a date: "2026-27" (a season runs from July to June). */
export function seasonOf(date: string) {
  const year = Number(date.slice(0, 4));
  const first = Number(date.slice(5, 7)) >= 7 ? year : year - 1;
  return { label: `${first}-${String(first + 1).slice(2)}`, year: first };
}
