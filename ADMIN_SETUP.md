# Supabase admin and OTP status

Project: `wibumvwhpnqmycjxwyuj` (Art Store).

## Completed on 11 October 2026

- Applied `supabase/migrations/20261010_admin_invites.sql` as the `admin_invites` migration, followed by `20261011_admin_invite_trigger_permissions.sql` to restrict direct trigger-function access.
- Verified that `chowdarynithin95@gmail.com` already exists in Supabase Authentication, has a confirmed email address, and has a password set. The existing password was neither read nor changed.
- Assigned this account the `owner` role in `public.user_roles` and verified the result.
- Email authentication and email confirmation are enabled. New customer signups are enabled.

The owner can use `/account/admin` with the account's existing password. If that password is unknown, reset it through Supabase Authentication rather than creating a duplicate account. Additional admin addresses can be invited through `/admin/team` after the owner signs in.

## Still required for numeric email OTP

Password recovery has its own **Reset password** template. On 16 October 2026, custom SMTP was enabled, the Reset password template was updated to use `{{ .Token }}`, and `NEXT_PUBLIC_RECOVERY_OTP_ENABLED=true` was set in `.env.local`. The site accepted a test recovery request and displayed the code-entry step. A message with the configured subject was found in the recipient's Gmail mailbox. The code field accepts variable-length numeric tokens because this project sent an eight-digit code. The stored template is `supabase/recovery-otp-template.html`.

The project's free Supabase email service does not allow template editing. Configure custom SMTP in **Authentication → Emails → SMTP Settings** (or upgrade to a plan that allows template editing), then set the **Magic link or OTP** template to `supabase/email-otp-template.html` and a subject such as **Your Art House sign-in code**. Its body must use `{{ .Token }}`, not `{{ .ConfirmationURL }}`. Also update **Confirm sign up** to include `{{ .Token }}` for new customers. Verify delivery to an address that is not a Supabase team member.

Until this is done, the email sent by Supabase may contain a sign-in link rather than the numeric code expected by the current account form.

## Still required for mobile OTP

The Phone provider is disabled. In **Authentication → Sign In / Providers → Phone**, select an SMS provider and enter its account credentials, then enable and save the provider. Twilio is the dashboard's current default choice, but another supported SMS provider may be used. Verify delivery to a real phone number before advertising mobile sign-in.

Do not put SMTP or SMS credentials in client-side environment variables or the repository.

