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
export function computeNetWorth(accounts: { balance: number; type: string; excludeFromNetWorth: boolean; plaidLinked: boolean; hideFromGlobal?: boolean; owed?: number; credit?: number }[]): number {
    let net = 0
    for (const a of accounts) {
        if (a.excludeFromNetWorth || a.hideFromGlobal) continue
        if (DEBT_TYPES.has(a.type)) {
            // (the server says what is owed and what is a credit; older servers did not, so the old sign guess stays as a fallback)
            net -= a.owed ?? (a.plaidLinked ? a.balance : Math.abs(a.balance))
            net += a.credit ?? 0
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

/** What you owe on a debt account (positive number), with the same sign rules as net worth. */
export function amountOwed(a: { balance: number; plaidLinked: boolean; owed?: number }): number {
    return a.owed ?? (a.plaidLinked ? a.balance : Math.abs(a.balance))
}

/** The debt accounts that count toward what you owe (hidden/excluded ones are left out, like net worth). */
export function debtAccounts<T extends { type: string; excludeFromNetWorth: boolean; hideFromGlobal?: boolean }>(accounts: T[]): T[] {
    return accounts.filter((a) => DEBT_TYPES.has(a.type) && !a.excludeFromNetWorth && !a.hideFromGlobal)
}

// Things you own (mirrors isOwnedAsset in the web repo's lib/asset-prompt.ts): a home, a vehicle or another asset, stored as
// type OTHER with a subtype. They get their own group on the Accounts screen; wallet cash and the like stay in "Other".
const HOME_WORDS = /\b(home|house|property|condo|apartment|townhouse|land|real estate)\b/i
const CAR_WORDS = /\b(car|vehicle|truck|suv|auto|motorcycle|boat)\b|honda|toyota|ford|subaru|tesla|chevy|bmw/i
export function isOwnedAsset(a: { name: string; type: string; subtype?: string | null }): boolean {
    return a.type === 'OTHER' && (/real estate|property|vehicle|other asset/i.test(a.subtype ?? '') || HOME_WORDS.test(a.name) || CAR_WORDS.test(a.name))
}

/** What the Add Account screen offers for things you own (saved as type OTHER + a subtype). */
export const ASSET_CHOICES = {
    ASSET_HOME: { subtype: 'real estate', label: 'Home or property', placeholder: 'e.g. My home', defaultName: 'My home' },
    ASSET_VEHICLE: { subtype: 'vehicle', label: 'Vehicle', placeholder: 'e.g. 2019 Honda CR-V', defaultName: 'My vehicle' },
    ASSET_OTHER: { subtype: 'other asset', label: 'Other asset (something you own)', placeholder: 'e.g. Jewelry, boat', defaultName: '' },
} as const
export type AssetChoice = keyof typeof ASSET_CHOICES
export const isAssetChoice = (v: string | null): v is AssetChoice => !!v && v in ASSET_CHOICES
