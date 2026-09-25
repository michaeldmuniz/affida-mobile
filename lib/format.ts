// Shared formatting helpers — keep all user-facing date/currency text consistent.

/** "Jan 15" */
export function formatShortDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** "June 2026" */
export function formatMonth(date: Date) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/** "2026-06" — the API's month key format */
export function toMonthKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/** "CREDIT_CARD" → "Credit Card" */
export function formatAccountType(type: string) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
}

/** "$1.2k" / "$540" — compact currency for charts and dense rows */
export function compactUsd(n: number) {
    const abs = Math.abs(n)
    const formatted =
        abs >= 1000
            ? `$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`
            : `$${abs.toFixed(0)}`
    return n < 0 ? `-${formatted}` : formatted
}

/** Today as YYYY-MM-DD in the device's local time zone (family tasks are per local day). */
export function localDay(d = new Date()): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "Every day", "Weekdays", "Mon, Wed, Fri", or "One time" — same labels as the web. */
export function scheduleLabel(task: { frequency: string; days: number[] }): string {
    if (task.frequency === 'ONCE') return 'One time'
    const key = [...task.days].sort().join(',')
    if (key === '0,1,2,3,4,5,6') return 'Every day'
    if (key === '1,2,3,4,5') return 'Weekdays'
    if (key === '0,6') return 'Weekends'
    return task.days.map(d => DAY_NAMES[d]).join(', ')
}
