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

/** "+4.2%" / "−1.3%" */
export function signedPct(pct: number): string {
    return `${pct >= 0 ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`

/** YYYY-MM-DD → "Oct 12". */
export function shortDay(day: string): string {
    return new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** "Oct 12" for a dated one-off; "Starts Oct 12" / "Until Nov 30" / "Ended Oct 3" for repeating — same as the web. */
export function datesLabel(t: { frequency: string; startDate: string | null; endDate: string | null }, today: string): string | null {
    if (t.frequency === 'ONCE') return t.startDate ? shortDay(t.startDate) : null
    if (t.endDate && t.endDate < today) return `Ended ${shortDay(t.endDate)}`
    const parts: string[] = []
    if (t.startDate && t.startDate > today) parts.push(`Starts ${shortDay(t.startDate)}`)
    if (t.endDate) parts.push(`Until ${shortDay(t.endDate)}`)
    return parts.length ? parts.join(' · ') : null
}

/** Adds n days to a YYYY-MM-DD (local calendar). */
export function addDaysTo(day: string, n: number): string {
    const d = new Date(`${day}T12:00:00`)
    d.setDate(d.getDate() + n)
    return localDay(d)
}
