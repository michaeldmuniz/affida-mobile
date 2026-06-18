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
    updatedAt: string
    createdAt: string
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
