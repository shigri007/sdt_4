import React, { useState } from 'react';
import { ArrowRight, Boxes, Fingerprint, GitBranch, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const { error } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      setIsLoading(true);
      await login(username.trim(), password);
    } catch (cause: any) {
      error('Sign in failed', cause.message || 'Check your username and password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="login-layout min-h-screen grid lg:grid-cols-[minmax(0,1.12fr)_minmax(400px,.88fr)] bg-white">
      <section className="login-hero relative flex flex-col justify-between overflow-hidden p-8 sm:p-12 lg:p-16 text-white min-h-[340px] lg:min-h-screen">
        <div className="login-grid absolute inset-0" aria-hidden="true" />
        <div className="relative z-10 flex items-center gap-3">
          <span className="brand-mark flex items-center justify-center"><Boxes className="w-5 h-5" strokeWidth={2.2} /></span>
          <span className="text-xl font-semibold tracking-tight">SteriTrack</span>
        </div>
        <div className="relative z-10 max-w-xl my-12 lg:my-0 animate-enter">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-medium text-teal-100 mb-8">
            <span className="h-1.5 w-1.5 rounded-full bg-teal-300" />
            Kit reprocessing and traceability
          </div>
          <h1 className="text-4xl sm:text-5xl xl:text-6xl font-semibold tracking-tight leading-[1.08]">Every kit.<br/><span className="text-teal-300">Every step.</span><br/>Accounted for.</h1>
          <p className="mt-6 max-w-md text-sm sm:text-base leading-7 text-slate-300">Follow each instrument kit from receipt through processing, quality review and dispatch in one connected workspace.</p>
          <div className="mt-10 grid sm:grid-cols-3 gap-3 max-w-xl">
            {[
              { icon: GitBranch, title: 'Traceable history', text: 'Review every processing attempt' },
              { icon: ShieldCheck, title: 'Independent review', text: 'Separate operator and QC actions' },
              { icon: Boxes, title: 'Stock visibility', text: 'See eligible kits and requests' },
            ].map(({ icon: Icon, title, text }) => <div key={title} className="login-feature rounded-2xl border border-white/10 bg-white/[.055] p-4 backdrop-blur-sm"><Icon className="h-5 w-5 text-teal-300 mb-4"/><div className="text-sm font-semibold">{title}</div><div className="text-xs leading-5 text-slate-300 mt-1">{text}</div></div>)}
          </div>
        </div>
        <div className="relative z-10 text-xs text-slate-400">SteriTrack · Operational workspace</div>
      </section>

      <section className="flex min-h-[550px] items-center justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="w-full max-w-md animate-enter">
          <div className="mb-9 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><Fingerprint className="h-6 w-6"/></div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-teal-700">Secure access</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Welcome back</h2>
          <p className="mt-3 text-sm text-slate-500 leading-6">Sign in with your assigned account to continue your work.</p>

          <form className="mt-9 space-y-5" onSubmit={handleLogin}>
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-slate-800 mb-2">Username or email</label>
              <div className="relative"><UserRound className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/><input id="username" autoComplete="username" required value={username} onChange={event => setUsername(event.target.value)} className="login-input w-full rounded-xl border border-slate-200 py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none" /></div>
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-800 mb-2">Password</label>
              <div className="relative"><LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400"/><input id="password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} className="login-input w-full rounded-xl border border-slate-200 py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none" /></div>
            </div>
            <button type="submit" disabled={isLoading} className="login-submit mt-3 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60">
              {isLoading ? 'Signing in…' : 'Sign in'}<ArrowRight className="h-4 w-4"/>
            </button>
          </form>
          <div className="mt-8 flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 text-xs leading-5 text-slate-500"><ShieldCheck className="h-4 w-4 flex-none text-teal-700"/><span>Access follows your assigned role. Actions are recorded in the audit history.</span></div>
        </div>
      </section>
    </main>
  );
};
