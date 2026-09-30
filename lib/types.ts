export type Place = { name: string; lat: number; lon: number };
export type Match = {
  id: string;
  home: string;
  away: string;
  homeId?: string;
  /** ISO UTC kick-off. While `timeTbc` is set this is noon local time on the match day. */
  kickoff: string;
  timeTbc?: boolean;
  league: string;
  country?: string;
  stadium: string;
  city: string;
  lat: number;
  lon: number;
  /** Only the city centre is known; the stadium can be a few kilometres away. */
  approx?: boolean;
  timezone: string;
  color: string;
  awayColor?: string;
  ticketUrl: string | null;
  demand: "high" | "medium" | "low" | "unknown";
  derby?: boolean;
  demo?: boolean;
  distance?: number;
  provisional?: boolean;
  source?: string;
};
export type MatchResponse = {
  matches: Match[];
  source: string;
  coverage: string;
  updatedAt: string;
  missingVenues: number;
  warning?: string;
  /** First match day after the period within the radius, when the period has none. */
  nextDate?: string;
  /** Closest covered stadium, when no covered club lies within the radius. */
  nearest?: { club: string; city: string; distance: number };
};
