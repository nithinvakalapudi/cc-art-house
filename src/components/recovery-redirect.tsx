'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const db = url && key ? createBrowserClient(url, key) : null;

export default function RecoveryRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (!db) return;
    const recoveryLink = window.location.hash.includes('type=recovery') || new URLSearchParams(window.location.search).get('type') === 'recovery';
    const { data: { subscription } } = db.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (recoveryLink && session)) router.replace('/account/reset-password');
    });
    if (recoveryLink) db.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/account/reset-password');
    });
    return () => subscription.unsubscribe();
  }, [router]);
  return null;
}
