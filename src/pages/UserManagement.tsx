// ==========================================================
// SteriTrack: Staff User Management (Admin Only)
// ==========================================================

import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { User, Department } from '../types/index.js';
import { useToast } from '../context/ToastContext.js';
import { Users, CheckCircle2, XCircle, UserPlus, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';

export const UserManagement: React.FC = () => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [departments,setDepartments] = useState<Department[]>([]);
  const [creating,setCreating] = useState(false);
  const [saving,setSaving] = useState(false);
  const [form,setForm] = useState({username:'',email:'',fullName:'',role:'DEPARTMENT_STAFF',departmentId:1,password:''});

  useEffect(() => {
    loadUsers();
    api.getDepartments().then(res => {setDepartments(res.data);if(res.data[0])setForm(previous=>({...previous,departmentId:res.data[0].id}));}).catch(()=>{});
  }, []);

  const createUser = async (event:React.FormEvent) => {
    event.preventDefault();setSaving(true);
    try {await api.createUser(form);success('Account created',`${form.username} can now sign in.`);setCreating(false);setForm(previous=>({...previous,username:'',email:'',fullName:'',password:''}));loadUsers();}
    catch(cause:any){error('Could not create account',cause.message);}finally{setSaving(false);}
  };

  async function loadUsers() {
    try {
      setIsLoading(true);
      const res = await api.getUsers();
      if (res.success) {
        setUsers(res.data);
      }
    } catch (err: any) {
      error('Failed to load users', err.message);
    } finally {
      setIsLoading(false);
    }
  }

  const handleToggleActive = async (user: User) => {
    try {
      const res = await api.toggleUserActive(user.id);
      if (res.success) {
        success(
          'User Status Updated',
          `User ${user.username} is now ${res.user.isActive ? 'Active' : 'Deactivated'}.`
        );
        loadUsers();
      }
    } catch (err: any) {
      error('Update Failed', err.message);
    }
  };

  if (user?.role !== 'ADMINISTRATOR') return null;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-teal-950 p-6 sm:p-8 text-white shadow-lg">
        <div className="flex items-center gap-2 text-teal-200 text-xs font-bold uppercase tracking-[.18em]"><ShieldCheck className="h-4 w-4"/>Administrator access</div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Admin Panel</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Create staff accounts, assign roles and departments, and control account access. Account creation is available only to administrators.</p>
      </div>
      <div className="flex gap-2 border-b border-slate-200 pb-3" aria-label="Administration sections">
        <button type="button" onClick={()=>setCreating(false)} aria-current={!creating?'page':undefined} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${!creating?'bg-teal-700 text-white':'bg-white text-slate-600 hover:bg-slate-50'}`}><Users className="h-4 w-4"/>Staff accounts</button>
        <button type="button" onClick={()=>setCreating(true)} aria-current={creating?'page':undefined} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${creating?'bg-teal-700 text-white':'bg-white text-slate-600 hover:bg-slate-50'}`}><UserPlus className="h-4 w-4"/>Create account</button>
      </div>
      {creating ? <section className="max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        <div className="mb-6"><h2 className="text-lg font-semibold text-slate-900">Create staff account</h2><p className="mt-1 text-sm text-slate-500">Assign a role and department. Share the temporary password privately and ask the new user to change it after sign-in.</p></div>
        <form onSubmit={createUser} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">{([['fullName','Full name'],['username','Username'],['email','Email'],['password','Temporary password']] as const).map(([key,label])=><label key={key} className="block text-sm font-semibold text-slate-700">{label}<input required minLength={key==='password'?12:undefined} type={key==='password'?'password':key==='email'?'email':'text'} autoComplete="off" value={form[key]} onChange={e=>setForm(previous=>({...previous,[key]:e.target.value}))} className="mt-2 w-full rounded-xl border border-slate-300 px-3.5 py-3 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"/></label>)}</div>
          <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Role<select value={form.role} onChange={e=>setForm(previous=>({...previous,role:e.target.value}))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm"><option value="DEPARTMENT_STAFF">Department staff</option><option value="REPROCESSING_OPERATOR">Operator</option><option value="QUALITY_COORDINATOR">Quality coordinator</option><option value="ADMINISTRATOR">Administrator</option></select></label><label className="text-sm font-semibold text-slate-700">Department<select value={form.departmentId} onChange={e=>setForm(previous=>({...previous,departmentId:Number(e.target.value)}))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3.5 py-3 text-sm">{departments.map(dept=><option key={dept.id} value={dept.id}>{dept.name}</option>)}</select></label></div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={()=>setCreating(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button disabled={saving} className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">{saving?'Creating…':'Create account'}</button></div>
        </form>
      </section> : <>
      <div className="flex items-center justify-between"><h2 className="text-lg font-semibold text-slate-900">Staff accounts</h2><span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">{users.length} accounts</span></div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4">Staff Member</th>
                <th className="py-3 px-4">Role Permission</th>
                <th className="py-3 px-4">Department Assignment</th>
                <th className="py-3 px-4">Badge Number</th>
                <th className="py-3 px-4">Last Active</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading hospital staff accounts...
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{u.fullName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">@{u.username} · {u.email}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                        {u.role.replace(/_/g, ' ')}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-700">
                      {u.departmentName || 'Hospital-wide Scope'}
                    </td>

                    <td className="py-3 px-4 font-mono font-semibold text-slate-600">
                      {u.badgeNumber || '—'}
                    </td>

                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {u.lastLoginAt ? u.lastLoginAt.substring(0, 16) : 'Never'}
                    </td>

                    <td className="py-3 px-4">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded">
                          <XCircle className="w-3 h-3 text-rose-600" /> Deactivated
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`px-2.5 py-1 text-[11px] font-semibold rounded border transition-colors ${
                          u.isActive
                            ? 'text-rose-700 border-rose-300 hover:bg-rose-50'
                            : 'text-emerald-700 border-emerald-300 hover:bg-emerald-50'
                        }`}
                      >
                        {u.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      </>}
    </div>
  );
};
