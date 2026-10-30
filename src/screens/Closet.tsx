import { ItemTile } from '../components/ItemTile';
import { db, useItems } from '../db';
import { kindInfo, SLOT_LABELS, SLOT_ORDER } from '../engine/taxonomy';
import type { Item } from '../engine/types';

export function Closet({ onEdit }: { onEdit: (item?: Item) => void }) {
  const items = useItems();
  if (!items) return <main className="screen" />;

  const laundry = items.filter((i) => i.status === 'laundry');
  const markClean = () => db.items.bulkPut(laundry.map((i) => ({ ...i, status: 'clean' as const })));

  return (
    <main className="screen closet">
      <header className="screen-head">
        <h1>Closet</h1>
        <button type="button" className="btn primary" onClick={() => onEdit()}>
          Add clothes
        </button>
      </header>

      {items.length === 0 && (
        <div className="notice">
          <p>
            Your closet is empty. Start with what you wear most: a few tops, a pair or two of trousers or skirts, and
            your everyday shoes. Photos are optional.
          </p>
        </div>
      )}

      {laundry.length > 0 && (
        <div className="laundry-bar">
          <p>
            {laundry.length} {laundry.length === 1 ? 'item is' : 'items are'} in the laundry and won’t be suggested.
          </p>
          <button type="button" className="btn" onClick={markClean}>
            Laundry’s done
          </button>
        </div>
      )}

      {SLOT_ORDER.map((slot) => {
        const group = items.filter((i) => kindInfo(i.kind).slot === slot);
        if (!group.length) return null;
        return (
          <section key={slot} className="closet-group">
            <h2>
              {SLOT_LABELS[slot]} <span className="count">{group.length}</span>
            </h2>
            <div className="tiles">
              {group.map((item) => (
                <ItemTile
                  key={item.id}
                  item={item}
                  onClick={() => onEdit(item)}
                  dim={item.status === 'laundry'}
                  label={item.status === 'laundry' ? 'In the laundry' : undefined}
                />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
