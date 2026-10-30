import { useState } from 'react';
import type { Item } from './engine/types';
import { Closet } from './screens/Closet';
import { ItemForm } from './screens/ItemForm';
import { SettingsScreen } from './screens/Settings';
import { Today } from './screens/Today';

type Tab = 'today' | 'closet' | 'settings';

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: 'closet', label: 'Closet' },
  { id: 'settings', label: 'Settings' },
];

export function App() {
  const [tab, setTab] = useState<Tab>('today');
  const [editing, setEditing] = useState<{ item?: Item } | null>(null);

  const go = (next: Tab) => {
    setTab(next);
    window.scrollTo({ top: 0 });
  };

  if (editing) {
    return (
      <div className="app">
        <ItemForm
          item={editing.item}
          onDone={() => {
            setEditing(null);
            window.scrollTo({ top: 0 });
          }}
        />
      </div>
    );
  }

  return (
    <div className="app">
      {tab === 'today' && (
        <Today
          onGo={(next, action) => {
            go(next);
            if (action === 'add') setEditing({});
          }}
        />
      )}
      {tab === 'closet' && <Closet onEdit={(item) => setEditing({ item })} />}
      {tab === 'settings' && <SettingsScreen />}

      <nav className="tabs" aria-label="Main">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
