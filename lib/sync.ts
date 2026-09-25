import { apiClient } from '@/lib/api-client'
import { queryClient } from '@/lib/query-client'

const CHECK_EVERY_MS = 30 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
let lastCheck = 0

/**
 * Asks the server to sync any bank that hasn't synced in 6+ hours (the same light,
 * no-extra-cost sync the web app runs when opened). Called on launch and when the
 * app returns to the foreground, at most every 30 minutes. If anything synced,
 * refetches once it has had time to land.
 */
export function syncOnOpen() {
    if (Date.now() - lastCheck < CHECK_EVERY_MS) return
    lastCheck = Date.now()
    apiClient.post('/sync')
        .then(res => {
            if (res.data?.data?.synced > 0) setTimeout(() => queryClient.invalidateQueries(), 10_000)
        })
        .catch(() => { /* best effort; webhooks and the daily sync still run */ })
}

/** Status line for a linked account, matching the web app: a status, not a raw date. */
export function syncStatusLabel(account: { plaidLinked: boolean; lastSyncAt?: string | null; needsReconnect?: boolean }): string {
    if (!account.plaidLinked) return 'Manual account'
    if (account.needsReconnect) return 'Needs reconnection'
    if (!account.lastSyncAt) return 'Syncing…'
    const age = Date.now() - new Date(account.lastSyncAt).getTime()
    if (age < DAY_MS) return 'Up to date'
    const days = Math.floor(age / DAY_MS)
    return `Updated ${days} ${days === 1 ? 'day' : 'days'} ago`
}
