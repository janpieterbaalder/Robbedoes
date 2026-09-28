import type { Match } from "./types";
import { venues } from "./venues";
import { addDays } from "./football";
export function demoMatches(start: string): Match[] {
  return [
    {
      home: "Feyenoord",
      away: "FC Utrecht",
      day: 2,
      time: "18:00",
      league: "Eredivisie",
      demand: "high",
    },
    {
      home: "Sparta Rotterdam",
      away: "AZ",
      day: 3,
      time: "12:30",
      league: "Eredivisie",
      demand: "medium",
    },
    {
      home: "Excelsior",
      away: "NAC Breda",
      day: 3,
      time: "16:45",
      league: "Eredivisie",
      demand: "low",
    },
    {
      home: "ADO Den Haag",
      away: "De Graafschap",
      day: 1,
      time: "18:00",
      league: "Eerste Divisie",
      demand: "medium",
    },
    {
      home: "FC Dordrecht",
      away: "FC Eindhoven",
      day: 1,
      time: "18:00",
      league: "Eerste Divisie",
      demand: "low",
    },
    {
      home: "FC Utrecht",
      away: "FC Twente",
      day: 4,
      time: "12:30",
      league: "Eredivisie",
      demand: "medium",
    },
  ].map((m, i) => ({
    ...venues[m.home],
    id: `demo-${start}-${i}`,
    home: m.home,
    away: m.away,
    kickoff: `${addDays(start, m.day)}T${m.time}:00Z`,
    league: m.league,
    demand: m.demand as Match["demand"],
    demo: true,
  }));
}
