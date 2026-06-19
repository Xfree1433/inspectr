// Server-side PostHog helper (posthog-node, ESM). See pf9-store/POSTHOG_TRACKING_PLAN.md.
import { PostHog } from "posthog-node";

const APP_SLUG = "inspectr";

// Shared PF9 project key (fleet default); override via POSTHOG_KEY env.
const DEFAULT_KEY = "phc_kqFGBkXKCodfJGJBFdZs3h9Qm43AQaqnyCiETDAwzgmw";

let client = null;

function getClient() {
  const key = process.env.POSTHOG_KEY || process.env.VITE_POSTHOG_KEY || DEFAULT_KEY;
  if (!key) return null;
  if (!client) {
    client = new PostHog(key, {
      host: process.env.POSTHOG_HOST || "https://us.i.posthog.com",
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return client;
}

/**
 * Capture a server-side event tagged with app=inspectr. Never throws.
 * distinctId should be the user's email so the journey stitches with the storefront.
 */
export function captureServer(event, distinctId, properties = {}, opts = {}) {
  const ph = getClient();
  if (!ph || !distinctId) return;
  try {
    ph.capture({
      distinctId,
      event,
      properties: { app: APP_SLUG, ...properties },
      groups: opts.account ? { account: opts.account } : undefined,
    });
  } catch {
    // analytics must never break the request
  }
}
