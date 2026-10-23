export interface Rule {
    id: string
    containsText: string | null
    amountMin: number | null
    amountMax: number | null
    amountType: 'DEBIT' | 'CREDIT' | null
    accountType: string | null
    accountId: string | null
    categoryId: string
    category: { id: string; name: string }
    enabled: boolean
    priority: number
}

export interface MobileUser {
    id: string
    email: string
    name: string | null
    subscriptionStatus: string
    twoFactorEnabled: boolean
    mfaMethod: string | null
}

export interface AuthTokenResponse {
    token: string
    expiresAt: string
    user: MobileUser
}

export interface ApiResponse<T> {
    data: T | null
    error: string | null
}

export type MfaStatus = 'MFA_REQUIRED' | 'MFA_EMAIL_REQUIRED' | 'MFA_INVALID'

export interface Account {
    id: string
    name: string
    type: string
    institutionName: string
    balance: number
    creditLimit: number | null
    excludeFromNetWorth: boolean
    plaidLinked: boolean
    /** When the bank last synced; null for manual accounts. */
    lastSyncAt: string | null
    needsReconnect: boolean
    /** Set for the owner when the bank connection needs reconnecting */
    reconnectItemId: string | null
    updatedAt: string
    createdAt: string
    /** True when a linked partner owns this account and shared it with you. */
    isShared: boolean
    /** Your access to a shared account; null for your own accounts. */
    role: 'VIEWER' | 'EDITOR' | null
    /** Shared account you've hidden from transactions & reports (also left out of net worth). */
    hideFromGlobal: boolean
    /** The partner who owns a shared account; null for your own. */
    ownerName: string | null
}

export interface Transaction {
    id: string
    accountId: string
    accountName: string
    amount: number
    /** Transaction date (when it happened) — reports and months go by this. Editable. */
    date: string
    /** When the bank posted it. Read-only. Older API versions don't send it. */
    postedDate?: string
    description: string
    merchantName: string | null
    categoryId: string | null
    categoryName: string | null
    categoryGroup: string | null
    notes: string | null
    flagged: boolean
    pending: boolean
    isManual: boolean
    receiptId?: string | null
}

/** A transaction connected to another one (linked purchase, refund or split). */
export interface ConnectedTransaction {
    id: string
    label: string
    amount: number
    date: string
    accountName: string
}

/** Everything the web transaction dialog shows, loaded when a transaction is opened. */
export interface TransactionDetail {
    id: string
    /** Synced from a bank: the bank sets the amount. */
    isSynced: boolean
    accountName: string
    institutionName: string | null
    amount: number
    date: string
    postedDate: string
    pending: boolean
    logoUrl: string | null
    website: string | null
    plaidCategory: string | null
    plaidCategoryConfidence: string | null
    checkNumber: string | null
    currency: string | null
    location: {
        address: string | null
        city: string | null
        region: string | null
        postalCode: string | null
        country: string | null
        storeNumber: string | null
        lat: number | null
        lon: number | null
    }
    payment: { method: string | null; processor: string | null; reference: string | null }
    counterparties: { name: string; type: string | null; website: string | null; logoUrl: string | null }[]
    linked: ConnectedTransaction[]
    refundOf: ConnectedTransaction | null
    refundedBy: ConnectedTransaction[]
    splitFrom: ConnectedTransaction | null
    splitInto: (ConnectedTransaction & { categoryName: string | null })[]
}

export interface ReceiptLineItem {
    description: string
    amount: number
    categoryId: string | null
    categoryName: string | null
}

export interface Receipt {
    id: string
    status: 'processing' | 'matched' | 'pending' | 'unmatched'
    imageUrl: string | null
    merchantName: string | null
    date: string | null
    total: number | null
    lineItems: ReceiptLineItem[]
    /** The person's saved choice for how tax/tip is handled when the transaction is split */
    taxMode?: 'spread' | 'separate'
    /** False when the receipt can be viewed but not changed (shared account, viewer role) */
    canEdit?: boolean
    splitApplied: boolean
    matchedTransactionId: string | null
    matchedTransaction: Pick<Transaction, 'id' | 'description' | 'merchantName' | 'amount' | 'date'> | null
    createdAt: string
}

export interface Category {
    id: string
    name: string
    group: 'INCOME' | 'EXPENSE' | 'TRANSFER'
    isDefault: boolean
}

export interface Budget {
    /** The budget record's id when there is one, else the category's */
    id: string
    /** Null for a category with spending but no budget set this month */
    budgetId?: string | null
    categoryId: string
    categoryName: string
    categoryGroup: string
    amount: number
    spent: number
    remaining: number
    rollover: boolean
    rolloverAmount: number
    /** Added by parents completing family goals this month (included in remaining). */
    goalRewardAmount?: number
    /** Refunds that boost the budget (included in remaining). */
    refundAmount?: number
    method: string
    isHousehold: boolean
    partnerOnly: boolean
    month: string
}

export interface GoalContribution {
    id: string
    amount: number
    note: string | null
    date: string
    type: string
}

export interface Goal {
    id: string
    name: string
    targetAmount: number
    currentAmount: number
    deadline: string | null
    createdAt: string
    type?: string
    status?: string
    notes?: string | null
    accounts: Array<{ id: string; name: string }>
    contributions?: GoalContribution[]
    // Household goal shared by a partner (read-only on mobile)
    shared?: boolean
    /** % of income committed to this goal (web: "Committing X% of income") */
    savingsRate?: number | null
    startDate?: string | null
    startAmount?: number | null
    /** The "% of income" plan for this month, with earlier months' shortfalls carried in (null without a savings rate) */
    plan?: {
        monthTarget: number
        carryOver: number
        ahead: number
        dueThisMonth: number
        depositedThisMonth: number
        leftThisMonth: number
        sinceMonth: string
    } | null
}

export interface CategoryBreakdownItem {
    name: string
    value: number
    categoryId: string | null
}

export interface TrendPoint {
    month: string
    income: number
    expenses: number
    savings: number
    savingsRate: number
}

export interface NetWorthPoint {
    month: string
    netWorth: number
}

export interface MerchantSpend {
    name: string
    amount: number
}

export interface Insights {
    month: string
    income: number
    expenses: number
    net: number
    categoryBreakdown: CategoryBreakdownItem[]
    trend: TrendPoint[]
    netWorthHistory: NetWorthPoint[]
    topMerchants: MerchantSpend[]
}

export interface SubscriptionItem {
    merchantName: string
    amount: number
    frequency: string
    lastDate: string
    nextDate: string
    confidence: 'High' | 'Medium'
    /** Name it was billed under before the merchant renamed itself (e.g. "Claude.ai"). */
    previousMerchantName?: string | null
}

export interface SubscriptionsResponse {
    monthlyTotal: number
    items: SubscriptionItem[]
}

export interface ChatMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
}

export interface DashboardStats {
    netWorth: number
    totalAssets: number
    totalLiabilities: number
    monthlyIncome: number
    monthlyExpenses: number
    recentTransactions: Transaction[]
}

export interface PaginatedResponse<T> {
    items: T[]
    total: number
    page: number
    totalPages: number
}

// ── Family ────────────────────────────────────────────────────────────────────

export type WalletKind = 'ALLOWANCE' | 'GIFT' | 'EARNED' | 'SPENT' | 'CASHED_OUT' | 'ADJUSTMENT'

/** A kid profile managed by the parents (not a login). */
export interface Child {
    id: string
    name: string
    birthYear: number | null
    /** Chart token name ('chart-1'…'chart-5'); map with kidColor() in lib/colors. */
    color: string | null
    ownerId: string
    balance: number
    /** This month's goal rewards also added to a budget category (list only). */
    addedToBudgetsThisMonth?: number
    createdAt: string
}

export interface WalletEntry {
    id: string
    /** Signed: positive = money in, negative = money out. */
    amount: number
    kind: WalletKind
    note: string | null
    date: string
    createdByName: string | null
    /** Earned by completing a chore/goal — remove it by undoing the task. */
    fromTask: boolean
}

export interface ChildDetail {
    child: Child
    entries: WalletEntry[]
}

export type TaskKind = 'CHORE' | 'HABIT'

/** A chore or daily goal as of a given day (the device's local today). */
export interface ChildTask {
    id: string
    title: string
    kind: TaskKind
    reward: number
    frequency: 'ONCE' | 'REPEATING'
    /** 0 = Sunday … 6 = Saturday */
    days: number[]
    /** YYYY-MM-DD. One-time: the day it's due (null = any day). Repeating: the first day (null = since it was added). */
    startDate: string | null
    /** YYYY-MM-DD, repeating only: the last day (null = never ends). */
    endDate: string | null
    bonusEvery: number | null
    bonusAmount: number | null
    /** The budget category the reward is added to (null if none picked). */
    rewardCategoryId: string | null
    rewardCategoryName: string | null
    /** Unassigned chores: each person's own reward category from the last time they did it ("kid-<id>" / "adult-<id>" -> category id, null = none). No entry = the chore's own. */
    categoryByPerson?: Record<string, string | null>
    /** Unassigned chores: who did it on the viewed day. */
    doneByName?: string | null
    dueOnDay: boolean
    doneOnDay: boolean
    lastDone: string | null
    streak: number
    nextBonusIn: number | null
}

/** You or your partner, with goal rewards added to budgets this month. */
export interface HouseholdAdult {
    id: string
    name: string
    isYou: boolean
    earnedThisMonth: number
}

/** A parent's goals page: budget categories rewards can go to, this month's rewards, and history. */
export interface AdultDetail {
    adult: { id: string; name: string; isYou: boolean }
    categories: { id: string; name: string }[]
    thisMonth: { categoryId: string | null; categoryName: string; total: number }[]
    history: { id: string; day: string; amount: number; title: string; categoryName: string | null }[]
}

// ── Investments ───────────────────────────────────────────────────────────────

export interface InvestmentHolding {
    name: string
    ticker: string | null
    type: string | null
    value: number
    quantity: number
    costBasis: number | null
    gain: number | null
    gainPct: number | null
    /** Share of the portfolio, 0–100. */
    weight: number
}

/** GET /investments — same numbers as the web /investments page. */
export interface Investments {
    hasInvestments: boolean
    /** From account balances, so it matches the Accounts screen. */
    totalValue: number
    gain: number | null
    gainPct: number | null
    change30d: { amount: number; pct: number } | null
    history: { date: string; value: number }[]
    allocation: { type: string; label: string; value: number; pct: number }[]
    holdings: InvestmentHolding[]
    dividends12m: number
    dividends: { month: string; amount: number }[]
    accounts: { id: string; name: string; institutionName: string | null; balance: number }[]
    holdingsAsOf: string | null
}

/**
 * done: completed that day. missed: a repeating day that went by undone.
 * due: on today, not done yet. overdue: a dated one-time task past its day,
 * still not done. upcoming: a future day.
 */
export type CalendarStatus = 'done' | 'missed' | 'due' | 'overdue' | 'upcoming'

/** Someone in the household on the calendar; color is a chart token name. */
export interface CalendarMember {
    kind: 'adult' | 'child'
    id: string
    name: string
    isYou: boolean
    color: string
}

/** A chore or goal on one day of the calendar. */
export interface CalendarItem {
    day: string
    status: CalendarStatus
    taskId: string
    title: string
    kind: TaskKind
    frequency: 'ONCE' | 'REPEATING'
    reward: number
    rewardCategoryName: string | null
    /** The kid's or parent's id (see members). */
    ownerId: string
    /** Deleted since: shown for its history only, can't be changed. */
    archived: boolean
}

export interface FamilyCalendar {
    members: CalendarMember[]
    items: CalendarItem[]
}

// ── Card rewards ──────────────────────────────────────────────────────────────

export type RewardKind = 'CASHBACK' | 'POINTS' | 'MILES'

export interface RewardWalletAccount {
    accountId: string
    accountName: string
    institutionName: string
    match: 'CONFIRMED' | 'AUTO' | 'UNKNOWN'
    canEdit: boolean
    /** False when the card is a partner's, shared with you. */
    mine: boolean
    /** A debit card on a checking/savings/other account you turned rewards on for. */
    isDebit: boolean
    card: { id: string; name: string; issuer: string } | null
    /** The card id the engine used (matches feeChecks). */
    walletCardId: string
    /** You've set some of this card's rates yourself. */
    customized: boolean
    carriesBalance: boolean
    annualSpend: number
    annualRewards: number
}

export interface RewardLookupEntry {
    key: string
    label: string
    kind: 'category' | 'merchant' | 'other'
    cardName: string
    accountName: string
    mine: boolean
    /** The best card is a debit card. */
    debit: boolean
    returnPct: number
    capped: boolean
    /** Any of your cards pays the same here. */
    tied: boolean
}

export interface RewardSuggestion {
    card: { id: string; name: string; issuer: string; annualFee: number; requirement: string | null }
    extraRewards: number
    netGain: number
    breakdown: { category: string; merchant?: string; amount: number; rate: number; returnPct: number; gain: number }[]
}

/** GET /rewards — same numbers as the web Rewards page. */
export interface RewardsOverview {
    monthsOfData: number
    enoughData: boolean
    annualSpend: number
    currentRewards: number
    optimalRewards: number
    wallet: RewardWalletAccount[]
    partnerName: string | null
    /** Best usable card for every category and store. */
    lookup: RewardLookupEntry[]
    feeChecks: { cardId: string; cardName: string; annualFee: number; marginalRewards: number; worthIt: boolean }[]
    carryingBalance: boolean
    ownCarryingBalance: boolean
    carriedCards: string[]
    interestVsRewards: {
        window: 'LAST_12_MONTHS' | 'ANNUALIZED'
        monthsOfData: number
        interestPerYear: number
        rewardsPerYear: number
        interestExceedsRewards: boolean
        interestEstimated: boolean
    } | null
    suggestions: RewardSuggestion[]
    /** Checking/savings/other accounts you could turn debit rewards on for. */
    debitCandidates: { accountId: string; accountName: string; institutionName: string; canEdit: boolean }[]
}

export interface RewardRateLine {
    key: string
    label: string
    rate: number
    /** Percent back after the program's point value. */
    returnPct: number
    cap: string | null
    /** The limit as numbers (published or yours); null = no limit. */
    capAmount: number | null
    capPeriod: 'MONTH' | 'QUARTER' | 'YEAR' | null
    /** Your rate rather than the published one. */
    custom: boolean
    publishedRate: number | null
}

/** GET /rewards/cards/:accountId — a card's published rates plus your own. */
export interface CardRewardsDetail {
    accountId: string
    accountName: string
    /** A debit account (opt-in), not a credit card. */
    isDebit: boolean
    /** Counted in rewards (always for a credit card; for debit once turned on). */
    enabled: boolean
    notes: string | null
    /** A card where you choose the bonus category: the rate and limit to start from. */
    userPick: { label: string; rate: number; cap?: { amount: number; period: 'MONTH' | 'QUARTER' | 'YEAR' } } | null
    canEdit: boolean
    match: 'CONFIRMED' | 'AUTO' | 'UNKNOWN'
    catalogCard: { id: string; name: string; issuer: string; annualFee: number; sourceUrl: string; verifiedAt: string } | null
    customized: boolean
    kind: RewardKind
    pointValueCents: number
    baseRate: number
    publishedBaseRate: number | null
    baseCustom: boolean
    lines: RewardRateLine[]
    choices: { label: string; pick: number; options: string[]; rate: number; returnPct: number }[]
    keys: { key: string; label: string; kind: 'category' | 'merchant' }[]
    catalog: { id: string; name: string; issuer: string }[]
}
