import { requireStoreOwnerDb } from '@/lib/supabase-server';
import { setAdminAccess } from './actions';
import AdminSubmitButton from '@/components/admin-submit-button';
import RemoveAdminAccessButton from '@/components/remove-admin-access-button';

export default async function AdminTeam() {
  const db=await requireStoreOwnerDb();
  const {data:invites,error}=await db.from('admin_invites').select('email,access_level,created_at').order('created_at',{ascending:false});
  return <>
    <h1>Admin team access</h1>
    <p className="muted">Choose what each teammate can do. Read access can view store records. Write access can manage the store. Only the owner can change permissions or remove a teammate’s admin access.</p>
    <div className="panel"><h2>Invite or update access</h2><form action={setAdminAccess} className="form-grid"><label className="field">Email address<input type="email" name="email" required placeholder="teammate@example.com" /></label><label className="field">Permission<select name="access" defaultValue="read"><option value="read">Read access · view only</option><option value="write">Write access · manage the store</option></select></label><AdminSubmitButton>Save team access</AdminSubmitButton></form></div>
    <div className="panel"><h2>Team members and invitations</h2>{error?<p className="error">Unable to load team permissions. Apply the Admin Team access migration.</p>:invites?.length?<div className="table-scroll"><table className="table admin-team-table"><thead><tr><th>Email</th><th>Access</th><th>Added</th><th>Change access</th><th>Remove access</th></tr></thead><tbody>{invites.map(invite=><tr key={invite.email}><td>{invite.email}</td><td><span className={`admin-permission-badge ${invite.access_level==='write'?'write':''}`}>{invite.access_level==='write'?'Write access':'Read access'}</span></td><td>{new Date(invite.created_at).toLocaleDateString('en-IN')}</td><td><form action={setAdminAccess} className="admin-team-inline"><input type="hidden" name="email" value={invite.email}/><select name="access" aria-label={`Access for ${invite.email}`} defaultValue={invite.access_level}><option value="read">Read</option><option value="write">Write</option></select><button className="button outline">Update</button></form></td><td><RemoveAdminAccessButton email={invite.email} /></td></tr>)}</tbody></table></div>:<p>No team members invited yet.</p>}<p className="admin-team-security-note">Removing access ends their admin or read-only portal access. Their Supabase customer account is not deleted.</p></div>
    <div className="panel"><h2>What the permissions mean</h2><ul className="admin-permission-help"><li><b>Read access:</b> can review the dashboard, products, orders, delivery and customer requests. All editing and save actions are blocked.</li><li><b>Write access:</b> can create and update paintings, discounts, orders, delivery rates, custom pricing and website content.</li><li><b>Owner:</b> retains full access, including changing permissions and inviting teammates.</li></ul></div>
  </>;
}
