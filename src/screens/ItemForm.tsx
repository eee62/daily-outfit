import { useState, type CSSProperties } from 'react';
import { db } from '../db';
import { colorInfo, COLORS } from '../engine/colors';
import { FORMALITY_LABELS, KINDS, kindInfo, SLOT_LABELS, SLOT_ORDER } from '../engine/taxonomy';
import type { Item, Pattern } from '../engine/types';
import { processPhoto } from '../image';

const PATTERNS: { id: Pattern; label: string }[] = [
  { id: 'plain', label: 'Plain' },
  { id: 'striped', label: 'Striped' },
  { id: 'checked', label: 'Checked' },
  { id: 'floral', label: 'Floral' },
  { id: 'print', label: 'Print or graphic' },
];

const WARMTH = [
  { factor: 0.7, label: 'Thinner than most' },
  { factor: 1, label: 'Normal' },
  { factor: 1.3, label: 'Warmer than most' },
];

function autoName(kind: string, color: string): string {
  if (!kind) return '';
  const label = kindInfo(kind).label.toLowerCase();
  return color ? `${colorInfo(color).label} ${label}` : label.charAt(0).toUpperCase() + label.slice(1);
}

export function ItemForm({ item, onDone }: { item?: Item; onDone: () => void }) {
  const [kind, setKind] = useState(item?.kind ?? '');
  const [color, setColor] = useState(item?.color ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [nameEdited, setNameEdited] = useState(!!item);
  const [photo, setPhoto] = useState(item?.photo);
  const [pattern, setPattern] = useState<Pattern>(item?.pattern ?? 'plain');
  const [formality, setFormality] = useState<[number, number]>(
    item ? [item.formalityMin, item.formalityMax] : [1, 2],
  );
  const [warmthIdx, setWarmthIdx] = useState(() => {
    if (!item || !kindInfo(item.kind).warmth) return 1;
    const ratio = item.warmth / kindInfo(item.kind).warmth;
    return ratio < 0.85 ? 0 : ratio > 1.15 ? 2 : 1;
  });
  const [waterproof, setWaterproof] = useState(item?.waterproof ?? false);
  const [avoidRain, setAvoidRain] = useState(item?.avoidRain ?? false);
  const [laundry, setLaundry] = useState(item?.status === 'laundry');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const shownName = nameEdited ? name : autoName(kind, color);

  const pickKind = (id: string) => {
    const k = kindInfo(id);
    setKind(id);
    setFormality(k.formality);
    setWaterproof(!!k.waterproof);
    setAvoidRain(!!k.avoidRain);
  };

  const onPhoto = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const res = await processPhoto(file);
      setPhoto(res.dataUrl);
      if (!color || !item) setColor(res.color);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const tapFormality = (level: number) => {
    const [lo, hi] = formality;
    if (level < lo) setFormality([level, hi]);
    else if (level > hi) setFormality([lo, level]);
    else if (lo === hi) return;
    else if (level === lo) setFormality([lo + 1, hi]);
    else if (level === hi) setFormality([lo, hi - 1]);
    else setFormality([level, level]);
  };

  const save = async (another: boolean) => {
    const k = kindInfo(kind);
    const saved: Item = {
      id: item?.id ?? crypto.randomUUID(),
      name: shownName.trim() || autoName(kind, color),
      kind,
      color,
      pattern,
      formalityMin: formality[0],
      formalityMax: formality[1],
      warmth: Math.round(k.warmth * WARMTH[warmthIdx].factor * 100) / 100,
      waterproof,
      avoidRain,
      status: laundry ? 'laundry' : 'clean',
      photo,
      createdAt: item?.createdAt ?? new Date().toISOString(),
    };
    await db.items.put(saved);
    if (!another) return onDone();
    setMessage(`Saved: ${saved.name}`);
    setKind('');
    setColor('');
    setName('');
    setNameEdited(false);
    setPhoto(undefined);
    setPattern('plain');
    setWarmthIdx(1);
    setLaundry(false);
    window.scrollTo({ top: 0 });
  };

  const remove = async () => {
    if (!item || !confirm(`Delete ${item.name}? This can’t be undone.`)) return;
    await db.items.delete(item.id);
    onDone();
  };

  const ready = !!kind && !!color && !busy;

  return (
    <main className="screen form">
      <header className="form-head">
        <button type="button" className="link-btn" onClick={onDone}>
          Cancel
        </button>
        <h1>{item ? 'Edit item' : 'Add clothes'}</h1>
        <span />
      </header>

      {message && <p className="saved">{message}</p>}

      <section className="field">
        <label className={`photo-drop${photo ? ' has' : ''}`}>
          {photo ? <img src={photo} alt="" /> : <span>{busy ? 'Reading photo…' : 'Add a photo (optional)'}</span>}
          <input type="file" accept="image/*" onChange={(e) => onPhoto(e.target.files?.[0])} />
        </label>
        {photo && (
          <button type="button" className="link-btn" onClick={() => setPhoto(undefined)}>
            Remove photo
          </button>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      <section className="field">
        <h2>What is it?</h2>
        {SLOT_ORDER.map((slot) => (
          <div key={slot} className="kind-group">
            <h3>{SLOT_LABELS[slot]}</h3>
            <div className="chips">
              {KINDS.filter((k) => k.slot === slot).map((k) => (
                <button key={k.id} type="button" className="chip" aria-pressed={kind === k.id} onClick={() => pickKind(k.id)}>
                  <span aria-hidden="true">{k.emoji}</span> {k.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="field">
        <h2>
          Colour{color && <span className="muted"> {colorInfo(color).label}</span>}
        </h2>
        <div className="colors">
          {COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className="color-dot"
              style={{ '--dot': c.hex } as CSSProperties}
              aria-pressed={color === c.id}
              aria-label={c.label}
              title={c.label}
              onClick={() => setColor(c.id)}
            />
          ))}
        </div>
      </section>

      <section className="field">
        <h2>
          <label htmlFor="item-name">Name</label>
        </h2>
        <input
          id="item-name"
          className="input"
          value={shownName}
          placeholder="Pick a type and colour first"
          onChange={(e) => {
            setNameEdited(true);
            setName(e.target.value);
          }}
        />
      </section>

      <details className="field more">
        <summary>More details</summary>

        <h3>How dressy is it?</h3>
        <div className="chips">
          {FORMALITY_LABELS.map((label, level) => (
            <button
              key={label}
              type="button"
              className="chip"
              aria-pressed={level >= formality[0] && level <= formality[1]}
              onClick={() => tapFormality(level)}
            >
              {label}
            </button>
          ))}
        </div>

        <h3>Warmth</h3>
        <div className="chips">
          {WARMTH.map((w, i) => (
            <button key={w.label} type="button" className="chip" aria-pressed={warmthIdx === i} onClick={() => setWarmthIdx(i)}>
              {w.label}
            </button>
          ))}
        </div>

        <h3>Pattern</h3>
        <div className="chips">
          {PATTERNS.map((p) => (
            <button key={p.id} type="button" className="chip" aria-pressed={pattern === p.id} onClick={() => setPattern(p.id)}>
              {p.label}
            </button>
          ))}
        </div>

        <label className="check">
          <input type="checkbox" checked={waterproof} onChange={(e) => setWaterproof(e.target.checked)} />
          Waterproof
        </label>
        <label className="check">
          <input type="checkbox" checked={avoidRain} onChange={(e) => setAvoidRain(e.target.checked)} />
          Keep out of the rain (suede, canvas)
        </label>
      </details>

      <label className="check laundry-check">
        <input type="checkbox" checked={laundry} onChange={(e) => setLaundry(e.target.checked)} />
        In the laundry
      </label>

      <div className="form-actions">
        <button type="button" className="btn primary" disabled={!ready} onClick={() => save(false)}>
          Save
        </button>
        {!item && (
          <button type="button" className="btn" disabled={!ready} onClick={() => save(true)}>
            Save and add another
          </button>
        )}
        {item && (
          <button type="button" className="btn danger" onClick={remove}>
            Delete
          </button>
        )}
      </div>
      {!ready && !busy && <p className="muted small center">Pick what it is and its colour to save.</p>}
    </main>
  );
}
