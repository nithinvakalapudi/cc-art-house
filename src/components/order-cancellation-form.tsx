'use client';

import { useActionState, useState } from 'react';
import { cancelOrder, type CancelOrderState } from '@/app/account/orders/actions';

const initialState: CancelOrderState = { error: '', success: false };

export default function OrderCancellationForm({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(cancelOrder, initialState);

  if (state.success) return <p className="notice" role="status">Your order was cancelled. The studio has been notified.</p>;

  return <div className="order-cancel-action">
    {state.error && <p className="form-feedback error" role="alert">{state.error}</p>}
    {!open ? <button className="order-cancel-open" type="button" onClick={() => setOpen(true)}>Cancel this order</button> : (
      <form action={formAction} className="order-cancel-form">
        <input type="hidden" name="order_id" value={orderId} />
        <p><strong>Cancel this order?</strong> This is available while the order is awaiting studio confirmation and payment is unpaid.</p>
        <label className="field">Reason <span className="muted">(optional)</span>
          <textarea name="reason" maxLength={500} rows={3} placeholder="Share a reason with the studio, if you’d like." />
        </label>
        <div className="order-cancel-buttons">
          <button className="order-cancel-keep" type="button" onClick={() => setOpen(false)} disabled={pending}>Keep my order</button>
          <button className="order-cancel-confirm" type="submit" disabled={pending}>{pending ? 'Cancelling…' : 'Confirm cancellation'}</button>
        </div>
      </form>
    )}
  </div>;
}
