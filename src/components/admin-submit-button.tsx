'use client';

import { useFormStatus } from 'react-dom';

export default function AdminSubmitButton({ children, className = 'button primary', style, disabled = false }: { children: React.ReactNode; className?: string; style?: React.CSSProperties; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return <button className={className} style={style} type="submit" disabled={pending||disabled} aria-busy={pending}>
    {pending ? <><span className="loading-spinner" aria-hidden="true" /> Saving…</> : children}
  </button>;
}
