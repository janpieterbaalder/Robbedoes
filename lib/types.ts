export type Place = { name: string; lat: number; lon: number };
export type Match = {
  id: string;
  home: string;
  away: string;
  kickoff: string;
  league: string;
  stadium: string;
  city: string;
  lat: number;
  lon: number;
  timezone: string;
  color: string;
  ticketUrl: string | null;
  demand: "high" | "medium" | "low" | "unknown";
  derby?: boolean;
  demo?: boolean;
  distance?: number;
  provisional?: boolean;
};
export type MatchResponse = {
  matches: Match[];
  source: string;
  coverage: string;
  updatedAt: string;
  missingVenues: number;
  warning?: string;
};
