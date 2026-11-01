-- Drop the legacy customer-readable column after the app is deployed to use the
-- admin-only custom_order_admin_notes table. Notes were copied in the prior migration.
alter table public.custom_orders drop column if exists internal_notes;
