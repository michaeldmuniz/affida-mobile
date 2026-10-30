import { AppState } from 'react-native'
import { apiClient } from './api-client'
import { useAuthStore } from './auth-store'

// Usage tracking for the admin (see lib/usage-events.ts in the web repo): which screens people open and which buttons
// they use. Only a screen's route or a fixed action key is sent, never amounts, names or anything typed. Events are
// buffered and sent in one request every few seconds and when the app goes to the background; the same key within
// 30 s counts once. Best effort: a failure is ignored and never shown.

type Ev = { kind: 'page' | 'action'; name: string }

const FLUSH_MS = 5000
const DEDUPE_MS = 30_000
let queue: Ev[] = []
let timer: ReturnType<typeof setTimeout> | null = null
const lastSent = new Map<string, number>()

export function flushTracking() {
    if (timer) { clearTimeout(timer); timer = null }
    if (queue.length === 0) return
    const events = queue
    queue = []
    if (!useAuthStore.getState().token) return
    apiClient.post('/track', { events }).catch(() => { /* tracking is best effort */ })
}

function track(kind: Ev['kind'], name: string) {
    if (!useAuthStore.getState().token) return
    const key = `${kind}:${name}`
    const now = Date.now()
    if (now - (lastSent.get(key) ?? 0) < DEDUPE_MS) return
    lastSent.set(key, now)
    queue.push({ kind, name })
    if (!timer) timer = setTimeout(flushTracking, FLUSH_MS)
}

/** A button or feature used. `key` is a fixed lowercase key like `scan_open`, never anything the person typed. */
export const trackAction = (key: string) => track('action', key)

/** A screen opened: the router path, named like the website's pages ("/" is the dashboard, "/debts" is "/debt"). */
export const trackScreen = (pathname: string) => track('page', pathname === '/' ? '/dashboard' : pathname.replace(/^\/debts(?=\/|$)/, '/debt'))

AppState.addEventListener('change', (next) => { if (next !== 'active') flushTracking() })
