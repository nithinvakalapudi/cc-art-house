'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Search, UsersRound } from 'lucide-react';

export default function AdminCustomerSearch({ children, total }: { children: ReactNode; total: number }) {
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(total);

  useEffect(() => {
    const cards = [...(listRef.current?.querySelectorAll<HTMLElement>('.admin-customer-card') ?? [])];
    const normalized = query.trim().toLocaleLowerCase();
    let count = 0;
    for (const card of cards) {
      const matches = !normalized || (card.dataset.search || '').includes(normalized);
      card.hidden = !matches;
      if (matches) count += 1;
    }
    setVisible(count);
  }, [query, total]);

  return (
    <>
      <section className="admin-user-toolbar" aria-label="Find a customer">
        <label className="admin-user-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search users and customers</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, email or phone" />
          {query && <button type="button" onClick={() => setQuery('')} aria-label="Clear search">Clear</button>}
        </label>
        <span className="admin-user-result"><UsersRound size={16} aria-hidden="true" />{visible} {visible === 1 ? 'customer' : 'customers'}</span>
      </section>
      <div ref={listRef} className="admin-customer-list">{children}</div>
      {total > 0 && visible === 0 && <section className="panel admin-empty-state">No customers match “{query}”. Try another name, email or phone number.</section>}
    </>
  );
}
