// Competitions Robbedoes searches. Every league has at least one free feed; football-data.org
// (FOOTBALL_DATA_API_KEY) is used as a fallback for leagues and for the Champions League.
export type League = {
  id: string;
  name: string;
  /** Catalogue countries whose clubs play in this league. */
  countries: readonly string[];
  /** Time zone of the kick-off times published by openfootball. */
  timezone: string;
  openLigaDb?: string;
  openfootball?: string;
  footballData?: string;
};

// prettier-ignore
export const LEAGUES: League[] = [
  { id: "nl.1", name: "Eredivisie", countries: ["NL"], timezone: "Europe/Amsterdam", openfootball: "nl.1", footballData: "DED" },
  { id: "de.1", name: "Bundesliga", countries: ["DE"], timezone: "Europe/Berlin", openLigaDb: "bl1", openfootball: "de.1", footballData: "BL1" },
  { id: "de.2", name: "2. Bundesliga", countries: ["DE"], timezone: "Europe/Berlin", openLigaDb: "bl2", openfootball: "de.2" },
  { id: "de.3", name: "3. Liga", countries: ["DE"], timezone: "Europe/Berlin", openLigaDb: "bl3", openfootball: "de.3" },
  { id: "en.1", name: "Premier League", countries: ["EN", "WA"], timezone: "Europe/London", openfootball: "en.1", footballData: "PL" },
  { id: "en.2", name: "Championship", countries: ["EN", "WA"], timezone: "Europe/London", openfootball: "en.2", footballData: "ELC" },
  { id: "es.1", name: "LaLiga", countries: ["ES"], timezone: "Europe/Madrid", openfootball: "es.1", footballData: "PD" },
  { id: "it.1", name: "Serie A", countries: ["IT"], timezone: "Europe/Rome", openfootball: "it.1", footballData: "SA" },
  { id: "fr.1", name: "Ligue 1", countries: ["FR", "MC"], timezone: "Europe/Paris", openfootball: "fr.1", footballData: "FL1" },
  { id: "pt.1", name: "Liga Portugal", countries: ["PT"], timezone: "Europe/Lisbon", openfootball: "pt.1", footballData: "PPL" },
];

/** International competitions, only available through football-data.org. */
export const CUPS: League[] = [
  {
    id: "uefa.cl",
    name: "Champions League",
    countries: [],
    timezone: "UTC",
    footballData: "CL",
  },
];

/** Season label for a date: "2026-27" (a season runs from July to June). */
export function seasonOf(date: string) {
  const year = Number(date.slice(0, 4));
  const first = Number(date.slice(5, 7)) >= 7 ? year : year - 1;
  return { label: `${first}-${String(first + 1).slice(2)}`, year: first };
}
