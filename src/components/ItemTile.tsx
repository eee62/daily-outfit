import type { CSSProperties } from 'react';
import { colorInfo } from '../engine/colors';
import { kindInfo } from '../engine/taxonomy';
import type { Item } from '../engine/types';

/** A photo of the item, or a pinked fabric swatch in its colour when there's no photo. */
export function ItemPicture({ item }: { item: Item }) {
  if (item.photo) return <img className="pic" src={item.photo} alt="" />;
  const c = colorInfo(item.color);
  return (
    <span className="pic swatch" style={{ '--swatch': c.hex } as CSSProperties}>
      <span className="swatch-emoji" aria-hidden="true">
        {kindInfo(item.kind).emoji}
      </span>
    </span>
  );
}

export function ItemTile({
  item,
  onClick,
  label,
  dim,
}: {
  item: Item;
  onClick?: () => void;
  label?: string;
  dim?: boolean;
}) {
  const content = (
    <>
      <ItemPicture item={item} />
      <span className="tile-name">{item.name}</span>
      {label && <span className="tile-note">{label}</span>}
    </>
  );
  const cls = `tile${dim ? ' dim' : ''}`;
  return onClick ? (
    <button type="button" className={cls} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={cls}>{content}</div>
  );
}
