'use client';

import { useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Button, Field, Grid, Input, NativeSelect } from '@flowstack-ui/brick';
import type { Category } from '@/lib/data';

export default function ShopFilters({ categories, params }: {
  categories: Category[];
  params: { category?: string; q?: string; sort?: string };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const query = new URLSearchParams();
    for (const key of ['category', 'q', 'sort']) {
      const value = String(form.get(key) ?? '').trim();
      if (value) query.set(key, value);
    }
    startTransition(() => router.push(`/shop?${query.toString()}`));
  }

  return <form className="shop-filter-form" onSubmit={applyFilters}>
    <Grid.Root columns={{ initial: 1, sm: 2, lg: 4 }} gap={3} align="end">
      <Field.Root><Field.Label>Search paintings</Field.Label><Input name="q" type="search" defaultValue={params.q || ''} placeholder="Title or subject" startAdornment={<Search size={18} />} /></Field.Root>
      <Field.Root><Field.Label>Category <span aria-hidden="true">*</span></Field.Label><NativeSelect.Root><NativeSelect.Field name="category" required defaultValue={params.category || ''}><option value="" disabled>Choose a category</option>{categories.map(c => <option value={c.slug} key={c.id}>{c.name}</option>)}</NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root></Field.Root>
      <Field.Root><Field.Label>Sort by</Field.Label><NativeSelect.Root><NativeSelect.Field name="sort" defaultValue={params.sort || ''}><option value="">Newest</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></NativeSelect.Field><NativeSelect.Indicator /></NativeSelect.Root></Field.Root>
      <Button type="submit" tone="accent" startIcon={<SlidersHorizontal />} disabled={pending}>{pending ? 'Loading paintings…' : 'Apply filters'}</Button>
    </Grid.Root>
    <p className="shop-filter-help" aria-live="polite">{pending ? 'Updating your results…' : 'Choose a category to apply filters.'}</p>
  </form>;
}
