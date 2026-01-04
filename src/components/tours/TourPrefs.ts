export type TourId = 'appWelcome' | 'userGuide' | 'overview' | 'analytics' | 'batch' | 'manage' | 'policies' | 'settings' | 'rbac';

export interface TourPrefs {
  globalEnabled: boolean;
  enabled: Record<TourId, boolean>;
}

const STORAGE_KEY = 'tour_prefs';

const defaultPrefs = (): TourPrefs => ({
  globalEnabled: true,
  enabled: {
    appWelcome: true,
    userGuide: true,
    overview: true,
    analytics: true,
    batch: true,
    manage: true,
    policies: true,
    settings: true,
    rbac: true,
  }
});

export function getPrefs(): TourPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPrefs();
    const parsed = JSON.parse(raw);
    const d = defaultPrefs();
    return {
      globalEnabled: typeof parsed.globalEnabled === 'boolean' ? parsed.globalEnabled : d.globalEnabled,
      enabled: { ...d.enabled, ...(parsed.enabled || {}) },
    };
  } catch {
    return defaultPrefs();
  }
}

export function savePrefs(p: TourPrefs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function isGlobalEnabled(): boolean {
  return getPrefs().globalEnabled !== false;
}

export function isTourEnabled(id: TourId): boolean {
  const p = getPrefs();
  return p.globalEnabled !== false && p.enabled[id] !== false;
}

export function setGlobalEnabled(value: boolean) {
  const p = getPrefs();
  p.globalEnabled = !!value;
  savePrefs(p);
}

export function setTourEnabled(id: TourId, value: boolean) {
  const p = getPrefs();
  p.enabled[id] = !!value;
  savePrefs(p);
}
