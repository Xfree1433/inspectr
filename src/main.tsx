import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import posthog from 'posthog-js'
import App from './App.tsx'

// PostHog product analytics (pageviews + autocapture). See pf9-store/POSTHOG_TRACKING_PLAN.md.
// Shared PF9 project key (fleet default); override at build time via VITE_POSTHOG_KEY.
const PH_KEY = import.meta.env.VITE_POSTHOG_KEY || 'phc_kqFGBkXKCodfJGJBFdZs3h9Qm43AQaqnyCiETDAwzgmw'
if (PH_KEY) {
  posthog.init(PH_KEY, {
    api_host: import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com',
    defaults: '2025-05-24',
    capture_pageview: true,
    person_profiles: 'identified_only',
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
