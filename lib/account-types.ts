// Account types whose balance counts as debt (mirrors DEBT_TYPES in the web repo's lib/account-types.ts)
export const DEBT_TYPES = new Set([
    'CREDIT_CARD', 'LINE_OF_CREDIT', 'MORTGAGE',
    'AUTO_LOAN', 'STUDENT_LOAN', 'PERSONAL_LOAN', 'LOAN',
])

/**
 * Net worth over an account list — mirrors computeAccountTotals() in the web repo's
 * lib/account-types.ts so this matches the dashboard figure. Debt balances count as
 * owed: Plaid reports them positive (negative = credit in your favour), manual entries
 * may use either sign. Shared accounts you've hidden are left out, as on the dashboard.
 */
export function computeNetWorth(accounts: { balance: number; type: string; excludeFromNetWorth: boolean; plaidLinked: boolean; hideFromGlobal?: boolean }[]): number {
    let net = 0
    for (const a of accounts) {
        if (a.excludeFromNetWorth || a.hideFromGlobal) continue
        if (DEBT_TYPES.has(a.type)) {
            net -= a.plaidLinked ? a.balance : Math.abs(a.balance)
        } else {
            net += a.balance
        }
    }
    return net
}

/** Accounts you can write to: your own, or a partner's shared with EDITOR access. */
export function canEditAccount(a: { isShared?: boolean; role?: 'VIEWER' | 'EDITOR' | null }): boolean {
    return !a.isShared || a.role === 'EDITOR'
}
