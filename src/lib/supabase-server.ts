import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
export async function serverDb(){const store=await cookies();const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;if(!url||!key)return null;return createServerClient(url,key,{cookies:{getAll(){return store.getAll()},setAll(items){try{items.forEach(({name,value,options})=>store.set(name,value,options))}catch{}}}})}
export async function currentUser(){const db=await serverDb();if(!db)return null;const {data}=await db.auth.getUser();return data.user||null}
export async function adminAccess(){const db=await serverDb();if(!db)return null;const{data:{user}}=await db.auth.getUser();if(!user)return null;const{data}=await db.from('user_roles').select('role').eq('user_id',user.id).maybeSingle();return data?.role==='owner'||data?.role==='admin'||data?.role==='viewer'?data.role:null}
export async function isAdmin(){const role=await adminAccess();return role==='owner'||role==='admin'}
export async function hasAdminPortalAccess(){return !!await adminAccess()}
export async function isStoreOwner(){return (await adminAccess())==='owner'}
export async function requireAdminDb(){if(!await hasAdminPortalAccess())redirect('/account/admin');const db=await serverDb();if(!db)redirect('/account/admin');return db}
export async function requireStoreOwnerDb(){if(!await isStoreOwner())redirect('/admin');const db=await serverDb();if(!db)redirect('/admin');return db}

