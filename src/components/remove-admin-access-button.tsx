'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { removeAdminAccess } from '@/app/admin/team/actions';

function RemoveButton() {
  const { pending } = useFormStatus();
  return (
    <button className="admin-remove-confirm" type="submit" disabled={pending} aria-busy={pending}>
      {pending ? 'Removing…' : 'Remove access'}
    </button>
  );
}

export default function RemoveAdminAccessButton({ email }: { email: string }) {
  const [confirming, setConfirming] = useState(false);

  return (
    <form action={removeAdminAccess} className="admin-remove-form">
      <input type="hidden" name="email" value={email} />
      <button className="admin-remove-trigger" type="button" onClick={() => setConfirming(true)}>
        Remove access
      </button>
      {confirming && (
        <div className="confirm-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setConfirming(false); }}>
          <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="remove-admin-title">
            <h2 id="remove-admin-title">Remove team access?</h2>
            <p><strong>{email}</strong> will lose admin portal access. Their customer account will remain active.</p>
            <div className="confirm-actions">
              <button type="button" onClick={() => setConfirming(false)}>Keep access</button>
              <RemoveButton />
            </div>
          </section>
        </div>
      )}
    </form>
  );
}
