import type { Match, Place } from "./types";
import { localDateIn } from "./time";
export function distanceKm(
  a: Pick<Place, "lat" | "lon">,
  b: Pick<Place, "lat" | "lon">,
) {
  const rad = (v: number) => (v * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat),
    dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function ticketScore(match: Match) {
  if (match.demand === "unknown") return null;
  return Math.max(
    1,
    { high: 2, medium: 3, low: 4 }[match.demand] - (match.derby ? 1 : 0),
  );
}
export function ticketReason(match: Match) {
  if (match.demand === "unknown")
    return "Er is onvoldoende informatie om de ticketkans te schatten. Bekijk de verkoopvoorwaarden bij de club.";
  return `${match.demo ? "Voorbeeld van de rekenregel. " : ""}Indicatie op basis van een handmatig ingeschatte clubpopulariteit${match.derby ? " en extra vraag bij een derby" : ""}. Geen controle van kaartvoorraad, vrije verkoop of clubcardvoorwaarden. De score is geen kanspercentage.`;
}
export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function addDays(value: string, n: number) {
  const d = new Date(value + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function inDateRange(match: Match, start: string, end: string) {
  const day = localDateIn(match.kickoff, match.timezone);
  return day >= start && day <= end;
}
export function searchMatches(
  matches: Match[],
  place: Place,
  radius: number,
  start: string,
  end: string,
) {
  return matches
    .filter((m) => inDateRange(m, start, end))
    .map((m) => ({ ...m, distance: distanceKm(place, m) }))
    .filter((m) => m.distance <= radius)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}
