"use client";
import {
  useEffect,
  useRef,
  useState,
  useId,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ArrowDownUp,
  ArrowRight,
  Bookmark,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  ExternalLink,
  Info,
  LocateFixed,
  MapPin,
  Navigation,
  Search,
  SlidersHorizontal,
  Star,
  UserRound,
  X,
  LoaderCircle,
  LogOut,
} from "lucide-react";
import type { Match, MatchResponse, Place } from "@/lib/types";
import { addDays, localDate, ticketScore, ticketReason } from "@/lib/football";
import { COUNTRY_NAMES } from "@/lib/clubs";
import { CUPS, LEAGUES } from "@/lib/leagues";
import { localDateIn } from "@/lib/time";
const ROTTERDAM: Place = {
  name: "Rotterdam, Nederland",
  lat: 51.9244,
  lon: 4.4777,
};
const PRESETS: Place[] = [
  ROTTERDAM,
  { name: "Londen, Verenigd Koninkrijk", lat: 51.5072, lon: -0.1276 },
  { name: "Dortmund, Duitsland", lat: 51.5136, lon: 7.4653 },
  { name: "Barcelona, Spanje", lat: 41.3874, lon: 2.1686 },
  { name: "Milaan, Italië", lat: 45.4642, lon: 9.19 },
  { name: "Lissabon, Portugal", lat: 38.7223, lon: -9.1393 },
  { name: "Brussel, België", lat: 50.8503, lon: 4.3517 },
  { name: "Glasgow, Schotland", lat: 55.8642, lon: -4.2518 },
];
const listNl = (items: string[]) =>
  new Intl.ListFormat("nl", { type: "conjunction" }).format(items);
const byCountry = new Map<string, string[]>();
for (const l of LEAGUES) {
  const country = COUNTRY_NAMES[l.countries[0]] ?? l.countries[0];
  byCountry.set(country, [...(byCountry.get(country) ?? []), l.name]);
}
const COVERAGE = [...byCountry]
  .map(([country, names]) => `${country}: ${listNl(names)}`)
  .join("; ");
const COVERAGE_SHORT = `${LEAGUES.length} competities in ${byCountry.size} landen, plus ${listNl(CUPS.map((c) => c.name))}`;
const dateLabel = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });
const longDateLabel = (s: string) =>
  new Date(s + "T12:00:00").toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
const safeUrl = (url: string | null) => {
  try {
    const u = new URL(url || "");
    return u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
};
function Crest({ name, color }: { name: string; color?: string }) {
  return (
    <span
      className="crest"
      style={{ "--club": color || "#d9ddd7" } as React.CSSProperties}
      aria-hidden="true"
    >
      <span>
        {name
          .replace(
            /^((FC|SC|SV|AC|AS|US|SS|SSC|RC|RCD|CD|VfL|VfB|TSG|1\.)\s+)+/,
            "",
          )
          .split(" ")
          .filter((s) => /^\p{L}/u.test(s))
          .map((s) => s[0])
          .join("")
          .slice(0, 3)
          .toUpperCase()}
      </span>
    </span>
  );
}
function Stars({ match }: { match: Match }) {
  const score = ticketScore(match);
  return (
    <span
      className="stars"
      aria-label={
        score ? `Ticketindicatie ${score} van 5 sterren` : "Ticketkans onbekend"
      }
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={12}
          fill={score && n <= score ? "currentColor" : "none"}
          className={score && n <= score ? "lit" : ""}
        />
      ))}
    </span>
  );
}
function Modal({
  children,
  title,
  onClose,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
}) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    d?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      d?.close();
    };
  }, []);
  return (
    <dialog
      aria-labelledby={titleId}
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <h2 id={titleId}>{title}</h2>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Sluiten"
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export default function Scout({
  accountsEnabled,
}: {
  accountsEnabled: boolean;
}) {
  const [ready, setReady] = useState(false),
    [tab, setTab] = useState<"discover" | "saved" | "profile">("discover");
  const [place, setPlace] = useState<Place>(ROTTERDAM),
    [start, setStart] = useState(""),
    [end, setEnd] = useState(""),
    [radius, setRadius] = useState(50),
    [sort, setSort] = useState("date");
  const [response, setResponse] = useState<MatchResponse | null>(null),
    [loading, setLoading] = useState(false),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  const [saved, setSaved] = useState<Match[]>([]),
    [modal, setModal] = useState<"place" | "dates" | "filters" | "info" | null>(
      null,
    ),
    [selected, setSelected] = useState<Match | null>(null),
    [toast, setToast] = useState("");
  const [query, setQuery] = useState(""),
    [places, setPlaces] = useState<Place[]>([]),
    [placeBusy, setPlaceBusy] = useState(false),
    [placeError, setPlaceError] = useState("");
  const [user, setUser] = useState<{ name: string; email: string } | null>(
      null,
    ),
    [authBusy, setAuthBusy] = useState(false),
    [register, setRegister] = useState(false),
    [authMessage, setAuthMessage] = useState("");
  const [draftStart, setDraftStart] = useState(""),
    [draftEnd, setDraftEnd] = useState("");
  useEffect(() => {
    const today = localDate();
    setStart(today);
    setEnd(addDays(today, 6));
    try {
      const s = JSON.parse(localStorage.getItem("robbedoes:saved") || "[]");
      if (Array.isArray(s))
        setSaved(
          s.filter(
            (m) =>
              m &&
              typeof m.id === "string" &&
              typeof m.home === "string" &&
              typeof m.away === "string" &&
              Number.isFinite(Date.parse(m.kickoff)),
          ),
        );
    } catch {}
    setReady(true);
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    if (ready && !user) {
      try {
        localStorage.setItem("robbedoes:saved", JSON.stringify(saved));
      } catch {}
    }
  }, [saved, ready, user]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(id);
  }, [toast]);
  async function refreshAccount() {
    if (!accountsEnabled) return;
    const { createAuthClient } = await import("@neondatabase/auth/next");
    const c = createAuthClient();
    const s = await c.getSession();
    if (s.data?.user) {
      setUser({ name: s.data.user.name, email: s.data.user.email });
      const r = await fetch("/api/favorites");
      if (r.ok) {
        setSaved((await r.json()).matches);
      } else setToast("Je bewaarde wedstrijden konden niet worden opgehaald.");
    }
  }
  useEffect(() => {
    if (accountsEnabled)
      refreshAccount().catch(() =>
        setAuthMessage("Je account kon niet worden geladen."),
      );
  }, [accountsEnabled]);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setResponse(null);
    // Two decimals (about 1 km) is plenty for a radius search and keeps GPS positions coarse.
    const params = new URLSearchParams({
      start,
      end,
      lat: place.lat.toFixed(2),
      lon: place.lon.toFixed(2),
      radius: String(radius),
    });
    fetch("/api/matches?" + params, { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        setResponse(d);
      })
      .catch((e) => {
        if (e.name !== "AbortError")
          setError(e.message || "Ophalen is mislukt.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [ready, start, end, place, radius, retry]);
  useEffect(() => {
    if (query.trim().length < 2) {
      setPlaces([]);
      setPlaceBusy(false);
      return;
    }
    const c = new AbortController();
    const timer = setTimeout(() => {
      setPlaceBusy(true);
      setPlaceError("");
      fetch("/api/places?q=" + encodeURIComponent(query), { signal: c.signal })
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          setPlaces(d.places);
        })
        .catch((e) => {
          if (e.name !== "AbortError") setPlaceError(e.message);
        })
        .finally(() => {
          if (!c.signal.aborted) setPlaceBusy(false);
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      c.abort();
    };
  }, [query]);
  const matches = [...(tab === "saved" ? saved : response?.matches || [])].sort(
    (a, b) =>
      sort === "distance"
        ? (a.distance ?? Infinity) - (b.distance ?? Infinity)
        : a.kickoff.localeCompare(b.kickoff),
  );
  const empty = (() => {
    if (tab === "saved")
      return {
        title: "Je volgende avontuur begint hier.",
        text: "Tik op het bewaarsymbool bij een wedstrijd.",
        action: "Ontdek wedstrijden",
        onClick: () => setTab("discover"),
      };
    const nearest = response?.nearest;
    if (nearest) {
      const reachable = nearest.distance <= 500;
      const target = Math.min(500, Math.ceil(nearest.distance / 25) * 25);
      return {
        title: "Hier nog geen competitie in beeld.",
        text: `Binnen ${radius} km ligt geen stadion uit onze dekking. Het dichtstbijzijnde is ${nearest.club} (${nearest.city}) op ${nearest.distance} km.`,
        action: reachable
          ? `Zoek binnen ${target} km`
          : "Kies een andere plaats",
        onClick: () => (reachable ? setRadius(target) : setModal("place")),
      };
    }
    const next = response?.nextDate;
    if (next)
      return {
        title: "Nog geen aftrap gevonden.",
        text: `Binnen ${radius} km wordt in deze periode niet gespeeld, bijvoorbeeld door een interlandperiode. De eerstvolgende speeldag in de buurt is ${longDateLabel(next)}.`,
        action: `Toon vanaf ${dateLabel(next)}`,
        onClick: () => {
          setStart(next);
          setEnd(addDays(next, 6));
        },
      };
    return {
      title: "Nog geen aftrap gevonden.",
      text: "Vergroot je straal of kies andere datums. Geen resultaten betekent niet dat er nergens wordt gevoetbald; de bronnen dekken niet elke competitie.",
      action: "Pas je zoekopdracht aan",
      onClick: () => setModal("filters"),
    };
  })();
  async function save(m: Match) {
    const exists = saved.some((s) => s.id === m.id);
    if (user) {
      try {
        const r = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ match: m, remove: exists }),
        });
        if (!r.ok) throw new Error();
      } catch {
        setToast("Opslaan is mislukt. Probeer opnieuw.");
        return;
      }
    }
    setSaved((s) => (exists ? s.filter((v) => v.id !== m.id) : [m, ...s]));
    setToast(exists ? "Wedstrijd verwijderd" : "Wedstrijd bewaard");
  }
  function locate() {
    if (!navigator.geolocation) {
      setPlaceError("Je browser ondersteunt geen locatie. Zoek een plaats.");
      return;
    }
    setPlaceBusy(true);
    setPlaceError("");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPlace({
          name: "Mijn huidige locatie",
          lat: p.coords.latitude,
          lon: p.coords.longitude,
        });
        setModal(null);
        setPlaceBusy(false);
      },
      () => {
        setPlaceError(
          "Je locatie is niet beschikbaar. Geef toestemming in je browser of zoek een plaats.",
        );
        setPlaceBusy(false);
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 },
    );
  }
  async function authSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAuthBusy(true);
    setAuthMessage("");
    const f = new FormData(e.currentTarget);
    try {
      const { createAuthClient } = await import("@neondatabase/auth/next");
      const c = createAuthClient();
      const result = register
        ? await c.signUp.email({
            email: String(f.get("email")),
            password: String(f.get("password")),
            name: String(f.get("name")),
          })
        : await c.signIn.email({
            email: String(f.get("email")),
            password: String(f.get("password")),
          });
      if (result.error) throw new Error(result.error.message);
      await refreshAccount();
      setAuthMessage(
        register
          ? "Account aangemaakt. Controleer je e-mail als verificatie wordt gevraagd."
          : "Je bent ingelogd.",
      );
    } catch (e) {
      setAuthMessage(e instanceof Error ? e.message : "Inloggen is mislukt.");
    } finally {
      setAuthBusy(false);
    }
  }
  function exportCalendar(m: Match) {
    const stamp = (date: Date) =>
      date
        .toISOString()
        .replace(/[-:]/g, "")
        .replace(/\.\d{3}/, "");
    const escape = (s: string) =>
      s
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/,/g, "\\,")
        .replace(/;/g, "\\;");
    // Without a fixed kick-off the match becomes an all-day event on the local match day.
    const day = localDateIn(m.kickoff, m.timezone);
    const data = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Robbedoes//NL",
      "BEGIN:VEVENT",
      `UID:${m.id}@robbedoes`,
      `DTSTAMP:${stamp(new Date())}`,
      ...(m.timeTbc
        ? [
            `DTSTART;VALUE=DATE:${day.replace(/-/g, "")}`,
            `DTEND;VALUE=DATE:${addDays(day, 1).replace(/-/g, "")}`,
          ]
        : [
            `DTSTART:${stamp(new Date(m.kickoff))}`,
            `DTEND:${stamp(new Date(+new Date(m.kickoff) + 2 * 3600000))}`,
          ]),
      `SUMMARY:${escape(m.home + " – " + m.away)}`,
      `LOCATION:${escape(m.stadium + ", " + m.city)}`,
      `DESCRIPTION:${escape((m.timeTbc ? "Aanvangstijd nog niet bekend. " : "") + "Controleer datum en aanvang bij de club.")}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(
      new Blob([data], { type: "text/calendar;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "robbedoes-wedstrijd.ics";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="wordmark" href="/" aria-label="Robbedoes startpagina">
          <span className="brand-mark">r.</span>robbedoes
        </a>
        <span className="desktop-label">VOETBAL. WAAR JE OOK BENT.</span>
        <button
          className="avatar"
          aria-label="Mijn account"
          onClick={() => setTab("profile")}
        >
          {user ? user.name.slice(0, 2).toUpperCase() : <UserRound size={20} />}
        </button>
      </header>
      <main>
        <aside className="side-note">
          <span className="vertical-rule" />
          <span>MET HET HART OP ZUID.</span>
          <span>51°53′ N · 04°31′ E</span>
        </aside>
        <div className="content">
          {tab === "profile" ? (
            <>
              <div className="page-heading">
                <span className="eyebrow">JOUW ROBBEDOES</span>
                <h1>
                  Altijd een
                  <br />
                  <span>uitwedstrijd.</span>
                </h1>
              </div>
              <section className="profile-card">
                <div className="profile-icon">
                  <UserRound size={30} />
                </div>
                <h2>{user ? `Hoi, ${user.name}.` : "Neem je lijstje mee."}</h2>
                <p>
                  {user
                    ? user.email
                    : "Bewaar wedstrijden op je telefoon. Met een account vind je ze straks ook op je andere apparaten."}
                </p>
                {user ? (
                  <button
                    className="primary"
                    onClick={async () => {
                      const { createAuthClient } =
                        await import("@neondatabase/auth/next");
                      await createAuthClient().signOut();
                      setUser(null);
                      try {
                        setSaved(
                          JSON.parse(
                            localStorage.getItem("robbedoes:saved") || "[]",
                          ),
                        );
                      } catch {
                        setSaved([]);
                      }
                      setToast("Je bent uitgelogd");
                    }}
                  >
                    <LogOut size={18} />
                    Uitloggen
                  </button>
                ) : accountsEnabled ? (
                  <form onSubmit={authSubmit} className="auth-form">
                    {register && (
                      <label>
                        Naam
                        <input
                          name="name"
                          autoComplete="name"
                          required
                          maxLength={100}
                        />
                      </label>
                    )}
                    <label>
                      E-mailadres
                      <input
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                      />
                    </label>
                    <label>
                      Wachtwoord
                      <input
                        name="password"
                        type="password"
                        minLength={8}
                        autoComplete={
                          register ? "new-password" : "current-password"
                        }
                        required
                      />
                    </label>
                    <button className="primary" disabled={authBusy}>
                      {authBusy ? (
                        <LoaderCircle className="spin" size={18} />
                      ) : null}
                      {register ? "Account maken" : "Inloggen"}
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => setRegister(!register)}
                    >
                      {register
                        ? "Ik heb al een account"
                        : "Nieuw hier? Maak een account"}
                    </button>
                  </form>
                ) : (
                  <div className="info-box">
                    <Info size={18} />
                    <p>
                      Je kunt de app zonder account gebruiken. Accounts zijn nog
                      niet geactiveerd; je bewaarde wedstrijden blijven op dit
                      apparaat.
                    </p>
                  </div>
                )}
                {authMessage && <p role="status">{authMessage}</p>}
              </section>
              <section className="about">
                <span className="mini-brand">1908</span>
                <h3>Overal thuis. Altijd uit.</h3>
                <p>
                  Een onafhankelijke app voor voetballiefhebbers. Rood-wit in
                  het hart, de wereld aan je voeten. Niet verbonden aan
                  Feyenoord.
                </p>
                <button
                  className="text-button"
                  onClick={() => setModal("info")}
                >
                  Over gegevens & privacy <ArrowRight size={16} />
                </button>
              </section>
            </>
          ) : (
            <>
              <div className="page-heading">
                <div className="eyebrow">
                  <span className="red-stroke" />
                  {tab === "saved"
                    ? "JOUW VOLGENDE TRIBUNE"
                    : "VOOR WIE VOETBAL MEE OP REIS NEEMT"}
                </div>
                <h1>
                  {tab === "saved" ? (
                    <>
                      Op jouw <span>lijstje.</span>
                    </>
                  ) : (
                    <>
                      Nieuwe stad.
                      <br />
                      <span>Dezelfde liefde.</span>
                    </>
                  )}
                </h1>
                <p>
                  {tab === "saved"
                    ? "De wedstrijden die je niet wilt missen."
                    : "Vind jouw volgende wedstrijd. Waar je ook bent."}
                </p>
              </div>
              {tab === "discover" && (
                <>
                  <div className="modebar">
                    <div>
                      <span className="mode-dot live" />
                      <span>Actuele wedstrijden</span>
                    </div>
                  </div>
                  <section
                    className="search-panel"
                    aria-label="Zoekinstellingen"
                  >
                    <button
                      className="location-control"
                      onClick={() => {
                        setModal("place");
                        setPlaceError("");
                      }}
                    >
                      <MapPin className="accent" size={22} />
                      <span>
                        <small>WAAR BEN JE?</small>
                        <strong>{place.name.split(",")[0]}</strong>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                    <div className="search-bottom">
                      <button
                        className="date-control"
                        onClick={() => {
                          setDraftStart(start);
                          setDraftEnd(end);
                          setModal("dates");
                        }}
                      >
                        <CalendarDays size={19} />
                        <span>
                          <small>PERIODE</small>
                          <strong>
                            {start
                              ? `${dateLabel(start)} – ${dateLabel(end)}`
                              : "Deze week"}
                          </strong>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                      <button
                        className="radius-control"
                        onClick={() => setModal("filters")}
                      >
                        <span>
                          <small>BINNEN</small>
                          <strong>
                            {radius} <span>km</span>
                          </strong>
                        </span>
                        <SlidersHorizontal size={18} />
                      </button>
                    </div>
                  </section>
                  <div className="quick-filters">
                    <button
                      className="chip"
                      onClick={() => setModal("filters")}
                    >
                      <SlidersHorizontal size={14} />
                      Filters
                    </button>
                    <button
                      className="help-icon"
                      onClick={() => setModal("info")}
                      aria-label="Goed om te weten"
                    >
                      <Info size={18} />
                    </button>
                  </div>
                </>
              )}
              <div className="results-heading">
                <h2>
                  {tab === "saved"
                    ? "Bewaarde wedstrijden"
                    : "Op de speelkalender"}{" "}
                  <span>{loading ? "…" : matches.length}</span>
                </h2>
                <label className="sort">
                  <ArrowDownUp size={14} />
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    aria-label="Sorteer wedstrijden"
                  >
                    <option value="date">Datum</option>
                    <option value="distance">Afstand</option>
                  </select>
                </label>
              </div>
              {tab === "discover" && !loading && response?.warning && (
                <p className="demo-note" role="status">
                  {response.warning}
                </p>
              )}
              {loading && tab === "discover" ? (
                <div className="loading" role="status">
                  <LoaderCircle className="spin" />
                  Wedstrijden zoeken…
                  <div className="skeleton" />
                  <div className="skeleton" />
                </div>
              ) : error && tab === "discover" ? (
                <div className="empty">
                  <Info size={32} />
                  <h3>Even buitenspel.</h3>
                  <p>{error}</p>
                  <button
                    className="primary"
                    onClick={() => setRetry((n) => n + 1)}
                  >
                    Opnieuw proberen
                  </button>
                </div>
              ) : matches.length === 0 ? (
                <div className="empty">
                  <Compass size={36} />
                  <h3>{empty.title}</h3>
                  <p>{empty.text}</p>
                  <button className="primary" onClick={empty.onClick}>
                    {empty.action}
                    <ArrowRight size={17} />
                  </button>
                </div>
              ) : (
                <div className="match-list">
                  {matches.map((m, i) => {
                    const isSaved = saved.some((s) => s.id === m.id);
                    const score = ticketScore(m);
                    const day = new Date(m.kickoff).toLocaleDateString(
                      "nl-NL",
                      {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        timeZone: m.timezone,
                      },
                    );
                    const time = m.timeTbc
                      ? "tijd volgt"
                      : new Date(m.kickoff).toLocaleTimeString("nl-NL", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: m.timezone,
                        });
                    const heart =
                      m.homeId === "feyenoord" || m.home === "Feyenoord";
                    return (
                      <article
                        className={"match-card " + (heart ? "home-heart" : "")}
                        key={m.id}
                        style={{ animationDelay: `${i * 45}ms` }}
                      >
                        <div className="card-top">
                          <span className="league">
                            {heart && <span className="tiny-stripe" />}
                            {m.league}
                          </span>
                          <span className="match-date">
                            {day}
                            <span>·</span>
                            {time}
                          </span>
                        </div>
                        <div className="card-main">
                          <button
                            className="match-open"
                            onClick={() => setSelected(m)}
                            aria-label={`Bekijk ${m.home} tegen ${m.away}`}
                          >
                            <div className="team-line">
                              <Crest name={m.home} color={m.color} />
                              <h3>{m.home}</h3>
                              {heart && (
                                <span className="heart-label">1908</span>
                              )}
                            </div>
                            <div className="team-line">
                              <Crest name={m.away} color={m.awayColor} />
                              <h3>{m.away}</h3>
                            </div>
                          </button>
                          <button
                            className={
                              "save-button " + (isSaved ? "is-saved" : "")
                            }
                            onClick={() => save(m)}
                            aria-label={
                              isSaved
                                ? `Verwijder ${m.home} uit bewaard`
                                : `Bewaar ${m.home}`
                            }
                            aria-pressed={isSaved}
                          >
                            <Bookmark
                              size={21}
                              fill={isSaved ? "currentColor" : "none"}
                            />
                          </button>
                        </div>
                        <button
                          className="venue-line"
                          onClick={() => setSelected(m)}
                        >
                          <MapPin size={14} />
                          <span>{m.stadium}</span>
                          {m.distance !== undefined && (
                            <>
                              <span className="separator">·</span>
                              <span>{Math.round(m.distance)} km</span>
                            </>
                          )}
                        </button>
                        <div className="card-footer">
                          <button
                            className="ticket-indicator"
                            onClick={() => setSelected(m)}
                          >
                            <Stars match={m} />
                            <span>
                              {score
                                ? score >= 4
                                  ? "Goede indicatie"
                                  : score === 3
                                    ? "Redelijke indicatie"
                                    : "Lastiger te krijgen"
                                : "Ticketkans onbekend"}
                            </span>
                            <Info size={12} />
                          </button>
                          <button
                            className="details-arrow"
                            onClick={() => setSelected(m)}
                            aria-label={`Details ${m.home}`}
                          >
                            <ArrowRight size={18} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
              {tab === "discover" && (
                <div className="data-note">
                  <Info size={15} />
                  <p>
                    {response?.source
                      ? `Bronnen: ${response.source}. Doorzocht: ${response.coverage}.${response.missingVenues ? ` ${response.missingVenues} wedstrijden zonder bekende stadionlocatie overgeslagen.` : ""}`
                      : `Dekking: ${COVERAGE_SHORT}.`}
                    <br />
                    Afstanden zijn hemelsbreed. Tijden zijn lokaal bij het
                    stadion.
                  </p>
                </div>
              )}
              <footer className="page-footer">
                <span>NIET LULLEN. MAAR REIZEN.</span>
                <span className="footer-stripes">
                  <i />
                  <i />
                  <i />
                </span>
              </footer>
            </>
          )}
        </div>
        <aside className="desktop-aside">
          <div className="travel-ticket">
            <div className="ticket-top">
              <span>ROBBEDOES</span>
              <Navigation size={18} />
            </div>
            <span className="ticket-kicker">VOLGENDE BESTEMMING</span>
            <h2>De tribune.</h2>
            <p>
              Je hoeft de taal niet te spreken
              <br />
              om de wedstrijd te voelen.
            </p>
            <div className="ticket-line" />
            <div className="ticket-bottom">
              <span>
                VAN
                <br />
                <strong>Overal</strong>
              </span>
              <ArrowRight size={22} />
              <span>
                NAAR
                <br />
                <strong>Voetbal</strong>
              </span>
            </div>
            <div className="barcode" />
            <span className="ticket-code">RBD — 19 08 — 90 MIN</span>
          </div>
          <span className="aside-caption">
            ÉÉN LIEFDE. ALLE WINDRICHTINGEN.
          </span>
        </aside>
      </main>
      <nav className="bottom-nav" aria-label="Hoofdnavigatie">
        <button
          className={tab === "discover" ? "current" : ""}
          onClick={() => setTab("discover")}
        >
          <Compass size={22} />
          <span>Ontdekken</span>
        </button>
        <button
          className={tab === "saved" ? "current" : ""}
          onClick={() => setTab("saved")}
        >
          <span className="nav-icon">
            <Bookmark size={22} />
            {saved.length > 0 && <i>{saved.length}</i>}
          </span>
          <span>Bewaard</span>
        </button>
        <button
          className={tab === "profile" ? "current" : ""}
          onClick={() => setTab("profile")}
        >
          <UserRound size={22} />
          <span>Mijn Robbedoes</span>
        </button>
      </nav>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {modal === "place" && (
        <Modal title="Waar gaat de reis heen?" onClose={() => setModal(null)}>
          <button
            className="location-action"
            onClick={locate}
            disabled={placeBusy}
          >
            <LocateFixed size={20} />
            {placeBusy ? "Locatie zoeken…" : "Gebruik mijn locatie"}
          </button>
          <p className="small-copy">
            Je locatie wordt alleen gebruikt om afstanden te berekenen.
          </p>
          <label className="search-input">
            <Search size={19} />
            <input
              autoFocus
              placeholder="Zoek een stad of dorp"
              aria-label="Zoek een stad of dorp"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {placeError && (
            <p className="field-error" role="alert">
              {placeError}
            </p>
          )}
          <span className="field-heading">
            {query.length >= 2 ? "ZOEKRESULTATEN" : "SNEL KIEZEN"}
          </span>
          {placeBusy ? (
            <p role="status">Even zoeken…</p>
          ) : (
            (query.length >= 2 ? places : PRESETS).map((p) => (
              <button
                className="place-option"
                key={`${p.lat}-${p.lon}`}
                onClick={() => {
                  setPlace(p);
                  setModal(null);
                  setQuery("");
                }}
              >
                <MapPin size={18} />
                <span>{p.name}</span>
                <ArrowRight size={16} />
              </button>
            ))
          )}
          {query.length >= 2 && !placeBusy && !places.length && !placeError && (
            <p>Geen plaats gevonden. Probeer een andere spelling.</p>
          )}
          <p className="small-copy">Plaatsnamen via Open-Meteo / GeoNames.</p>
        </Modal>
      )}
      {modal === "dates" && (
        <Modal title="Wanneer ben je er?" onClose={() => setModal(null)}>
          <div className="date-shortcuts">
            <button
              className="chip"
              onClick={() => {
                const s = localDate();
                setDraftStart(s);
                setDraftEnd(addDays(s, 6));
              }}
            >
              Komende 7 dagen
            </button>
            <button
              className="chip"
              onClick={() => {
                const s = addDays(localDate(), 7);
                setDraftStart(s);
                setDraftEnd(addDays(s, 6));
              }}
            >
              Week erna
            </button>
          </div>
          <label className="form-label">
            Van
            <input
              type="date"
              value={draftStart}
              onChange={(e) => setDraftStart(e.target.value)}
            />
          </label>
          <label className="form-label">
            Tot en met
            <input
              type="date"
              value={draftEnd}
              min={draftStart}
              max={draftStart ? addDays(draftStart, 30) : undefined}
              onChange={(e) => setDraftEnd(e.target.value)}
            />
          </label>
          <p className="small-copy">
            Kies maximaal 31 dagen. Datums gelden in de tijdzone van het
            stadion.
          </p>
          <button
            className="primary full"
            disabled={
              !draftStart ||
              !draftEnd ||
              draftEnd < draftStart ||
              draftEnd > addDays(draftStart, 30)
            }
            onClick={() => {
              setStart(draftStart);
              setEnd(draftEnd);
              setModal(null);
            }}
          >
            Bekijk wedstrijden
            <ArrowRight size={18} />
          </button>
        </Modal>
      )}
      {modal === "filters" && (
        <Modal title="Jouw speelveld" onClose={() => setModal(null)}>
          <div className="range-heading">
            <label htmlFor="radius">Zoekstraal</label>
            <strong>
              {radius}
              <span> km</span>
            </strong>
          </div>
          <input
            id="radius"
            className="range"
            type="range"
            min="10"
            max="500"
            step="5"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          />
          <div className="range-labels">
            <span>10 km</span>
            <span>500 km</span>
          </div>
          <div className="radius-presets">
            {[25, 50, 100, 200].map((n) => (
              <button
                className={radius === n ? "chip active" : "chip"}
                key={n}
                onClick={() => setRadius(n)}
              >
                {n} km
              </button>
            ))}
          </div>
          <p className="small-copy">
            De straal is hemelsbreed, niet de reisafstand.
          </p>
          <button className="primary full" onClick={() => setModal(null)}>
            Toepassen
            <Check size={18} />
          </button>
        </Modal>
      )}
      {modal === "info" && (
        <Modal title="Goed om te weten" onClose={() => setModal(null)}>
          <div className="explanation">
            <h3>Ticketkans</h3>
            <p>
              Over de kaartverkoop is geen betrouwbare informatie beschikbaar;
              daarom staat bij elke wedstrijd ‘Ticketkans onbekend’. Controleer
              altijd vrije verkoop, clubcards, uitvakken en aanvangstijden bij
              de club.
            </p>
            <h3>Welke wedstrijden vind je?</h3>
            <p>
              {COVERAGE}. Daarnaast de {listNl(CUPS.map((c) => c.name))}.
            </p>
            <p>
              De speelschema’s komen van ESPN, dat verschoven aftraptijden het
              snelst verwerkt; de 3. Liga komt van OpenLigaDB. ESPN is geen
              officiële bron. Antwoordt ESPN niet, dan nemen openfootball en
              OpenLigaDB het over waar zij de competitie hebben, en meldt de app
              welke competities ontbreken. Stadionlocaties komen deels van ©
              OpenStreetMap-bijdragers.
            </p>
            <p>
              Niet gedekt zijn onder meer Zwitserland, Polen, Tsjechië en de
              meeste derde niveaus. Staat een aftraptijd er nog niet bij, dan
              heeft de competitie hem nog niet vastgesteld.
            </p>
            <h3>Jouw gegevens</h3>
            <p>
              Locatietoegang is vrijwillig. Coördinaten worden afgerond op
              ongeveer een kilometer voor je zoekopdracht naar de appserver
              gestuurd, niet als locatiegeschiedenis opgeslagen.
              Plaatszoekopdrachten gaan naar Open-Meteo. Zonder account staan
              favorieten alleen in deze browser; met account in je beveiligde
              accountopslag.
            </p>
            <h3>Op je beginscherm</h3>
            <p>
              Op iPhone: open de app in Safari, tik op Delen en kies ‘Zet op
              beginscherm’. Op Android: kies ‘App installeren’ in het
              browsermenu.
            </p>
          </div>
        </Modal>
      )}
      {selected && (
        <Modal title="Een plek op de tribune" onClose={() => setSelected(null)}>
          <div className="detail-match">
            <span className="eyebrow">{selected.league}</span>
            <h2>
              {selected.home}
              <span>tegen</span>
              {selected.away}
            </h2>
            <p>
              {new Date(selected.kickoff).toLocaleString("nl-NL", {
                weekday: "long",
                day: "numeric",
                month: "long",
                ...(selected.timeTbc
                  ? {}
                  : { hour: "2-digit", minute: "2-digit" }),
                timeZone: selected.timezone,
              })}{" "}
              ·{" "}
              {selected.timeTbc
                ? "aanvangstijd nog niet bekend"
                : "lokale tijd"}
            </p>
          </div>
          <div className="detail-venue">
            <MapPin size={20} />
            <span>
              <strong>{selected.stadium}</strong>
              <small>
                {selected.city}
                {selected.distance !== undefined
                  ? ` · ${selected.approx ? "ongeveer " : ""}${Math.round(selected.distance)} km hemelsbreed`
                  : ""}
                {selected.approx ? " · locatie bij benadering" : ""}
              </small>
            </span>
          </div>
          <div className="ticket-explanation">
            <div>
              <h3>Ticketkans</h3>
              <Stars match={selected} />
            </div>
            <p>{ticketReason(selected)}</p>
          </div>
          {selected.provisional && (
            <p className="small-copy">
              Planning volgens {selected.source ?? "de gegevensbron"}; datum en
              aftraptijd kunnen nog wijzigen.
            </p>
          )}
          {safeUrl(selected.ticketUrl) ? (
            <a
              className="primary full"
              href={safeUrl(selected.ticketUrl)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Bekijk de clubwebsite
              <ExternalLink size={17} />
            </a>
          ) : (
            <a
              className="primary full"
              href={`https://www.google.com/search?q=${encodeURIComponent(`${selected.home} officiële website tickets`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Zoek de clubwebsite
              <ExternalLink size={17} />
            </a>
          )}
          <p className="small-copy centered">
            Controleer tickets en verkoopvoorwaarden bij de club.
          </p>
          <div className="detail-actions">
            <a
              className="secondary"
              href={`https://www.google.com/maps/dir/?api=1&destination=${
                selected.approx
                  ? encodeURIComponent(`${selected.stadium}, ${selected.city}`)
                  : `${selected.lat},${selected.lon}`
              }`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Navigation size={17} />
              Route
            </a>
            <button
              className="secondary"
              onClick={() => exportCalendar(selected)}
            >
              <CalendarDays size={17} />
              Agenda
            </button>
            <button className="secondary" onClick={() => save(selected)}>
              <Bookmark size={17} />
              {saved.some((s) => s.id === selected.id) ? "Bewaard" : "Bewaren"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
