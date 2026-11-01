# The Art House — handmade art storefront

Next.js App Router, TypeScript, Tailwind CSS and Supabase based storefront inspired by Craftitude’s product-first navigation, best-seller grid and promotional sections.

The public homepage and shop now use `@flowstack-ui/brick@0.3.0` components. See [FLOWSTACK_NOTES.md](./FLOWSTACK_NOTES.md) for the package guidance, artwork asset, and remaining UI scope.

## Current status

This is a **local, partially implemented application**, not a deployable commerce store. The selected existing Supabase project is inactive and cannot be restored through the connected integration. Read [SCHEMA_PLAN.md](./SCHEMA_PLAN.md) before applying any database change. No migration has been applied.

Implemented locally: responsive homepage, catalogue and product details, search/filter/sort, Supabase Auth UI, custom-art specifications and live estimate UI, server recalculation and authenticated request endpoint, private reference-image upload path, account request/order lists, protected admin shell, admin product creation, pricing rule creation, custom-request list/detail/status editing, order list, and content settings UI. These data flows are coded to a proposed schema and have **not** been verified against a live database.

Not yet implemented: safe schema migration, RLS/storage policies, product editing and image upload management, atomic inventory reservation, working cart and checkout, Razorpay order/webhook verification, refunds, customer notifications, full content management, and end-to-end tests. Checkout is intentionally disabled until unique artwork inventory can be reserved atomically and payment events verified. The admin status change and history insert also need a database transaction before production use.

## Connect to the same existing Supabase project

1. Obtain an active existing project or restorable backup. Inspect the schema and reconcile it with `SCHEMA_PLAN.md` before any migration.
2. Copy `.env.example` to `.env.local`. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from that **same existing project**. Only the publishable key may be exposed to the browser. Never put a secret or service role key in a `NEXT_PUBLIC_` variable.
3. Configure the actual database tables, RLS, Storage bucket and administrator role. Only grant admin role through a trusted database operation; do not allow customers to assign themselves roles.
4. Run `npm ci`, then `npm run dev`. Run `npm run build` before deployment.

No integration credential was copied into the application. The connected ChatGPT integration does not automatically provide runtime credentials to a local Next.js process. The app therefore reads authorized environment variables supplied by the project owner.

## Design reference

The layout follows [Craftitude](https://www.craftitude.co.in/) in its simple top navigation, prominent shop entry, best-seller cards, promotional copy and broad footer, adapted to original paintings and commissions.
