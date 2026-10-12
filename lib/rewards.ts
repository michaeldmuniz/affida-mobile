import type { RewardKind } from '@/lib/types'

// Labels for the reward categories and stores the API sends as keys (mirrors the web repo's
// lib/optimizer/reward-category.ts).
export const REWARD_LABELS: Record<string, string> = {
    DINING: 'Dining', GROCERIES: 'Groceries', GAS: 'Gas & EV charging', FLIGHTS: 'Flights', HOTELS: 'Hotels',
    TRAVEL_OTHER: 'Other travel', TRANSIT: 'Transit & rideshare', STREAMING: 'Streaming', DRUGSTORE: 'Drugstores',
    ENTERTAINMENT: 'Entertainment', HOME_IMPROVEMENT: 'Home improvement', UTILITIES: 'Utilities',
    PHONE_INTERNET: 'Phone & internet', ONLINE_RETAIL: 'Online shopping', WHOLESALE_CLUB: 'Wholesale clubs',
    SUPERSTORE: 'Walmart, Target & superstores', FITNESS: 'Gyms & fitness', OTHER: 'Everything else',
    AMAZON: 'Amazon', WHOLE_FOODS: 'Whole Foods', COSTCO: 'Costco', WALMART: 'Walmart', TARGET: 'Target', APPLE: 'Apple',
    DELTA: 'Delta', UNITED: 'United', SOUTHWEST: 'Southwest', AMERICAN: 'American Airlines', ALASKA: 'Alaska & Hawaiian',
    JETBLUE: 'JetBlue', MARRIOTT: 'Marriott hotels', HILTON: 'Hilton hotels', IHG: 'IHG hotels', HYATT: 'Hyatt hotels',
}

export const rewardLabel = (key: string) => REWARD_LABELS[key] ?? key

/** "4% back" for cash back; "3x · 3% back" for points and miles. */
export function pctText(n: number) {
    return `${Number.isInteger(n) ? n : n.toFixed(2).replace(/0$/, '')}% back`
}

export function rateText(kind: RewardKind, rate: number, returnPct: number) {
    return kind === 'CASHBACK' ? pctText(returnPct) : `${rate}x · ${pctText(returnPct)}`
}

export const KIND_LABEL: Record<RewardKind, string> = { CASHBACK: 'Cash back', POINTS: 'Points', MILES: 'Miles' }
