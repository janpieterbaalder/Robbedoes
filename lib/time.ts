// Time-zone helpers built on Intl, so the server needs no date library.
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

function wallClock(utcMs: number, timeZone: string) {
  const parts: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(new Date(utcMs)))
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  return parts;
}

/** Offset of `timeZone` from UTC at the given instant, in milliseconds. */
export function zoneOffsetMs(utcMs: number, timeZone: string) {
  const p = wallClock(utcMs, timeZone);
  const asUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second,
  );
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Converts a wall-clock date and time in `timeZone` to an ISO UTC timestamp. */
export function zonedTimeToUtc(date: string, time: string, timeZone: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const first = guess - zoneOffsetMs(guess, timeZone);
  const second = guess - zoneOffsetMs(first, timeZone);
  return new Date(second).toISOString().replace(".000Z", "Z");
}

/** Calendar date (YYYY-MM-DD) of an instant in `timeZone`. */
export function localDateIn(iso: string, timeZone: string) {
  const p = wallClock(Date.parse(iso), timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const d = new Date(value + "T00:00:00Z");
  return !Number.isNaN(+d) && d.toISOString().startsWith(value);
}
