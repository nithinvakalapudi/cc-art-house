'use client';

import { Children, isValidElement, useState, type ReactNode } from 'react';
import { Search, UsersRound } from 'lucide-react';

export default function AdminCustomerSearch({ children, total }: { children: ReactNode; total: number }) {
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLocaleLowerCase();
  const matches = Children.toArray(children).filter(card =>
    !normalized || (isValidElement<{ 'data-search'?: string }>(card) &&
      card.props['data-search']?.includes(normalized))
  );
  const visible = matches.length;

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
      <div className="admin-customer-list">{matches}</div>
      {total > 0 && visible === 0 && <section className="panel admin-empty-state">No customers match “{query}”. Try another name, email or phone number.</section>}
    </>
  );
}
