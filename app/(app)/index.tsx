import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TrendingUp, TrendingDown, Sparkles, Settings, ChevronRight, CalendarClock, Wallet } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/lib/auth-store'
import { Card } from '@/components/ui/Card'
import { AmountText } from '@/components/ui/AmountText'
import { LineChart } from '@/components/charts/LineChart'
import { formatShortDate, formatMonth, toMonthKey } from '@/lib/format'
import { haptics } from '@/lib/haptics'
import type { DashboardStats, Insights, SubscriptionsResponse, Budget, Goal, Account } from '@/lib/types'

export default function DashboardScreen() {
    const { user } = useAuthStore()
    const router = useRouter()
    const month = toMonthKey(new Date())

    const { data, refetch, isRefetching } = useQuery<DashboardStats>({
        queryKey: ['dashboard'],
        queryFn: async () => (await apiClient.get('/dashboard')).data.data,
        retry: 1,
    })

    const { data: insights } = useQuery<Insights>({
        queryKey: ['insights', month],
        queryFn: async () => (await apiClient.get('/insights', { params: { month } })).data.data,
        staleTime: 5 * 60 * 1000,
    })

    const { data: subs } = useQuery<SubscriptionsResponse>({
        queryKey: ['subscriptions'],
        queryFn: async () => (await apiClient.get('/subscriptions')).data.data,
        staleTime: 10 * 60 * 1000,
    })

    const { data: budgets } = useQuery<Budget[]>({
        queryKey: ['budgets', month],
        queryFn: async () => (await apiClient.get('/budgets', { params: { month } })).data.data,
        staleTime: 2 * 60 * 1000,
    })

    const { data: goals } = useQuery<Goal[]>({
        queryKey: ['goals'],
        queryFn: async () => (await apiClient.get('/goals')).data.data,
        staleTime: 5 * 60 * 1000,
    })

    const { data: accounts } = useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: async () => (await apiClient.get('/accounts')).data.data,
        staleTime: 5 * 60 * 1000,
    })

    const firstName = user?.name?.split(' ')[0] ?? 'there'
    const isFirstRun = accounts !== undefined && accounts.length === 0

    const upcomingBills = [...(subs?.items ?? [])]
        .sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime())
        .slice(0, 3)

    const totalBudgeted = budgets?.reduce((s, b) => s + b.amount, 0) ?? 0
    const totalSpent = budgets?.reduce((s, b) => s + b.spent, 0) ?? 0
    const budgetPct = totalBudgeted > 0 ? Math.min((totalSpent / totalBudgeted) * 100, 100) : 0
    const overBudgetCount = budgets?.filter((b) => b.spent > b.amount).length ?? 0

    const topGoals = (goals ?? []).slice(0, 2)

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={refetch}
                        tintColor="#5B7BF8"
                    />
                }
            >
                {/* Header */}
                <View className="flex-row items-center justify-between px-6 pt-4 pb-6">
                    <View>
                        <Text className="text-brand-muted text-sm">{formatMonth(new Date())}</Text>
                        <Text className="text-brand-text text-2xl font-bold mt-0.5">
                            Hi, {firstName}
                        </Text>
                    </View>
                    <View className="flex-row gap-x-2">
                        <TouchableOpacity
                            onPress={() => { haptics.medium(); router.push('/assistant') }}
                            className="w-10 h-10 rounded-full bg-brand-accent/15 items-center justify-center"
                            activeOpacity={0.7}
                        >
                            <Sparkles size={18} color="#5B7BF8" strokeWidth={2} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => { haptics.light(); router.push('/settings') }}
                            className="w-10 h-10 rounded-full bg-brand-surface border border-brand-border items-center justify-center"
                            activeOpacity={0.7}
                        >
                            <Settings size={18} color="#6B7280" strokeWidth={2} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View className="px-6 gap-y-4 pb-8">
                    {/* First-run hero */}
                    {isFirstRun && (
                        <Card className="p-6 border-brand-accent/40">
                            <Text className="text-brand-text text-lg font-bold mb-1.5">
                                Let's set up your money
                            </Text>
                            <Text className="text-brand-muted text-sm leading-relaxed mb-4">
                                Connect your bank to import transactions automatically, or add an
                                account manually — your net worth, budgets, and insights start here.
                            </Text>
                            <TouchableOpacity
                                className="bg-brand-accent rounded-xl h-12 items-center justify-center"
                                onPress={() => { haptics.medium(); router.push('/accounts') }}
                                activeOpacity={0.85}
                            >
                                <Text className="text-white font-semibold text-sm">Add your first account</Text>
                            </TouchableOpacity>
                        </Card>
                    )}

                    {/* Net Worth Card */}
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => { haptics.light(); router.push('/accounts') }}
                    >
                        <Card className="p-6">
                            <View className="flex-row items-center justify-between mb-3">
                                <Text className="text-brand-muted text-xs font-medium uppercase tracking-widest">
                                    Net Worth
                                </Text>
                                <ChevronRight size={16} color="#6B7280" strokeWidth={2} />
                            </View>
                            {data ? (
                                <>
                                    <AmountText
                                        amount={data.netWorth}
                                        size="xl"
                                        neutral
                                        className="text-brand-text"
                                    />
                                    {insights?.netWorthHistory && insights.netWorthHistory.length >= 2 && (
                                        <View className="mt-4 -mb-1">
                                            <LineChart
                                                points={insights.netWorthHistory.map((p) => p.netWorth)}
                                                height={48}
                                                sparkline
                                            />
                                        </View>
                                    )}
                                    <View className="flex-row gap-x-6 mt-4">
                                        <View>
                                            <Text className="text-brand-muted text-xs mb-1">Assets</Text>
                                            <AmountText amount={data.totalAssets} size="sm" neutral className="text-brand-positive" />
                                        </View>
                                        <View>
                                            <Text className="text-brand-muted text-xs mb-1">Liabilities</Text>
                                            <AmountText amount={-data.totalLiabilities} size="sm" />
                                        </View>
                                    </View>
                                </>
                            ) : (
                                <NetWorthPlaceholder />
                            )}
                        </Card>
                    </TouchableOpacity>

                    {/* Cash Flow */}
                    <View className="flex-row gap-x-3">
                        <Card className="flex-1 p-4">
                            <View className="flex-row items-center gap-x-2 mb-2">
                                <TrendingUp size={14} color="#34D399" strokeWidth={2} />
                                <Text className="text-brand-muted text-xs uppercase tracking-widest">Income</Text>
                            </View>
                            {data
                                ? <AmountText amount={data.monthlyIncome} size="md" neutral className="text-brand-positive" />
                                : <PlaceholderLine width="w-20" />
                            }
                        </Card>
                        <Card className="flex-1 p-4">
                            <View className="flex-row items-center gap-x-2 mb-2">
                                <TrendingDown size={14} color="#F87171" strokeWidth={2} />
                                <Text className="text-brand-muted text-xs uppercase tracking-widest">Expenses</Text>
                            </View>
                            {data
                                ? <AmountText amount={-data.monthlyExpenses} size="md" />
                                : <PlaceholderLine width="w-20" />
                            }
                        </Card>
                    </View>

                    {/* Budget Pulse */}
                    {budgets && budgets.length > 0 && (
                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => { haptics.light(); router.push('/budgets') }}
                        >
                            <Card className="p-5">
                                <View className="flex-row items-center justify-between mb-3">
                                    <View className="flex-row items-center gap-x-2">
                                        <Wallet size={14} color="#5B7BF8" strokeWidth={2} />
                                        <Text className="text-brand-muted text-xs uppercase tracking-widest">
                                            Budget This Month
                                        </Text>
                                    </View>
                                    <ChevronRight size={16} color="#6B7280" strokeWidth={2} />
                                </View>
                                <View className="flex-row items-baseline gap-x-1.5 mb-3">
                                    <Text className="text-brand-text text-xl font-bold font-mono">
                                        ${totalSpent.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                    </Text>
                                    <Text className="text-brand-muted text-sm">
                                        of ${totalBudgeted.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                    </Text>
                                </View>
                                <View className="h-2 bg-brand-elevated rounded-full overflow-hidden">
                                    <View
                                        className={`h-full rounded-full ${totalSpent > totalBudgeted ? 'bg-brand-negative' : 'bg-brand-accent'}`}
                                        style={{ width: `${Math.max(2, budgetPct)}%` }}
                                    />
                                </View>
                                {overBudgetCount > 0 && (
                                    <Text className="text-brand-negative text-xs mt-2.5 font-medium">
                                        {overBudgetCount} categor{overBudgetCount === 1 ? 'y is' : 'ies are'} over budget
                                    </Text>
                                )}
                            </Card>
                        </TouchableOpacity>
                    )}

                    {/* Upcoming bills */}
                    {upcomingBills.length > 0 && (
                        <View>
                            <View className="flex-row items-center justify-between mb-3">
                                <Text className="text-brand-text font-semibold text-base">Upcoming Bills</Text>
                                <TouchableOpacity onPress={() => { haptics.light(); router.push('/subscriptions') }} hitSlop={8}>
                                    <Text className="text-brand-accent text-xs font-semibold">See all</Text>
                                </TouchableOpacity>
                            </View>
                            <Card className="overflow-hidden p-0">
                                {upcomingBills.map((bill, i) => (
                                    <View
                                        key={bill.merchantName}
                                        className={`flex-row items-center px-4 py-3.5 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                                    >
                                        <View className="w-8 h-8 rounded-lg bg-brand-accent/15 items-center justify-center mr-3">
                                            <CalendarClock size={14} color="#5B7BF8" strokeWidth={2} />
                                        </View>
                                        <View className="flex-1 pr-3">
                                            <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>
                                                {bill.merchantName}
                                            </Text>
                                            <Text className="text-brand-muted text-xs mt-0.5">
                                                {formatShortDate(bill.nextDate)}
                                            </Text>
                                        </View>
                                        <AmountText amount={-bill.amount} size="sm" />
                                    </View>
                                ))}
                            </Card>
                        </View>
                    )}

                    {/* Goals preview */}
                    {topGoals.length > 0 && (
                        <View>
                            <View className="flex-row items-center justify-between mb-3">
                                <Text className="text-brand-text font-semibold text-base">Goals</Text>
                                <TouchableOpacity onPress={() => { haptics.light(); router.push('/goals') }} hitSlop={8}>
                                    <Text className="text-brand-accent text-xs font-semibold">See all</Text>
                                </TouchableOpacity>
                            </View>
                            <Card className="p-5 gap-y-4">
                                {topGoals.map((goal) => {
                                    const pct = goal.targetAmount > 0
                                        ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
                                        : 0
                                    return (
                                        <View key={goal.id}>
                                            <View className="flex-row items-center justify-between mb-1.5">
                                                <Text className="text-brand-text text-sm font-medium flex-1 pr-3" numberOfLines={1}>
                                                    {goal.name}
                                                </Text>
                                                <Text className="text-brand-muted text-xs">{pct.toFixed(0)}%</Text>
                                            </View>
                                            <View className="h-1.5 bg-brand-elevated rounded-full overflow-hidden">
                                                <View
                                                    className={`h-full rounded-full ${pct >= 100 ? 'bg-brand-positive' : 'bg-brand-accent'}`}
                                                    style={{ width: `${Math.max(2, pct)}%` }}
                                                />
                                            </View>
                                        </View>
                                    )
                                })}
                            </Card>
                        </View>
                    )}

                    {/* Recent Transactions */}
                    <View>
                        <View className="flex-row items-center justify-between mb-3">
                            <Text className="text-brand-text font-semibold text-base">Recent Activity</Text>
                            <TouchableOpacity onPress={() => { haptics.light(); router.push('/transactions') }} hitSlop={8}>
                                <Text className="text-brand-accent text-xs font-semibold">See all</Text>
                            </TouchableOpacity>
                        </View>
                        {data?.recentTransactions?.length ? (
                            <Card className="divide-y divide-brand-border overflow-hidden">
                                {data.recentTransactions.map((tx, i) => (
                                    <View key={tx.id} className={`flex-row items-center justify-between py-3.5 ${i > 0 ? 'border-t border-brand-border' : ''}`}>
                                        <View className="flex-1 pr-3">
                                            <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>
                                                {tx.merchantName ?? tx.description}
                                            </Text>
                                            <Text className="text-brand-muted text-xs mt-0.5">
                                                {tx.categoryName ?? 'Uncategorized'} · {formatShortDate(tx.date)}
                                            </Text>
                                        </View>
                                        <AmountText
                                            amount={tx.amount}
                                            size="sm"
                                            showSign
                                        />
                                    </View>
                                ))}
                            </Card>
                        ) : (
                            <RecentTransactionsPlaceholder />
                        )}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

function PlaceholderLine({ width }: { width: string }) {
    return <View className={`h-4 ${width} bg-brand-elevated rounded-md`} />
}

function NetWorthPlaceholder() {
    return (
        <View className="gap-y-3">
            <View className="h-9 w-44 bg-brand-elevated rounded-lg" />
            <View className="flex-row gap-x-6 mt-1">
                <View className="gap-y-1.5">
                    <View className="h-2.5 w-10 bg-brand-elevated rounded" />
                    <View className="h-4 w-20 bg-brand-elevated rounded" />
                </View>
                <View className="gap-y-1.5">
                    <View className="h-2.5 w-16 bg-brand-elevated rounded" />
                    <View className="h-4 w-20 bg-brand-elevated rounded" />
                </View>
            </View>
        </View>
    )
}

function RecentTransactionsPlaceholder() {
    return (
        <Card>
            <View className="gap-y-4">
                {[1, 2, 3].map((i) => (
                    <View key={i} className="flex-row items-center justify-between">
                        <View className="gap-y-1.5 flex-1">
                            <View className="h-3.5 w-32 bg-brand-elevated rounded" />
                            <View className="h-2.5 w-20 bg-brand-elevated rounded" />
                        </View>
                        <View className="h-3.5 w-16 bg-brand-elevated rounded" />
                    </View>
                ))}
            </View>
        </Card>
    )
}
