import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePhevnix } from '../context/PhevnixProvider.tsx';
import { Button, Field, Banner } from '../components/ui.tsx';
import { BoltIcon } from '../components/icons.tsx';
import { useT } from '../lib/i18n.tsx';

export function AuthScreen({ mode }: { mode: 'login' | 'register' }) {
  const { login, register, keyConfigured, client } = usePhevnix();
  const navigate = useNavigate();
  const { t } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // POST /emsp/v1/auth/driver/forgot-password — always succeeds (no account enumeration).
  async function forgot() {
    setError(null); setNotice(null);
    if (!email) { setError(t('Enter your email first.')); return; }
    try {
      await client.forgotPassword(email);
      setNotice(t('If that email has an account, a reset link is on its way.'));
    } catch {
      setNotice(t('If that email has an account, a reset link is on its way.'));
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'register') await register({ email, password, firstName, lastName });
      else await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="phone-shell">
      <div className="phone-frame flex flex-col justify-between p-6">
        {/* Brand */}
        <div className="pt-14">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-volt text-ink shadow-[0_10px_30px_-8px_rgba(46,230,166,0.6)]">
              <BoltIcon className="h-7 w-7" />
            </div>
            <div>
              <p className="text-[22px] font-extrabold tracking-tight">Voltway</p>
              <p className="-mt-0.5 text-[12px] text-text-soft">Charge anywhere. Pay your way.</p>
            </div>
          </div>
          <h2 className="mt-12 text-[28px] font-bold leading-tight">
            {mode === 'register' ? t('Create your account') : t('Welcome back')}
          </h2>
          <p className="mt-1.5 text-[14px] text-text-soft">
            {mode === 'register' ? t('Start charging in under a minute.') : t('Sign in to find and start charging.')}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={submit} className="space-y-3.5 py-8">
          {!keyConfigured && (
            <Banner tone="warn">
              No publishable key set. Add <code>VITE_EMSP_API_KEY</code> to <code>.env</code> and restart.
            </Banner>
          )}
          {mode === 'register' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" />
              <Field label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" />
            </div>
          )}
          <Field label={t('Email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@example.com" />
          <Field label={t('Password')} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete={mode === 'register' ? 'new-password' : 'current-password'} placeholder="••••••••" />
          {mode === 'login' && (
            <div className="text-right">
              <button type="button" onClick={forgot} className="text-[12px] font-medium text-volt">{t('Forgot password?')}</button>
            </div>
          )}
          {notice && <Banner tone="volt">{notice}</Banner>}
          {error && <Banner tone="warn">{error}</Banner>}
          <div className="pt-1">
            <Button type="submit" loading={busy}>{mode === 'register' ? t('Create account') : t('Sign in')}</Button>
          </div>
        </form>

        {/* Footer */}
        <div className="space-y-4 pb-6 text-center">
          <p className="text-[13px] text-text-soft">
            {mode === 'register' ? (
              <>{t('Already have an account?')} <Link to="/login" className="font-semibold text-volt">{t('Sign in')}</Link></>
            ) : (
              <>{t('New to Voltway?')} <Link to="/register" className="font-semibold text-volt">{t('Create one')}</Link></>
            )}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-text-faint">Powered by the Phevnix eMSP API</p>
        </div>
      </div>
    </div>
  );
}
