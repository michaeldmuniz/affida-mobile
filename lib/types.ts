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
    date: string
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
    id: string
    categoryId: string
    categoryName: string
    categoryGroup: string
    amount: number
    spent: number
    remaining: number
    rollover: boolean
    rolloverAmount: number
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
    bonusEvery: number | null
    bonusAmount: number | null
    /** Adult goals: the account the reward is logged toward (null for kids, or none picked). */
    rewardAccountId: string | null
    rewardAccountName: string | null
    dueOnDay: boolean
    doneOnDay: boolean
    lastDone: string | null
    streak: number
    nextBonusIn: number | null
}

/** You or your partner, with goal rewards logged this month. */
export interface HouseholdAdult {
    id: string
    name: string
    isYou: boolean
    loggedThisMonth: number
}

/** An adult's goals page: accounts rewards can be logged toward, totals, and history. No money moves. */
export interface AdultDetail {
    adult: { id: string; name: string; isYou: boolean }
    accounts: { id: string; name: string; institutionName: string | null }[]
    totals: { accountId: string | null; accountName: string; total: number }[]
    history: { id: string; day: string; amount: number; title: string; accountName: string | null }[]
}
