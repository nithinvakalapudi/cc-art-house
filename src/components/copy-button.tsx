'use client';
import { useState } from 'react';
export default function CopyButton({ value, text, label = 'Copy' }: { value?: string; text?: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() { try { await navigator.clipboard.writeText(value ?? text ?? ''); setCopied(true); window.setTimeout(() => setCopied(false), 2200); } catch { setCopied(false); } }
  return <button type="button" className="copy-button" onClick={copy} aria-label={`${label} to clipboard`}>{copied ? 'Copied ✓' : label}</button>;
}
