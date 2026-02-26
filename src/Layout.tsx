/* eslint-disable max-lines, max-lines-per-function, complexity, max-depth, no-empty, @typescript-eslint/no-non-null-assertion, @typescript-eslint/no-empty-function */
import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useExternalAuth } from './context/ExternalAuthContext';
import { useFeatureFlags } from './context/FeatureFlagsContext';
import { useRBAC } from './context/RBACContext';
import { useTenant } from './context/TenantContext';
// import DevPanel from './components/DevPanel';
import { info } from './diagnostics/logger';
import { getBatches, getUserProgress } from './services/dbService';
import DancingLogoOverlay from './components/DancingLogoOverlay';
import { getBrandLogoUrl } from './utils/runtimeConfig';
import { enforceDuePolicies } from './utils/policiesDue';
import AppWelcomeTour from './components/tours/AppWelcomeTour';

const Layout: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { account, token, photo, login, logout } = useAuth();
  const {
    user: externalUser,
    isAuthenticated: isExternal,
    logout: externalLogout,
  } = useExternalAuth();
  const { externalSupport, loaded: flagsLoaded } = useFeatureFlags();
  const { tenant } = useTenant();
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const ls = localStorage.getItem('sunbeth_theme');
      if (ls === 'light' || ls === 'dark') return ls;
    } catch {
      /* ignore */
    }
    try {
      const attr = document.documentElement.getAttribute('data-theme');
      if (attr === 'light' || attr === 'dark') return attr;
    } catch {
      /* ignore */
    }
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
    } catch {
      return 'light';
    }
  });
  const [stickyHeader, setStickyHeader] = useState<boolean>(() => {
    try {
      return (localStorage.getItem('sunbeth_sticky_header') || 'true') === 'true';
    } catch {
      return true;
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useEffect(() => {
    // Persist the chosen theme, but avoid forcing the DOM attribute here to prevent
    // racing against ThemeController/TenantProvider initial application.
    try {
      localStorage.setItem('sunbeth_theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  useEffect(() => {
    try {
      localStorage.setItem('sunbeth_sticky_header', stickyHeader ? 'true' : 'false');
    } catch {
      /* ignore */
    }
  }, [stickyHeader]);
  const navigate = useNavigate();
  const location = useLocation();
  const prevAccount = useRef(account);
  const [pending, setPending] = useState<number | null>(null);
  const [dueBy, setDueBy] = useState<string | null>(null);
  const duePoliciesChecked = useRef<boolean>(false);

  useEffect(() => {
    info('Layout mounted');
    const compute = async () => {
      // if not signed in yet, show neutral state
      if ((!account || !token) && !isExternal) {
        setPending(null);
        setDueBy(null);
        return;
      }

      // Live mode: fetch batches + per-batch progress
      try {
        const email: string | undefined = (
          account?.username ||
          externalUser?.email ||
          undefined
        )?.toLowerCase();

        let list: any[] = [];
        try {
          list = await getBatches(token || undefined, email);
        } catch {
          list = [];
        }

        if (!Array.isArray(list) || list.length === 0) {
          setPending(0);
          setDueBy(null);
          return;
        }

        // Fetch per-batch progress in parallel so the dashboard doesn't block on sequential calls.
        const progressResults = await Promise.allSettled(
          list.map((b) => getUserProgress(b.toba_batchid, token || undefined, undefined, email))
        );

        let pendingTotal = 0;
        const incompletes: Array<{ due?: string | null }> = [];

        progressResults.forEach((res, idx) => {
          if (res.status !== 'fulfilled') return;
          const p = res.value || {};
          const total = p.total ?? 0;
          const acked = p.acknowledged ?? 0;
          const remain = Math.max(0, total - acked);
          pendingTotal += remain;
          if ((p.percent ?? 0) < 100) incompletes.push({ due: list[idx]?.toba_duedate });
        });

        setPending(pendingTotal);

        if (incompletes.length) {
          const dates = incompletes.map((i) => i.due).filter(Boolean) as string[];
          if (dates.length) {
            const min = dates.reduce((a, d) => (new Date(d) < new Date(a) ? d! : a!));
            setDueBy(min);
          } else setDueBy(null);
        } else setDueBy(null);
      } catch {
        setPending(null);
        setDueBy(null);
      }
    };

    compute();
    const onProgress = () => compute();
    window.addEventListener('sunbeth:progressUpdated', onProgress as EventListener);
    return () => {
      window.removeEventListener('sunbeth:progressUpdated', onProgress as EventListener);
    };
  }, [account, token, isExternal, externalUser?.email]);

  // Proactively prompt for due policies on login
  useEffect(() => {
    const email = (account?.username || externalUser?.email || undefined)?.toLowerCase();
    if (!email || duePoliciesChecked.current) return;
    duePoliciesChecked.current = true;
    (async () => {
      try {
        await enforceDuePolicies(email);
      } catch {}
    })();
  }, [account?.username, externalUser?.email]);
  const rbac = useRBAC();

  // If External Support is disabled while an external user is signed in, log them out and route to landing
  useEffect(() => {
    if (flagsLoaded && !externalSupport && isExternal) {
      try {
        externalLogout();
      } catch {
        /* ignore */
      }
      try {
        navigate('/', { replace: true });
      } catch {
        /* ignore */
      }
    }
  }, [flagsLoaded, externalSupport, isExternal, externalLogout, navigate]);
  // Redirect rules around auth transitions for cleaner UX
  useEffect(() => {
    const was = prevAccount.current;
    const now = account;
    // Login occurred
    if (!was && now) {
      // If user is on About (public info) after logging in, send them to Dashboard
      if (location.pathname === '/about') navigate('/', { replace: true });
    }
    // Logout occurred
    if (was && !now) {
      // After logout, ensure we land on the public landing page
      if (location.pathname !== '/') navigate('/', { replace: true });
    }
    prevAccount.current = account;
  }, [account, location.pathname, navigate]);

  // If an external user signs in while on the login gateway, send them to the dashboard.
  useEffect(() => {
    if (isExternal && location.pathname.startsWith('/login')) {
      navigate('/', { replace: true });
    }
  }, [isExternal, location.pathname, navigate]);

  // If already authenticated and currently on About, redirect to the dashboard.
  useEffect(() => {
    if (account && location.pathname === '/about') {
      navigate('/', { replace: true });
    }
  }, [account, location.pathname, navigate]);
  const showAside = !!(
    (account || isExternal) &&
    (location.pathname === '/' || location.pathname.startsWith('/dashboard'))
  );
  const headerActionsClass = `header-actions ${account || isExternal ? 'is-auth' : 'is-public'}`;
  const headerClass = `${stickyHeader ? 'app-header sticky' : 'app-header'} ${mobileMenuOpen ? 'mobile-menu-open' : ''}`;
  const userDisplayName = account?.name || externalUser?.name || externalUser?.email || 'User';
  const userInitial = (account?.name || externalUser?.name || externalUser?.email || 'U')
    .slice(0, 1)
    .toUpperCase();
  const handleLogout = () => {
    if (account) logout();
    else if (isExternal) externalLogout();
  };

  // Close mobile menu when navigating or auth context changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, account, isExternal]);
  return (
    <>
      {/* Global busy overlay (dancing logo) */}
      <DancingLogoOverlay />
      <header className={headerClass}>
        <div className="brand">
          {/* Use configured brand logo; fall back gracefully if it fails to load */}
          {(() => {
            const src = getBrandLogoUrl();
            const isAbs = src && /^(https?:)?\//i.test(src as string);
            const url =
              src && src.startsWith('/')
                ? `${window.location.origin}${src}`
                : src || '/brand/SunbethGlobal.png';
            return (
              <img
                src={url}
                alt="Sunbeth"
                style={{ maxHeight: 40, width: 'auto', objectFit: 'contain' }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.opacity = '0.18';
                  (e.target as HTMLImageElement).alt = 'Logo';
                }}
              />
            );
          })()}
          <div>
            <div className="h1" style={{ color: '#fff' }}>
              {process.env.REACT_APP_BRAND_NAME ? ` ${process.env.REACT_APP_BRAND_NAME}` : ''}
            </div>
            <div className="small" style={{ color: '#fff', opacity: 0.9 }}>
              Employee Acknowledgment Portal
            </div>
            {process.env.NODE_ENV !== 'production' && tenant && (
              <div className="small" style={{ marginTop: 4 }}>
                <span
                  className="badge"
                  title="Active tenant in dev (resolved by X-Tenant-Domain header or host)"
                >
                  Dev Tenant: {tenant.name}
                  {tenant.domain ? ` · ${tenant.domain}` : ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {(account || isExternal) && (
          <div className="header-quick" aria-label="Quick user controls">
            <button
              className="mobile-menu-toggle"
              aria-label="Toggle menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>

            <div className="header-chip" title={userDisplayName}>
              <div className="chip-avatar">{userInitial}</div>
            </div>

            {/* <button className="btn outline sm logout-btn" onClick={handleLogout}>
              ↩ Logout
            </button> */}
          </div>
        )}

        {/* show auth area when signed-in (MSAL) or as external; else show a light nav */}
        {account ? (
          <div className={`${headerActionsClass} signed-in`}>
            <AppWelcomeTour />
            {rbac.isSuperAdmin && (
              <div
                title="Super Admin (from REACT_APP_SUPER_ADMINS)"
                style={{
                  background: '#fee2e2',
                  color: '#991b1b',
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 13,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>⚡ Super Admin</span>
              </div>
            )}
            <button
              className="btn ghost sm"
              aria-label="Toggle theme"
              onClick={() => {
                const next = theme === 'light' ? 'dark' : 'light';
                setTheme(next);
                try {
                  document.documentElement.setAttribute('data-theme', next);
                  window.dispatchEvent(new CustomEvent('sunbeth:themeChanged'));
                } catch {
                  /* ignore */
                }
              }}
            >
              {theme === 'light' ? 'Dark' : 'Light'} Mode
            </button>
            <button
              className="btn ghost sm"
              aria-label="Toggle sticky header"
              onClick={() => setStickyHeader((s) => !s)}
            >
              {stickyHeader ? 'Unpin Header' : 'Pin Header'}
            </button>

            <div className="header-user">
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  overflow: 'hidden',
                  background: '#fff',
                }}
              >
                {photo ? (
                  <img
                    src={photo}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    alt="avatar"
                  />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: '#ccc' }} />
                )}
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'column' }}
                className="header-user-meta"
              >
                <div style={{ fontWeight: 700, color: '#fff' }}>{account.name}</div>
                <div style={{ color: '#ddd', fontSize: 13 }}>{account.username}</div>
              </div>
              <button className="btn sm" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          </div>
        ) : isExternal ? (
          <div className={`${headerActionsClass} signed-in`}>
            <AppWelcomeTour />
            <button
              className="btn ghost sm"
              aria-label="Toggle theme"
              onClick={() => {
                const next = theme === 'light' ? 'dark' : 'light';
                setTheme(next);
                try {
                  document.documentElement.setAttribute('data-theme', next);
                  window.dispatchEvent(new CustomEvent('sunbeth:themeChanged'));
                } catch {
                  /* ignore */
                }
              }}
            >
              {theme === 'light' ? 'Dark' : 'Light'} Mode
            </button>
            <button
              className="btn ghost sm"
              aria-label="Toggle sticky header"
              onClick={() => setStickyHeader((s) => !s)}
            >
              {stickyHeader ? 'Unpin Header' : 'Pin Header'}
            </button>

            <div className="header-user">
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  overflow: 'hidden',
                  background: '#e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#111',
                  fontWeight: 700,
                }}
              >
                {(externalUser?.name || externalUser?.email || 'U').slice(0, 1).toUpperCase()}
              </div>
              <div
                style={{ display: 'flex', flexDirection: 'column' }}
                className="header-user-meta"
              >
                <div style={{ fontWeight: 700, color: '#fff' }}>
                  {externalUser?.name || 'External User'}
                </div>
                <div style={{ color: '#ddd', fontSize: 13 }}>{externalUser?.email}</div>
              </div>
              <button className="btn sm" onClick={handleLogout}>
                Sign out
              </button>
            </div>
          </div>
        ) : (
          <div className={`${headerActionsClass} guest`}>
            <AppWelcomeTour />
            {/* <a
              href="/about"
              className="small"
              style={{ color: '#fff', textDecoration: 'none', opacity: 0.95 }}
            >
              About
            </a> */}
            <Link to="/about"><button className="btn ghost sm" type="button">About</button></Link>
            <button
              className="btn ghost sm"
              aria-label="Toggle theme"
              onClick={() => {
                const next = theme === 'light' ? 'dark' : 'light';
                setTheme(next);
                try {
                  document.documentElement.setAttribute('data-theme', next);
                  window.dispatchEvent(new CustomEvent('sunbeth:themeChanged'));
                } catch {
                  /* ignore */
                }
              }}
            >
              {theme === 'light' ? 'Dark' : 'Light'} Mode
            </button>
            <button
              className="btn ghost sm"
              aria-label="Toggle sticky header"
              onClick={() => setStickyHeader((s) => !s)}
            >
              {stickyHeader ? 'Unpin Header' : 'Pin Header'}
            </button>
            <button className="btn sm" onClick={() => login()}>
              Sign in
            </button>
          </div>
        )}
      </header>

      <div className={`wrap ${!account ? 'landing-centered' : ''} ${!showAside ? 'centered' : ''}`}>
        <div className="grid">

          <main>{children}</main>
          {showAside && (
            <aside>
              <div className="card">
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <div>
                    <div style={{ fontWeight: 700, color: 'var(--primary)' }}>Batch Overview</div>
                    <div className="muted small">Rollout</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: 18 }}>{pending ?? '—'}</div>
                    <div className="muted small">You have {pending ?? 0} pending items</div>
                  </div>
                </div>

                <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid #f4f4f4' }} />

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  {rbac.canEditAdmin && (
                    <Link to="/admin">
                      <button className="btn full sm">Admin View</button>
                    </Link>
                  )}
                </div>

                <div style={{ height: 12 }} />
                <div className="muted small">Due by: {dueBy || '—'}</div>
                <div style={{ height: 6 }} />
                {/* <div className="muted small">Assigned to: All staff</div> */}
              </div>
            </aside>
          )}
        </div>

        <footer>©{new Date().getFullYear()} Sunbeth Global Concept. All Rights Reserved.</footer>
      </div>
    </>
  );
};

export default Layout;
