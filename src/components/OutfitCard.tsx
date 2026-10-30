import { useState } from 'react';
import type { Suggestion } from '../engine/recommend';
import { PART_ORDER, type Item, type Part, type Reason } from '../engine/types';
import { ItemTile } from './ItemTile';

const REASONS: { id: Reason; label: string }[] = [
  { id: 'tooWarm', label: 'Too warm' },
  { id: 'tooCold', label: 'Too cold' },
  { id: 'tooDressy', label: 'Too dressy' },
  { id: 'tooCasual', label: 'Too casual' },
  { id: 'notTogether', label: 'Don’t go together' },
  { id: 'other', label: 'Just not feeling it' },
];

export function OutfitCard({
  suggestion,
  liked,
  onWear,
  onLike,
  onDislike,
  onSwap,
}: {
  suggestion: Suggestion;
  liked: boolean;
  onWear: () => void;
  onLike: () => void;
  onDislike: (reasons: Reason[]) => void;
  onSwap: (part: Part) => void;
}) {
  const [asking, setAsking] = useState(false);
  const { outfit, reasons } = suggestion;
  const parts = PART_ORDER.filter((p) => outfit.parts[p]).map((p) => [p, outfit.parts[p]!] as [Part, Item]);

  return (
    <article className="outfit">
      <div className="outfit-reasons">
        {reasons.map((r) => (
          <p key={r}>{r}</p>
        ))}
      </div>

      <div className="tiles">
        {parts.map(([part, item]) => (
          <ItemTile key={item.id} item={item} onClick={() => onSwap(part)} label="Swap" />
        ))}
        {outfit.accessories.map((item) => (
          <ItemTile key={item.id} item={item} label="Bring" />
        ))}
      </div>

      {asking ? (
        <div className="reasons-ask">
          <p>What’s wrong with it?</p>
          <div className="chips">
            {REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                className="chip"
                onClick={() => {
                  setAsking(false);
                  onDislike([r.id]);
                }}
              >
                {r.label}
              </button>
            ))}
            <button type="button" className="chip ghost" onClick={() => setAsking(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="outfit-actions">
          <button type="button" className="btn primary" onClick={onWear}>
            Wear this
          </button>
          <button
            type="button"
            className={`icon-btn big${liked ? ' on' : ''}`}
            onClick={onLike}
            aria-pressed={liked}
            aria-label={liked ? 'Liked' : 'Like'}
          >
            {liked ? '♥' : '♡'}
          </button>
          <button type="button" className="icon-btn big" onClick={() => setAsking(true)} aria-label="Not this one">
            ✕
          </button>
        </div>
      )}
    </article>
  );
}
