# Store payment and delivery setup

The store uses Razorpay Checkout. Add test credentials first and verify a test payment before using live keys. Never add a Razorpay secret or the Supabase service role key to a `NEXT_PUBLIC_` variable or commit them in `.env.local`.

## Environment variables

- `NEXT_PUBLIC_RAZORPAY_KEY_ID`: Razorpay Dashboard → Account & Settings → API Keys. Start with a test key.
- `RAZORPAY_KEY_SECRET`: the matching private key secret from Razorpay.
- `RAZORPAY_WEBHOOK_SECRET`: create a Razorpay webhook for `https://YOUR_DOMAIN/api/payments/razorpay/webhook`, subscribe to `payment.captured`, and save the displayed webhook secret.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Project Settings → API Keys. The payment verification route uses it server side only.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`: outbound email settings. For Gmail use an app password, not your Google account password.
- `ART_HOUSE_ADMIN_EMAIL`: studio recipient for order notices.

Set these in local `.env.local` to use the local site. Add them as encrypted server environment variables in Netlify when you choose to publish. Restart the local Next server after changing local variables.

## Delivery pricing

Open `/admin/delivery` as an admin to manage delivery areas and estimates. Bengaluru delivery costs ₹45 and is active for PIN codes beginning with `560`. Orders with an artwork subtotal of ₹2,000 or more receive free delivery to supported PIN codes. Collection near Kundalahalli Gate is free.

## Payments

Checkout saves the order first. Razorpay opens using the saved order total. The server checks the signed-in order owner and delivery price, creates the Razorpay order, validates Razorpay’s HMAC payment signature, and only then marks the store order paid. A signed `payment.captured` webhook also confirms it if the browser closes. Online payment is blocked for shipping PIN codes without an active delivery price.

## Email notifications

When SMTP is configured, the verified customer email receives the receipt and later fulfillment updates. The studio email receives order and status updates with delivery details. Phone-only accounts still notify the studio, and customers can check progress in `/account/orders`. Notification events are idempotent and failed sends can be retried.
