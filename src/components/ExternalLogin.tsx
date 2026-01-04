import React, { useState } from 'react';
import { GoogleOAuthProvider, GoogleLogin } from '@react-oauth/google';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useExternalAuth } from '../context/ExternalAuthContext';
import { apiPost } from '../services/api';

const ExternalLogin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { login: setExternalSession } = useExternalAuth();

  React.useEffect(() => {
    const pre = search.get('email');
    if (pre && !email) setEmail(pre);
  }, [search]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const j = await apiPost('/api/external-users/login', { email, password }).catch((err) => {
        throw new Error(String(err?.message || 'Login failed'));
      });
      if (j?.mfaRequired) {
        navigate(`/mfa?email=${encodeURIComponent(email)}`);
        return;
      }
      // Persist external user session
      setExternalSession({ email: j?.email || email, name: j?.name || null });
      navigate('/');
    } catch (err: any) {
      const msg = String(err?.message || 'Login failed');
      setError(msg.replace(/_/g, ' '));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="wrap centered">
      <div className="grid" style={{ maxWidth: 980, margin: '0 auto' }}>
        <main>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{
              background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-500, #0a6b55) 100%)',
              color: '#fff',
              padding: '20px 22px'
            }}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>External User Sign-in</div>
              <div className="small" style={{ opacity: .9 }}>Secure access with email and password</div>
            </div>

            <div style={{ padding: 18 }}>
              <form onSubmit={submit} style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label className="small" htmlFor="email">Email address</label>
                  <input id="email" type="email" className="form-control" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div>
                  <label className="small" htmlFor="password">Password</label>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input id="password" type={showPassword ? 'text' : 'password'} className="form-control" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
                    <button type="button" className="btn ghost sm" onClick={() => setShowPassword(s => !s)} aria-pressed={showPassword}>{showPassword ? 'Hide' : 'Show'}</button>
                  </div>
                </div>

                {error && (
                  <div className="small" role="alert" style={{ color: '#b91c1c', background: '#fef2f2', border: '1px solid #fee2e2', padding: 10, borderRadius: 8 }}>
                    {error}
                  </div>
                )}

                <button className="btn" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
              </form>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                <Link to="/reset-password" className="small">Forgot password?</Link>
                <Link to="/onboard" className="small">Set your password</Link>
              </div>

              <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #f2f2f2' }} />

              <div style={{ display: 'grid', gap: 12 }}>
                <div className="small muted">Or continue with Google</div>
                <div>
                  <GoogleOAuthProvider clientId={String(process.env.REACT_APP_GOOGLE_CLIENT_ID || '')}>
                    <GoogleLogin
                      onSuccess={async (cred) => {
                        try {
                          const idToken = (cred as any)?.credential;
                          if (!idToken) throw new Error('Missing credential');
                          // Frontend-only Google auth, similar to MSAL flow
                          const parts = String(idToken).split('.');
                          if (parts.length < 2) throw new Error('Invalid Google token');
                          const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
                          const json = atob(b64);
                          const payload = JSON.parse(json || '{}');
                          const email = String(payload?.email || '').toLowerCase();
                          const name =
                            (payload?.name as string) ||
                            `${payload?.given_name || ''} ${payload?.family_name || ''}`.trim() ||
                            null;
                          if (!email) throw new Error('Google account missing email');
                          setExternalSession({ email, name });
                          navigate('/');
                        } catch (err: any) {
                          setError(String(err?.message || 'Google sign-in failed'));
                        } finally {
                          setLoading(false);
                        }
                      }}
                      onError={() => setError('Google sign-in failed')}
                      useOneTap
                    />
                  </GoogleOAuthProvider>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div className="small" style={{ color: 'var(--muted-2)' }}>Are you an internal employee?</div>
                <button className="btn ghost sm" onClick={() => navigate('/login')}>Use Microsoft sign-in ↗</button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ExternalLogin;
