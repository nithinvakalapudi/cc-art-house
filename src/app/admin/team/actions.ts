'use server';

import { revalidatePath } from 'next/cache';
import { isStoreOwner, serverDb } from '@/lib/supabase-server';

export async function setAdminAccess(form: FormData) {
  if (!await isStoreOwner()) throw new Error('Only the owner can change admin access');
  const email = String(form.get('email') || '').trim().toLowerCase();
  const access = String(form.get('access') || 'write');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address');
  if (!['read','write','owner'].includes(access)) throw new Error('Choose read, write or owner access');
  const db = await serverDb();
  if (!db) throw new Error('Database unavailable');
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error('Sign in again to manage team access');
  const { error } = await db.from('admin_invites').upsert({ email, access_level: access, invited_by: user.id }, { onConflict: 'email' });
  if (error) throw new Error(error.message);
  revalidatePath('/admin/team');
}

export async function removeAdminAccess(form: FormData) {
  if (!await isStoreOwner()) throw new Error('Only the owner can remove admin access');
  const email = String(form.get('email') || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address');

  const db = await serverDb();
  if (!db) throw new Error('Database unavailable');
  const { data, error } = await db.from('admin_invites').delete().eq('email', email).select('email');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('No team access was found for that email');

  revalidatePath('/admin/team');
  revalidatePath('/admin');
}

export async function inviteAdmin(form: FormData) { return setAdminAccess(form); }
