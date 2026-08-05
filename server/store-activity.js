// Report login / key-action activity back to the PF9 store.
//
// The store aggregates these pings onto the customer's Klaviyo profile
// (`last_login_at`, `last_action_at`, `activated_apps`, ...) so lifecycle flows
// can branch on real usage instead of guessing. Contract and rationale live in
// pf9-store/LIFECYCLE_STATUS.md, "App activity ingest".
//
// Two properties this module must keep, because the callers are a sign-in
// callback and the handler for this app's core action:
//
// 1. It never throws. A marketing-telemetry failure must not become a customer
//    unable to sign in or unable to do the thing they pay for. Note that in
//    Node an unhandled promise rejection is fatal to the process, so the
//    returned promise is caught here rather than left to the caller.
// 2. It never blocks. Callers do not await it, and the request carries its own
//    timeout, so a slow or unreachable store costs the response nothing.
//
// It is also inert by default: with ACTIVITY_SECRET unset it returns
// immediately and sends nothing, so this is safe to deploy before the secret
// exists -- which is the order it will actually happen in.
//
// This file is the fleet-wide client: the same module as
// src/lib/store-activity.ts in the PF9 Next.js apps, as plain ESM because
// this server is JavaScript, not TypeScript. Fix a bug here and copy it.

// Must match a PRICE_MAP key in pf9-store/store_api.py exactly, or the store
// 400s the ping. Verified against PRICE_MAP on 2026-08-05.
export const PRODUCT = "INSPECTR";

const DEFAULT_URL =
  "https://app.plainspokenfoundrynine.com/store-api/app-activity";
const TIMEOUT_MS = 5000;

// The storefront's one-click demo account is not a customer -- its logins and
// actions are storefront traffic, not usage. Guarding here rather than at each
// call site keeps every call site consistent and survives future ones.
const DEMO_EMAIL = "demo@plainspokenfoundrynine.com";

/**
 * Fire-and-forget activity ping. Returns the in-flight promise, or null if
 * nothing was sent. The return value exists so a test can await it; callers
 * ignore it (`void report(...)`).
 *
 * `email` is deliberately unvalidated: call sites read it off a session
 * object, and a null or undefined there must be a no-op, not a crash.
 */
export function report(email, kind, action = "") {
  try {
    const secret = process.env.ACTIVITY_SECRET;
    if (!secret || !email) return null;
    if (String(email).trim().toLowerCase() === DEMO_EMAIL) return null;

    const url = process.env.STORE_ACTIVITY_URL || DEFAULT_URL;

    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PF9-Activity-Secret": secret,
      },
      body: JSON.stringify({ email, product: PRODUCT, kind, action }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).then(
      () => undefined,
      // Telemetry must never surface in an app a customer uses, and an
      // uncaught rejection here would take the whole Node process down.
      () => undefined
    );
  } catch {
    return null;
  }
}
