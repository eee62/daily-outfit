import { useMemo, useState, type FormEvent } from 'react';
import { db, exportBackup, importBackup, saveSettings, useEvents, useSettings } from '../db';
import { buildProfile } from '../engine/profile';
import { occasionInfo, OCCASIONS } from '../engine/taxonomy';
import type { OccasionId, RunsTemp } from '../engine/types';
import { fmtHour, toISODate, WEEKDAYS } from '../format';
import { searchPlaces, type Place } from '../weatherApi';

const HOURS = Array.from({ length: 19 }, (_, i) => i + 5);
// Monday first, as most people read a week.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function SettingsScreen() {
  const settings = useSettings();
  const events = useEvents();
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const profile = useMemo(
    () => (settings && events ? buildProfile(events, settings.runs, new Date()) : null),
    [settings, events],
  );
  if (!settings || !events || !profile) return <main className="screen" />;

  const search = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setError('');
    try {
      setPlaces(await searchPlaces(query.trim()));
    } catch {
      setError('Search didn’t work. Check your connection and try again.');
    }
  };

  const useMine = () => {
    setError('');
    navigator.geolocation?.getCurrentPosition(
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

  const download = async () => {
    const url = URL.createObjectURL(await exportBackup());
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-outfit-backup-${toISODate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('Backup downloaded.');
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    if (!confirm('Restoring replaces everything in the app with the backup. Continue?')) return;
    try {
      const { items } = await importBackup(file);
      setStatus(`Restored ${items} items.`);
    } catch (e) {
      setStatus((e as Error).message);
    }
  };

  const clearHistory = async () => {
    if (!confirm('Forget everything the app has learned from your feedback? Your clothes stay.')) return;
    await db.events.clear();
    setStatus('History cleared.');
  };

  const wears = events.filter((e) => e.type === 'wore').length;
  const bias = profile.thermalBias;
  const warmthLine =
    bias > 0.4
      ? 'You like outfits warmer than average, so it suggests an extra layer sooner.'
      : bias < -0.4
        ? 'You like outfits cooler than average, so it suggests fewer layers.'
        : 'Your warmth preference is about average so far.';
  const formalityLines = (Object.entries(profile.formalityOffset) as [OccasionId, number][])
    .filter(([, v]) => Math.abs(v) >= 0.5)
    .map(([occ, v]) => `${occasionInfo(occ).label}: you dress ${v > 0 ? 'up' : 'down'} more than usual.`);

  return (
    <main className="screen settings">
      <header className="screen-head">
        <h1>Settings</h1>
      </header>

      <section className="field">
        <h2>Location</h2>
        <p>{settings.location ? settings.location.name : 'Not set yet'}</p>
        <button type="button" className="btn" onClick={useMine}>
          Use my location
        </button>
        <form className="search" onSubmit={search}>
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Or search for a city"
            aria-label="City"
          />
          <button type="submit" className="btn">
            Search
          </button>
        </form>
        {places && places.length === 0 && <p className="muted">No places found. Check the spelling.</p>}
        {places && places.length > 0 && (
          <ul className="places">
            {places.map((p) => (
              <li key={`${p.lat},${p.lon}`}>
                <button
                  type="button"
                  className="place-btn"
                  onClick={() => {
                    saveSettings({ location: { name: p.name, lat: p.lat, lon: p.lon } });
                    setPlaces(null);
                    setQuery('');
                  }}
                >
                  <strong>{p.name}</strong> <span className="muted">{p.detail}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="field">
        <h2>Temperature</h2>
        <div className="segmented" role="group" aria-label="Temperature units">
          {(['C', 'F'] as const).map((u) => (
            <button key={u} type="button" aria-pressed={settings.units === u} onClick={() => saveSettings({ units: u })}>
              °{u}
            </button>
          ))}
        </div>
      </section>

      <section className="field">
        <h2>I usually feel</h2>
        <div className="segmented" role="group" aria-label="I usually feel">
          {(
            [
              ['cold', 'Cold'],
              ['normal', 'Normal'],
              ['warm', 'Warm'],
            ] as [RunsTemp, string][]
          ).map(([v, label]) => (
            <button key={v} type="button" aria-pressed={settings.runs === v} onClick={() => saveSettings({ runs: v })}>
              {label}
            </button>
          ))}
        </div>
        <p className="muted small">A starting point. Your “too cold” and “too warm” answers fine-tune it.</p>
      </section>

      <section className="field">
        <h2>When you’re usually out</h2>
        <div className="row">
          <select
            className="input"
            value={settings.fromHour}
            onChange={(e) => saveSettings({ fromHour: Number(e.target.value) })}
            aria-label="From"
          >
            {HOURS.filter((h) => h < settings.toHour).map((h) => (
              <option key={h} value={h}>
                {fmtHour(h)}
              </option>
            ))}
          </select>
          <span>to</span>
          <select
            className="input"
            value={settings.toHour}
            onChange={(e) => saveSettings({ toHour: Number(e.target.value) })}
            aria-label="To"
          >
            {HOURS.filter((h) => h > settings.fromHour).map((h) => (
              <option key={h} value={h}>
                {fmtHour(h)}
              </option>
            ))}
          </select>
        </div>
        <p className="muted small">Only the weather in these hours counts.</p>
      </section>

      <section className="field">
        <h2>Usual plans</h2>
        <p className="muted small">Picked for you each day. You can still change it on the Today screen.</p>
        <div className="week">
          {WEEK_ORDER.map((d) => (
            <label key={d} className="week-row">
              <span>{WEEKDAYS[d]}</span>
              <select
                className="input"
                value={settings.weekday[d]}
                onChange={(e) => {
                  const weekday = [...settings.weekday];
                  weekday[d] = e.target.value as OccasionId;
                  saveSettings({ weekday });
                }}
              >
                {OCCASIONS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      <section className="field">
        <h2>What it has learned</h2>
        <p>{warmthLine}</p>
        {formalityLines.map((l) => (
          <p key={l}>{l}</p>
        ))}
        <p className="muted small">
          {wears === 0 ? 'No outfits logged yet.' : `${wears} ${wears === 1 ? 'outfit' : 'outfits'} logged.`}
        </p>
        {events.length > 0 && (
          <button type="button" className="btn" onClick={clearHistory}>
            Forget what it learned
          </button>
        )}
      </section>

      <section className="field">
        <h2>Backup</h2>
        <p className="muted small">
          Your clothes and history are saved only on this device. Download a backup now and then so you don’t lose
          them if you change phones.
        </p>
        <div className="row">
          <button type="button" className="btn" onClick={download}>
            Download backup
          </button>
          <label className="btn">
            Restore backup
            <input type="file" accept="application/json,.json" hidden onChange={(e) => restore(e.target.files?.[0])} />
          </label>
        </div>
        {status && <p className="saved">{status}</p>}
      </section>

      <p className="muted small center credit">
        Weather data by <a href="https://open-meteo.com/">Open-Meteo</a>
      </p>
    </main>
  );
}
