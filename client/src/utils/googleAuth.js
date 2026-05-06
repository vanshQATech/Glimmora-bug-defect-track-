// Loads Google Identity Services and renders the Sign-In button.
// Requires VITE_GOOGLE_CLIENT_ID at build/run time.

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let gisPromise = null;

export function loadGoogleIdentity() {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'));
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (gisPromise) return gisPromise;

  gisPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve(window.google));
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Identity Services')));
      if (window.google?.accounts?.id) resolve(window.google);
      return;
    }
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve(window.google);
    s.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(s);
  });

  return gisPromise;
}

export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
export const isGoogleConfigured = () => Boolean(GOOGLE_CLIENT_ID);

export async function renderGoogleButton(container, { onCredential, onError, hostedDomain }) {
  if (!GOOGLE_CLIENT_ID) {
    onError?.(new Error('VITE_GOOGLE_CLIENT_ID is not set'));
    return;
  }
  try {
    const google = await loadGoogleIdentity();
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: ({ credential }) => onCredential?.(credential),
      ...(hostedDomain ? { hosted_domain: hostedDomain } : {}),
      ux_mode: 'popup',
      auto_select: false,
    });
    google.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width: container.clientWidth || 320,
    });
  } catch (err) {
    onError?.(err);
  }
}
