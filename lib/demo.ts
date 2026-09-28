import type { Match } from "./types";
import { clubById } from "./clubs";
import { addDays } from "./football";
import { zonedTimeToUtc } from "./time";
export function demoMatches(start: string): Match[] {
  return [
    {
      home: "feyenoord",
      away: "FC Utrecht",
      day: 2,
      time: "20:00",
      league: "Eredivisie",
      demand: "high",
    },
    {
      home: "sparta",
      away: "AZ",
      day: 3,
      time: "14:30",
      league: "Eredivisie",
      demand: "medium",
    },
    {
      home: "excelsior",
      away: "NAC Breda",
      day: 3,
      time: "18:45",
      league: "Eredivisie",
      demand: "low",
    },
    {
      home: "ado-den-haag",
      away: "De Graafschap",
      day: 1,
      time: "20:00",
      league: "Eerste Divisie",
      demand: "medium",
    },
    {
      home: "dordrecht",
      away: "FC Eindhoven",
      day: 1,
      time: "20:00",
      league: "Eerste Divisie",
      demand: "low",
    },
    {
      home: "utrecht",
      away: "FC Twente",
      day: 4,
      time: "14:30",
      league: "Eredivisie",
      demand: "medium",
    },
  ].map((m, i) => {
    const club = clubById(m.home)!;
    return {
      id: `demo-${start}-${i}`,
      home: club.name,
      homeId: club.id,
      away: m.away,
      kickoff: zonedTimeToUtc(addDays(start, m.day), m.time, club.timezone),
      league: m.league,
      stadium: club.stadium,
      city: club.city,
      lat: club.lat,
      lon: club.lon,
      timezone: club.timezone,
      color: club.color,
      ticketUrl: club.website,
      demand: m.demand as Match["demand"],
      demo: true,
    };
  });
}
