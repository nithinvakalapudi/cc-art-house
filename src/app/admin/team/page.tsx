import { requireStoreOwnerDb } from '@/lib/supabase-server';
import { setAdminAccess } from './actions';
import AdminSubmitButton from '@/components/admin-submit-button';
import RemoveAdminAccessButton from '@/components/remove-admin-access-button';

export default async function AdminTeam() {
  const db=await requireStoreOwnerDb();
  const [{data:invites,error},{data:{user}}]=await Promise.all([
    db.from('admin_invites').select('email,access_level,created_at').order('created_at',{ascending:false}),
    db.auth.getUser(),
  ]);
  const currentEmail=user?.email?.toLowerCase()||'';
  return <>
    <h1>Admin team access</h1>
    <p className="muted">Only an owner can invite teammates, grant read, write or owner access, change permissions, or remove access. You cannot remove your own owner access.</p>
    <div className="panel"><h2>Invite or update access</h2><form action={setAdminAccess} className="form-grid"><label className="field">Email address<input type="email" name="email" required placeholder="teammate@example.com" /></label><label className="field">Permission<select name="access" defaultValue="read"><option value="read">Read access · view only</option><option value="write">Write access · manage the store</option><option value="owner">Owner access · manage team access</option></select></label><AdminSubmitButton>Save team access</AdminSubmitButton></form></div>
    <div className="panel"><h2>Team members and invitations</h2>{error?<p className="error">Unable to load team permissions. Apply the Admin Team access migration.</p>:invites?.length?<div className="table-scroll"><table className="table admin-team-table"><thead><tr><th>Email</th><th>Access</th><th>Added</th><th>Change access</th><th>Remove access</th></tr></thead><tbody>{invites.map(invite=>{const isOwner=invite.access_level==='owner';const isSelf=invite.email.toLowerCase()===currentEmail;return <tr key={invite.email}><td data-label="Email">{invite.email}{isSelf&&<small className="admin-team-self"> · You</small>}</td><td data-label="Access"><span className={`admin-permission-badge ${invite.access_level==='write'?'write':''} ${isOwner?'owner':''}`}>{isOwner?'Owner access':invite.access_level==='write'?'Write access':'Read access'}</span></td><td data-label="Added">{new Date(invite.created_at).toLocaleDateString('en-IN')}</td><td data-label="Change access">{isOwner?<span className="muted">Owner access</span>:<form action={setAdminAccess} className="admin-team-inline"><input type="hidden" name="email" value={invite.email}/><select name="access" aria-label={`Access for ${invite.email}`} defaultValue={invite.access_level}><option value="read">Read</option><option value="write">Write</option><option value="owner">Owner</option></select><button className="button outline">Update</button></form>}</td><td data-label="Remove access">{isSelf?<span className="muted">You · protected</span>:<RemoveAdminAccessButton email={invite.email} isOwner={isOwner}/>}</td></tr>})}</tbody></table></div>:<p>No team members invited yet.</p>}<p className="admin-team-security-note">Removing access revokes that person’s admin portal role but keeps their customer account. You cannot remove your own owner access.</p></div>
    <div className="panel"><h2>What the permissions mean</h2><ul className="admin-permission-help"><li><b>Read access:</b> can review the dashboard, products, orders, delivery and customer requests. All editing and save actions are blocked.</li><li><b>Write access:</b> can create and update paintings, discounts, orders, delivery rates, custom pricing and website content.</li><li><b>Owner access:</b> includes all store permissions and team management. Only an owner can grant or remove owner access. An owner cannot remove their own access.</li></ul></div>
  </>;
}
