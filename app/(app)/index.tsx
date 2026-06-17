import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TrendingUp, TrendingDown, BarChart3, ChevronRight, AlertTriangle, AlertCircle } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/lib/auth-store'
import { Card } from '@/components/ui/Card'
import { AmountText } from '@/components/ui/AmountText'
import type { DashboardStats } from '@/lib/types'
import { colors } from '@/lib/colors'

interface Alert {
    id: string
    type: 'OVERSPEND' | 'LOW_BALANCE'
    message: string
    severity: 'warning' | 'destructive'
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function currentMonthLabel() {
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function DashboardScreen() {
    const router = useRouter()
    const { user } = useAuthStore()
    const router = useRouter()
    const month = toMonthKey(new Date())

    const { data, refetch, isRefetching } = useQuery<DashboardStats>({
        queryKey: ['dashboard'],
        queryFn: async () => (await apiClient.get('/dashboard')).data.data,
        retry: 1,
    })

    const { data: alerts = [] } = useQuery<Alert[]>({
        queryKey: ['alerts'],
        queryFn: async () => {
            const res = await apiClient.get('/alerts')
            return res.data.data ?? []
        },
        retry: 0,
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
                        tintColor={colors.accent}
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
                            <Sparkles size={18} color={colors.accent} strokeWidth={2} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => { haptics.light(); router.push('/settings') }}
                            className="w-10 h-10 rounded-full bg-brand-surface border border-brand-border items-center justify-center"
                            activeOpacity={0.7}
                        >
                            <Settings size={18} color={colors.muted} strokeWidth={2} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View className="px-6 gap-y-4 pb-8">
                    {/* Alerts */}
                    {alerts.map(alert => (
                        <View
                            key={alert.id}
                            className={`flex-row items-start gap-x-3 rounded-2xl p-4 ${alert.severity === 'destructive' ? 'bg-brand-negative/10 border border-brand-negative/20' : 'bg-amber-500/10 border border-amber-500/20'}`}
                        >
                            {alert.severity === 'destructive'
                                ? <AlertCircle size={16} color={colors.destructive} style={{ marginTop: 1 }} />
                                : <AlertTriangle size={16} color="#F59E0B" style={{ marginTop: 1 }} />
                            }
                            <Text className={`flex-1 text-sm leading-relaxed ${alert.severity === 'destructive' ? 'text-brand-negative' : 'text-amber-400'}`}>
                                {alert.message}
                            </Text>
                        </View>
                    ))}

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
                                <ChevronRight size={16} color={colors.muted} strokeWidth={2} />
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
                                <TrendingUp size={14} color={colors.positive} strokeWidth={2} />
                                <Text className="text-brand-muted text-xs uppercase tracking-widest">Income</Text>
                            </View>
                            {data
                                ? <AmountText amount={data.monthlyIncome} size="md" neutral className="text-brand-positive" />
                                : <PlaceholderLine width="w-20" />
                            }
                        </Card>
                        <Card className="flex-1 p-4">
                            <View className="flex-row items-center gap-x-2 mb-2">
                                <TrendingDown size={14} color={colors.negative} strokeWidth={2} />
                                <Text className="text-brand-muted text-xs uppercase tracking-widest">Expenses</Text>
                            </View>
                            {data
                                ? <AmountText amount={-data.monthlyExpenses} size="md" />
                                : <PlaceholderLine width="w-20" />
                            }
                        </Card>
                    </View>

                    {/* Reports entry */}
                    <TouchableOpacity onPress={() => router.push('/(app)/reports')} activeOpacity={0.7}>
                        <Card className="flex-row items-center gap-x-3 p-4">
                            <View className="w-10 h-10 rounded-xl bg-brand-accent/10 items-center justify-center">
                                <BarChart3 size={18} color={colors.accent} strokeWidth={1.8} />
                            </View>
                            <Text className="flex-1 text-brand-text font-medium text-sm">View Reports</Text>
                            <ChevronRight size={16} color={colors.muted} />
                        </Card>
                    </TouchableOpacity>

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
