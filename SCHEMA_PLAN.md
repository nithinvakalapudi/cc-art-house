# Existing Supabase schema assessment and proposed changes

## Current state (10 October 2026)

The new **Art Store** project `wibumvwhpnqmycjxwyuj` is active in nithinchowdary2532's Org on the Free plan. The app is connected through `.env.local` using its public URL and publishable key. The catalogue migration in `supabase/migrations/20261010_catalogue.sql` has been applied: `categories`, `products`, `product_images`, and `user_roles` exist with row level security. Four published categories are seeded. There are no products yet.

The older project history below remains for context. The custom request, pricing, orders, payments, site content, and private storage tables are still planned and must be migrated before those features are usable.

The selected existing project is `nedhrgdabyvmeedceekb` (`sb1-bikhhpv5`, US East). The connected integration reports it as `INACTIVE`. `list_tables` timed out, and `restore_project` returned: **“Project has been paused for more than 400 days and cannot be restored.”** Its tables, policies, storage buckets, Auth configuration and records could not be inspected. No SQL was run, no migration was applied, and no data was changed.

## Schema contract currently assumed by the local code

- `categories`: `id`, `slug`, `name`, `published`, `sort_order`.
- `products`: `id`, `category_id`, `slug`, `title`, `description`, `price`, `medium`, `dimensions`, `image_url`, `available`, `featured`, `published`, `archived`, `created_at`.
- `product_images`: `id`, `product_id`, `url`, `alt_text`, `sort_order`.
- `user_roles`: `user_id`, `role` (`owner` or `admin` for dashboard access).
- `custom_pricing_rules`: `id`, `kind`, `option_key`, `label`, `amount`, `active`, `sort_order`.
- `custom_orders`: `id`, `user_id`, customer details, artwork specifications, `estimated_price`, `pricing_snapshot`, `production_status`, `payment_status`, `internal_notes`, `created_at`.
- `custom_order_images`: `custom_order_id`, `storage_path`, `content_type`, `byte_size`, `kind`.
- `custom_order_status_history`: `custom_order_id`, `from_status`, `to_status`.
- `orders`: `id`, `user_id`, `status`, `total`, `created_at`.
- `payments`: `amount`, `status` (`captured` is counted as verified revenue).
- `site_settings`: `key`, `value`.
- Private Storage bucket: `custom-references`.

These are **interface assumptions, not a statement of the existing schema**. The app must be adapted to the actual schema before use.

## Safe migration plan after an active existing project or backup is provided

1. Read all public tables, columns, primary keys, foreign keys, indexes, RLS policies, storage buckets, Auth providers, and existing migration history. Record row counts before changes.
2. Map compatible existing tables to the contract above. Preserve existing names and records where possible; adjust the application to the existing schema instead of duplicating tables.
3. Create only missing tables and columns with additive migrations. Use foreign keys, constraints, timestamps, indexes, and RLS on every exposed table. Never drop or truncate existing data.
4. Keep public SELECT policies limited to published products, categories, and content. Restrict private records to their owning `auth.uid()`. Grant administrators through a database role table whose rows customers cannot edit. Keep internal notes and payment internals out of customer-visible queries.
5. Add private reference-image Storage policies based on owner path and admin role. Signed URLs must be short lived.
6. Implement atomic inventory reservation and payment-webhook idempotency in database transactions. Do not enable checkout until these are tested against the real schema.
7. Seed pricing options only if none already exist. Preserve each request’s pricing snapshot. Verify RLS with anonymous, customer, and admin identities, then run Supabase security and performance advisors.

## Remaining work

Add the remaining tables and policies, private reference storage, an initial owner role, and real artwork records. Verify customer and admin authorization before enabling order and payment flows.
