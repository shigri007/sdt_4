import React, { useState } from 'react';
import { Bell, Boxes, ChevronRight, KeyRound, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { SystemAlert } from '../types/index.js';
import { useToast } from '../context/ToastContext.js';
import { api } from '../services/api.js';
import { Modal } from './Modal.js';

interface NavbarProps {
  alerts: SystemAlert[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const names: Record<string,string> = {
  dashboard:'Overview',kits:'Kit registry',requests:'Requests',processing:'Processing',batches:'Batches',
  qc:'Quality control',quarantine:'Quarantine',inventory:'Inventory',dispatch:'Dispatch',
  receipts:'Receipts',traceability:'Traceability',audit:'Audit trail',reports:'Reports',admin:'Admin panel'
};

export const Navbar: React.FC<NavbarProps> = ({ alerts, activeTab, setActiveTab }) => {
  const {user, logout} = useAuth();
  const {error,success} = useToast();
  const [open, setOpen] = useState(false);
  const [accountOpen,setAccountOpen] = useState(false);
  const [passwords,setPasswords] = useState({current:'',next:''});
  const changePassword = async (event:React.FormEvent) => {event.preventDefault();try {await api.changePassword(passwords.current,passwords.next);setPasswords({current:'',next:''});setAccountOpen(false);success('Password changed','Sign in with your new password.');logout();} catch(cause:any){error('Could not change password',cause.message);} };
  return <><header className="app-topbar sticky top-0 z-30 flex items-center justify-between gap-4 px-5 sm:px-8 py-3.5 bg-white border-b border-slate-200/80">
    <div className="flex min-w-0 items-center gap-4">
      <button onClick={() => setActiveTab('dashboard')} className="flex items-center gap-2.5 shrink-0" aria-label="Go to overview">
        <span className="brand-mark flex items-center justify-center"><Boxes className="h-4 w-4" strokeWidth={2.2}/></span>
        <span className="font-bold tracking-tight text-slate-900 hidden sm:inline">SteriTrack</span>
      </button>
      <span className="h-5 w-px bg-slate-200 hidden sm:block"/>
      <div className="flex min-w-0 items-center gap-2 text-xs sm:text-sm"><span className="text-slate-400 hidden md:block">Workspace</span><ChevronRight className="h-3.5 w-3.5 text-slate-300 hidden md:block"/><span className="font-semibold text-slate-800 truncate">{names[activeTab] || 'Workspace'}</span></div>
    </div>
    <div className="flex items-center gap-2 sm:gap-4">
      <div className="relative">
        <button type="button" onClick={() => setOpen(!open)} className="relative h-9 w-9 flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 transition-colors" aria-label={`Alerts: ${alerts.length}`} aria-expanded={open}><Bell className="h-[18px] w-[18px]"/>{alerts.length>0&&<span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white"/>}</button>
        {open&&<div className="absolute right-0 top-11 w-[min(360px,85vw)] rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl shadow-slate-900/10"><div className="px-3 py-2 text-sm font-semibold text-slate-900">Alerts <span className="text-slate-400">{alerts.length}</span></div><div className="max-h-72 overflow-y-auto">{alerts.length?alerts.map(alert=><div key={alert.id} className="rounded-xl px-3 py-2.5 hover:bg-slate-50"><div className="text-xs font-semibold text-slate-900">{alert.title}</div><div className="mt-1 text-xs leading-5 text-slate-500">{alert.message}</div></div>):<div className="px-3 py-5 text-xs text-slate-500">No active alerts.</div>}</div></div>}
      </div>
      <div className="h-6 w-px bg-slate-200"/>
      <div className="hidden sm:block text-right min-w-0"><div className="text-xs font-semibold text-slate-900 max-w-36 truncate">{user?.fullName}</div><div className="text-[11px] text-slate-500 capitalize">{user?.role?.replace(/_/g,' ').toLowerCase()}</div></div>
      <button type="button" onClick={()=>setAccountOpen(true)} className="h-9 w-9 rounded-xl bg-teal-50 text-teal-800 flex items-center justify-center text-xs font-bold" aria-label="Account settings" title="Account settings">{user?.fullName?.split(' ').slice(0,2).map(word=>word[0]).join('').toUpperCase()||'ST'}</button>
      <button type="button" onClick={logout} className="h-9 w-9 flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors" aria-label="Sign out" title="Sign out"><LogOut className="h-[18px] w-[18px]"/></button>
    </div>
  </header><Modal isOpen={accountOpen} onClose={()=>setAccountOpen(false)} title="Account security" subtitle="Change your password" maxWidth="md"><form onSubmit={changePassword} className="space-y-4"><div className="flex items-center gap-2 text-xs text-slate-600"><KeyRound className="h-4 w-4 text-teal-700"/>Your other sessions will be signed out.</div><label className="block text-xs font-semibold text-slate-700">Current password<input type="password" autoComplete="current-password" required value={passwords.current} onChange={event=>setPasswords(previous=>({...previous,current:event.target.value}))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"/></label><label className="block text-xs font-semibold text-slate-700">New password<input type="password" autoComplete="new-password" required minLength={12} value={passwords.next} onChange={event=>setPasswords(previous=>({...previous,next:event.target.value}))} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"/></label><div className="flex justify-end"><button className="rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-semibold text-white">Update password</button></div></form></Modal></>;
};
