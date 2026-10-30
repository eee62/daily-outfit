import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ItemTile } from '../components/ItemTile';
import { OutfitCard } from '../components/OutfitCard';
import { Sheet } from '../components/Sheet';
import { db, logEvent, saveSettings, useEvents, useItems, useSettings, type Settings } from '../db';
import { buildProfile, signature, type Profile } from '../engine/profile';
import { alternatives, partsList, recommend, type Suggestion } from '../engine/recommend';
import { kindInfo, OCCASIONS } from '../engine/taxonomy';
import type { AppEvent, Comfort, DayWeather, Item, OccasionId, Part, Reason } from '../engine/types';
import { summarizeDay } from '../engine/weather';
import { addDays, fmtDay, fmtHour, fmtTemp, toISODate } from '../format';
import { getForecast, type Forecast } from '../weatherApi';

type Go = (tab: 'closet' | 'settings', action?: 'add') => void;

export function Today({ onGo }: { onGo: Go }) {
  const settings = useSettings();
  const items = useItems();
  const events = useEvents();
  if (!settings || !items || !events) return <main className="screen" />;
  return <TodayView settings={settings} items={items} events={events} onGo={onGo} />;
}

function TodayView({ settings, items, events, onGo }: { settings: Settings; items: Item[]; events: AppEvent[]; onGo: Go }) {
  // Re-read the clock when the app comes back to the foreground (it may have sat open overnight).
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const onShow = () => document.visibilityState === 'visible' && setNow(new Date());
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, []);

  const [offset, setOffset] = useState(() => (now.getHours() >= settings.toHour ? 1 : 0));
  const target = addDays(now, offset);
  const date = toISODate(target);
  const fromHour = offset === 0 ? Math.min(Math.max(settings.fromHour, now.getHours()), settings.toHour) : settings.fromHour;

  const [occasionPick, setOccasionPick] = useState<Record<string, OccasionId>>({});
  const occasion = occasionPick[date] ?? settings.weekday[target.getDay()];

  const loc = settings.location;
  const [forecast, setForecast] = useState<Forecast | null | undefined>(undefined);
  const load = useCallback(
    async (force = false) => {
      if (!loc) return;
      setForecast(undefined);
      setForecast(await getForecast(loc.lat, loc.lon, force));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loc?.lat, loc?.lon],
  );
  useEffect(() => {
    load();
  }, [load, now]);

  const day = forecast ? summarizeDay(forecast.hourly, date, fromHour, settings.toHour) : null;
  const fmt = (c: number) => fmtTemp(c, settings.units);
  const profile = useMemo(() => buildProfile(events, settings.runs, now), [events, settings.runs, now]);

  const todayISO = toISODate(now);
  const wearing = events
    .filter((e) => e.type === 'wore' && e.date === date)
    .sort((a, b) => b.at.localeCompare(a.at))[0];

  return (
    <main className="screen today">
      <header className="today-head">
        <div className="segmented" role="group" aria-label="Day">
          {['Today', 'Tomorrow'].map((label, i) => (
            <button key={label} type="button" aria-pressed={offset === i} onClick={() => setOffset(i)}>
              {label}
            </button>
          ))}
        </div>
        <p className="date">{fmtDay(target)}</p>
      </header>

      {!loc ? (
        <LocationPrompt onSearch={() => onGo('settings')} />
      ) : forecast === undefined ? (
        <p className="muted pad">Getting the forecast…</p>
      ) : !day ? (
        <div className="notice">
          <p>The forecast couldn’t be loaded. Check your connection and try again.</p>
          <button type="button" className="btn" onClick={() => load(true)}>
            Try again
          </button>
        </div>
      ) : (
        <WeatherPanel day={day} place={loc.name} fmt={fmt} stale={forecast?.stale ? forecast.fetchedAt : undefined} />
      )}

      <CheckIn events={events} items={items} todayISO={todayISO} />

      <div className="occasions" role="group" aria-label="What’s the plan?">
        {OCCASIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            className="chip"
            aria-pressed={occasion === o.id}
            onClick={() => setOccasionPick((p) => ({ ...p, [date]: o.id }))}
          >
            {o.label}
          </button>
        ))}
      </div>

      {wearing && (
        <section className="wearing">
          <div className="section-head">
            <h2>{offset === 0 ? 'You’re wearing' : 'Tomorrow you’ll wear'}</h2>
            <button type="button" className="link-btn" onClick={() => db.events.delete(wearing.id)}>
              Undo
            </button>
          </div>
          <div className="tiles">
            {wearing.itemIds
              .map((id) => items.find((i) => i.id === id))
              .filter((i): i is Item => !!i)
              .map((i) => (
                <ItemTile key={i.id} item={i} />
              ))}
          </div>
        </section>
      )}

      {day && (
        <Suggestions
          key={`${date}|${occasion}`}
          items={items}
          events={events}
          day={day}
          dayKey={`${date}|${fromHour}|${settings.toHour}|${forecast?.fetchedAt}`}
          occasion={occasion}
          profile={profile}
          date={date}
          todayISO={todayISO}
          fmt={fmt}
          wearing={wearing}
          onGo={onGo}
        />
      )}
    </main>
  );
}

function Suggestions(props: {
  items: Item[];
  events: AppEvent[];
  day: DayWeather;
  dayKey: string;
  occasion: OccasionId;
  profile: Profile;
  date: string;
  todayISO: string;
  fmt: (c: number) => string;
  wearing?: AppEvent;
  onGo: Go;
}) {
  const { items, events, day, dayKey, occasion, profile, date, todayISO, fmt, wearing, onGo } = props;
  const [seed, setSeed] = useState(0);
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [seen, setSeen] = useState<Set<string>>(new Set());
  const [swapped, setSwapped] = useState<Record<string, Suggestion>>({});
  const [swapping, setSwapping] = useState<{ base: string; current: Suggestion; part: Part } | null>(null);

  // Read through a ref so liking an outfit doesn't reshuffle the cards under your thumb.
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const ctx = { day, occasion, profile, date, fmtTemp: fmt };

  // A ranked pool of ideas: turning one down brings in the next without reshuffling the others.
  const rec = useMemo(
    () =>
      recommend(items, { ...ctx, profile: profileRef.current }, {
        count: 12,
        exclude: seen,
        seed: seed === 0 ? undefined : seed,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, dayKey, occasion, seed, seen],
  );

  if (rec.missing.length) {
    return (
      <div className="notice">
        <p>To get outfit ideas, add {listJoin(rec.missing)} to your closet. Anything in the laundry doesn’t count.</p>
        <button type="button" className="btn primary" onClick={() => onGo('closet', 'add')}>
          Add clothes
        </button>
      </div>
    );
  }

  const wornSig = wearing ? signature(wearing.itemIds) : '';
  const cards = rec.suggestions
    .filter((s) => !removed.has(s.signature))
    .map((s) => ({ base: s.signature, s: swapped[s.signature] ?? s }))
    .filter((c) => c.base !== wornSig && c.s.signature !== wornSig)
    .slice(0, 3);
  const ids = (s: Suggestion) => partsList(s.outfit).map((i) => i.id);
  const likedToday = (s: Suggestion) =>
    events.find((e) => e.type === 'like' && toISODate(new Date(e.at)) === todayISO && signature(e.itemIds) === s.signature);

  const wear = async (s: Suggestion) => {
    if (wearing) await db.events.delete(wearing.id);
    await logEvent({ type: 'wore', itemIds: ids(s), date, occasion });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const like = async (s: Suggestion) => {
    const existing = likedToday(s);
    if (existing) await db.events.delete(existing.id);
    else await logEvent({ type: 'like', itemIds: ids(s), occasion });
  };
  const dislike = async (base: string, s: Suggestion, reasons: Reason[]) => {
    await logEvent({ type: 'dislike', itemIds: ids(s), occasion, reasons });
    setRemoved((r) => new Set([...r, base]));
  };
  const pickSwap = async (alt: Suggestion) => {
    if (!swapping) return;
    const from = swapping.current.outfit.parts[swapping.part];
    const to = alt.outfit.parts[swapping.part];
    await logEvent({ type: 'swap', itemIds: ids(alt), occasion, from: from?.id, to: to?.id });
    setSwapped((m) => ({ ...m, [swapping.base]: alt }));
    setSwapping(null);
  };

  return (
    <section className="suggestions">
      <div className="section-head">
        <h2>{wearing ? 'Other ideas' : 'Ideas for you'}</h2>
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setSeen((s) => new Set([...s, ...cards.map((c) => c.base)]));
            setSwapped({});
            setRemoved(new Set());
            setSeed((n) => n + 1);
          }}
        >
          Show different ones
        </button>
      </div>
      {cards.length === 0 && <p className="muted">That’s every idea for now. Tap “Show different ones” to start over.</p>}
      {rec.level >= 2 && (
        <p className="muted">Nothing in your closet is a perfect match for this, so these are the closest options.</p>
      )}

      {cards.map(({ base, s }) => (
        <OutfitCard
          key={base}
          suggestion={s}
          liked={!!likedToday(s)}
          onWear={() => wear(s)}
          onLike={() => like(s)}
          onDislike={(r) => dislike(base, s, r)}
          onSwap={(part) => setSwapping({ base, current: s, part })}
        />
      ))}

      {swapping && (
        <SwapSheet
          part={swapping.part}
          current={swapping.current}
          options={alternatives(items, swapping.current.outfit, swapping.part, ctx)}
          onPick={pickSwap}
          onClose={() => setSwapping(null)}
        />
      )}
    </section>
  );
}

function SwapSheet({
  part,
  current,
  options,
  onPick,
  onClose,
}: {
  part: Part;
  current: Suggestion;
  options: Suggestion[];
  onPick: (s: Suggestion) => void;
  onClose: () => void;
}) {
  const item = current.outfit.parts[part];
  return (
    <Sheet title={item ? `Instead of the ${item.name.toLowerCase()}` : 'Swap'} onClose={onClose}>
      {options.length === 0 ? (
        <p className="muted">Nothing else in your closet works here for this weather and occasion.</p>
      ) : (
        <div className="tiles">
          {options.map((o) => {
            const replacement = o.outfit.parts[part];
            return replacement ? (
              <ItemTile key={replacement.id} item={replacement} onClick={() => onPick(o)} />
            ) : (
              <button key="none" type="button" className="tile without" onClick={() => onPick(o)}>
                <span className="pic">Without it</span>
                <span className="tile-name">Skip this layer</span>
              </button>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}

function WeatherPanel({ day, place, fmt, stale }: { day: DayWeather; place: string; fmt: (c: number) => string; stale?: number }) {
  const lo = Math.min(...day.hours.map((h) => h.feels)) - 3;
  const hi = Math.max(...day.hours.map((h) => h.feels)) + 1;
  return (
    <section className="weather" aria-label="Weather">
      <p className="place">
        {place}, {fmtHour(day.fromHour)} to {fmtHour(day.toHour)}
      </p>
      <p className="feels-label">Feels like</p>
      <div className="temps">
        <div>
          <span className="temp">{fmt(day.feelsMin)}</span>
          <span className="cap">at its coldest</span>
        </div>
        <div>
          <span className="temp">{fmt(day.feelsMax)}</span>
          <span className="cap">at its warmest</span>
        </div>
      </div>
      <div className="ribbon" aria-hidden="true">
        {day.hours.map((h, i) => (
          <div key={h.hour} className="hour">
            <div
              className={`bar${h.rainChance >= 50 ? ' wet' : ''}`}
              style={{ '--h': Math.max(0.08, (h.feels - lo) / (hi - lo || 1)) } as CSSProperties}
            />
            <span className="hour-label">{i % 3 === 0 ? fmtHour(h.hour) : ''}</span>
          </div>
        ))}
      </div>
      <p className="weather-note">{weatherNote(day)}</p>
      {stale && (
        <p className="muted small">
          You’re offline. This forecast is from {new Date(stale).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.
        </p>
      )}
    </section>
  );
}

function weatherNote(day: DayWeather): string {
  const notes: string[] = [];
  if (day.snowy) notes.push('Snow expected.');
  else if (day.rainy) {
    const first = day.hours.find((h) => h.rainChance >= 50);
    notes.push(first ? `Rain likely from ${fmtHour(first.hour)} (${day.rainChance}%).` : 'Rain likely.');
  } else if (day.rainChance >= 30) notes.push(`Small chance of rain (${day.rainChance}%).`);
  else notes.push(day.uvMax >= 6 ? 'Dry, with strong sun.' : 'Dry all day.');
  if (day.gustMax >= 40) notes.push(`Windy, with gusts up to ${Math.round(day.gustMax)} km/h.`);
  return notes.join(' ');
}

function CheckIn({ events, items, todayISO }: { events: AppEvent[]; items: Item[]; todayISO: string }) {
  const threeDaysAgo = toISODate(addDays(new Date(todayISO + 'T12:00'), -3));
  const last = events
    .filter((e) => e.type === 'wore' && e.date && e.date < todayISO && e.date >= threeDaysAgo)
    .sort((a, b) => b.date!.localeCompare(a.date!))[0];
  if (!last || events.some((e) => e.type === 'comfort' && e.wearId === last.id)) return null;

  const yesterday = toISODate(addDays(new Date(todayISO + 'T12:00'), -1));
  const when = last.date === yesterday ? 'yesterday' : `on ${new Date(last.date + 'T12:00').toLocaleDateString([], { weekday: 'long' })}`;
  const names = last.itemIds
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is Item => !!i && kindInfo(i.kind).slot !== 'shoes')
    .map((i) => i.name.toLowerCase());
  const answer = (comfort?: Comfort) => logEvent({ type: 'comfort', itemIds: last.itemIds, wearId: last.id, comfort });

  return (
    <section className="checkin">
      <p>
        How did {when}’s outfit feel? <span className="muted">({names.join(', ')})</span>
      </p>
      <div className="chips">
        <button type="button" className="chip" onClick={() => answer('cold')}>
          Too cold
        </button>
        <button type="button" className="chip" onClick={() => answer('ok')}>
          Just right
        </button>
        <button type="button" className="chip" onClick={() => answer('warm')}>
          Too warm
        </button>
        <button type="button" className="chip ghost" onClick={() => answer()}>
          Skip
        </button>
      </div>
    </section>
  );
}

function LocationPrompt({ onSearch }: { onSearch: () => void }) {
  const [error, setError] = useState('');
  const useMine = () => {
    if (!navigator.geolocation) return setError('This browser can’t share your location. Search for your city instead.');
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        saveSettings({
          location: {
            name: 'Your location',
            lat: Math.round(pos.coords.latitude * 100) / 100,
            lon: Math.round(pos.coords.longitude * 100) / 100,
          },
        }),
      () => setError('Location is turned off for this app. Search for your city instead.'),
    );
  };
  return (
    <div className="notice">
      <p>Where are you? The forecast needs a location.</p>
      <div className="row">
        <button type="button" className="btn primary" onClick={useMine}>
          Use my location
        </button>
        <button type="button" className="btn" onClick={onSearch}>
          Search for a city
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function listJoin(xs: string[]): string {
  if (xs.length <= 1) return xs.join('');
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}
