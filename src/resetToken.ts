// The emailed reset link is /reset-password/<token>. main.tsx calls
// captureResetToken() BEFORE analytics start, so the token is moved out of the
// address bar (to /reset-password) and never lands in a pageview, the browser
// history or a Referer. sessionStorage keeps it for a reload of the page.
const RESET_PATH = /^\/reset-password\/([A-Za-z0-9_.-]+)\/?$/;
const STORE_KEY = 'inspectr_reset_token';
let token: string | null = null;

export const RESET_PAGE = '/reset-password';

export function captureResetToken() {
  const m = window.location.pathname.match(RESET_PATH);
  if (!m) return;
  token = m[1];
  try { sessionStorage.setItem(STORE_KEY, token); } catch { /* storage blocked */ }
  window.history.replaceState({}, '', RESET_PAGE);
}

export function getResetToken(): string | null {
  if (token) return token;
  try { return sessionStorage.getItem(STORE_KEY); } catch { return null; }
}

export function clearResetToken() {
  token = null;
  try { sessionStorage.removeItem(STORE_KEY); } catch { /* storage blocked */ }
}
