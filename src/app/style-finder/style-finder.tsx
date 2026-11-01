'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';

type Art = {
  id: string;
  slug: string;
  title: string;
  image_url: string | null;
  price: number | null;
  original_price: number | null;
  palette: string[] | null;
  room_tags: string[] | null;
  available: boolean;
};

const roomOptions = ['living room', 'bedroom', 'office', 'entryway', 'gift'] as const;
const moodOptions = ['warm', 'calm', 'bold', 'joyful', 'minimal'] as const;

export default function StyleFinder({ products, unavailable = false }: { products: Art[]; unavailable?: boolean }) {
  const [room, setRoom] = useState<(typeof roomOptions)[number]>('living room');
  const [mood, setMood] = useState<(typeof moodOptions)[number]>('warm');
  const results = useMemo(() => products
    .map((product, index) => {
      const words = [...(product.room_tags || []), ...(product.palette || []), product.title].join(' ').toLowerCase();
      const score = (words.includes(room) ? 3 : 0) + (words.includes(mood) ? 2 : 0) + (product.available ? 1 : 0);
      return { product, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 3), [products, room, mood]);

  return <div className="content style-finder">
    <section className="panel style-quiz" aria-labelledby="style-quiz-title">
      <p className="craft-eyebrow">A LITTLE ABOUT YOUR SPACE</p>
      <h2 id="style-quiz-title">Your room, your feeling</h2>
      <p className="style-quiz-intro">Choose a room and a mood. We’ll match them with available original paintings.</p>
      <div className="style-options">
        <label>Which room?<select value={room} onChange={event => setRoom(event.target.value as typeof room)}>{roomOptions.map(option => <option key={option} value={option}>{option.replace(/^./, letter => letter.toUpperCase())}</option>)}</select></label>
        <label>What feeling?<select value={mood} onChange={event => setMood(event.target.value as typeof mood)}>{moodOptions.map(option => <option key={option} value={option}>{option.replace(/^./, letter => letter.toUpperCase())}</option>)}</select></label>
      </div>
      <p className="muted">You can update these choices any time. Browse the full collection below.</p>
    </section>
    <section aria-labelledby="style-results-title">
      <p className="craft-eyebrow">YOUR CURATED EDIT</p>
      <h2 id="style-results-title">Pieces chosen for you</h2>
      <div className="style-results">
        {results.map(({ product }) => <article key={product.id}>
          {product.image_url ? <img src={product.image_url} alt={product.title} loading="lazy"/> : <div className="product-placeholder" aria-hidden="true">✦</div>}
          <h3>{product.title}</h3>
          <p>{product.palette?.length ? product.palette.join(' · ') : product.room_tags?.length ? product.room_tags.join(' · ') : 'Original handmade painting'}</p>
          {product.original_price && product.price && product.original_price > product.price && <del>₹{Number(product.original_price).toLocaleString('en-IN')}</del>}
          <strong>₹{Number(product.price || 0).toLocaleString('en-IN')}</strong>
          <Link href={`/shop/${product.slug}`}>View artwork <span aria-hidden="true">→</span></Link>
        </article>)}
        {!results.length && <div className="empty-card"><h3>{unavailable ? 'The collection could not load' : 'New art is on its way'}</h3><p>{unavailable ? 'Please try again in a moment, or browse the shop directly.' : 'There are no available paintings to recommend right now.'}</p><Link href="/shop">Browse paintings →</Link></div>}
      </div>
      {!!results.length && <p className="style-finder-shop-link"><Link href="/shop">Explore all paintings →</Link></p>}
    </section>
  </div>;
}
