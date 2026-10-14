import { useEffect, useRef, useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TrendingUp, TrendingDown, ChevronRight, AlertTriangle, AlertCircle, Sparkles, Settings, PlusCircle } from 'lucide-react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/lib/auth-store'
import { Card } from '@/components/ui/Card'
import { AmountText } from '@/components/ui/AmountText'
import { LineChart } from '@/components/charts/LineChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { colorForIndex } from '@/components/charts/palette'
import { haptics } from '@/lib/haptics'
import { formatShortDate, compactUsd, signedPct } from '@/lib/format'
import { amountOwed, debtAccounts } from '@/lib/account-types'
import type { DashboardStats, Account, SubscriptionsResponse, Budget, Goal, Insights, Investments, RewardsOverview, Child } from '@/lib/types'
import { colors, kidColor } from '@/lib/colors'
import { PendingBadge } from '@/components/transactions/PendingBadge'

interface AlertItem {
    id: string
    type: 'OVERSPEND' | 'LOW_BALANCE'
    message: string
    severity: 'warning' | 'destructive'
}

type SectionId = 'overview' | 'spending' | 'debt' | 'investments' | 'rewards' | 'bills' | 'goals' | 'family' | 'activity'

const SECTION_LABELS: Record<SectionId, string> = {
    overview: 'Overview',
    spending: 'Spending',
    debt: 'Debt',
    investments: 'Investments',
    rewards: 'Rewards',
    bills: 'Bills',
    goals: 'Goals',
    family: 'Family',
    activity: 'Activity',
}

/** "$1,275" — whole dollars, so budget spent vs. total stays comparable. */
function wholeUsd(n: number) {
    return `$${Math.round(n).toLocaleString('en-US')}`
}

function toMonthKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMonth(d: Date) {
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function DashboardScreen() {
    const router = useRouter()
    const { user } = useAuthStore()
    const month = toMonthKey(new Date())

    const queryClient = useQueryClient()
    const [refreshing, setRefreshing] = useState(false)
    // Pull-to-refresh reloads every card on Home, not just the dashboard numbers.
    const refreshAll = async () => {
        setRefreshing(true)
        await queryClient.refetchQueries({ type: 'active' })
        setRefreshing(false)
    }

    const { data } = useQuery<DashboardStats>({
        queryKey: ['dashboard'],
        queryFn: async () => (await apiClient.get('/dashboard')).data.data,
        retry: 1,
    })

    const { data: alerts = [] } = useQuery<AlertItem[]>({
        queryKey: ['alerts'],
        queryFn: async () => {
            const res = await apiClient.get('/alerts')
            return res.data.data ?? []
        },
        retry: 0,
    })

    const { data: accounts } = useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: async () => (await apiClient.get('/accounts')).data.data,
        staleTime: 2 * 60 * 1000,
    })

    const { data: subs } = useQuery<SubscriptionsResponse>({
        queryKey: ['subscriptions'],
        queryFn: async () => (await apiClient.get('/subscriptions')).data.data,
        staleTime: 5 * 60 * 1000,
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

    const { data: insights } = useQuery<Insights>({
        queryKey: ['insights', month],
        queryFn: async () => (await apiClient.get('/insights', { params: { month } })).data.data,
        staleTime: 5 * 60 * 1000,
    })

    const { data: investments } = useQuery<Investments>({
        queryKey: ['investments'],
        queryFn: async () => (await apiClient.get('/investments')).data.data,
        staleTime: 5 * 60 * 1000,
    })

    const { data: rewards } = useQuery<RewardsOverview>({
        queryKey: ['rewards'],
        queryFn: async () => (await apiClient.get('/rewards')).data.data,
        staleTime: 5 * 60 * 1000,
        retry: 0,
    })

    const { data: kids } = useQuery<Child[]>({
        queryKey: ['family'],
        queryFn: async () => (await apiClient.get('/family/children')).data.data,
        staleTime: 60 * 1000,
        retry: 0,
    })

    // Section chips: tap to scroll to a section; the active chip follows the scroll.
    const scrollRef = useRef<ScrollView>(null)
    const contentTop = useRef(0)
    const chipsHeight = useRef(0)
    const contentRef = useRef<View>(null)
    const sectionRefs = useRef<Partial<Record<SectionId, View | null>>>({})
    const sectionY = useRef<Partial<Record<SectionId, number>>>({})
    const [activeSection, setActiveSection] = useState<SectionId>('overview')

    // Keep the highlighted chip in view: with many sections the row scrolls sideways, so
    // slide it to center the active chip whenever the active section changes.
    const chipRowRef = useRef<ScrollView>(null)
    const chipRowWidth = useRef(0)
    const chipLayouts = useRef<Partial<Record<SectionId, { x: number; width: number }>>>({})
    useEffect(() => {
        const chip = chipLayouts.current[activeSection]
        if (!chip || !chipRowWidth.current) return
        chipRowRef.current?.scrollTo({ x: Math.max(0, chip.x - (chipRowWidth.current - chip.width) / 2), animated: true })
    }, [activeSection])

    const trackSection = (id: SectionId) => (el: View | null) => {
        sectionRefs.current[id] = el
    }

    // Section offsets are measured, not taken from onLayout: a section moves whenever a
    // card above it loads, and onLayout isn't guaranteed to fire for a move (only a resize).
    const measureSections = (then?: () => void) => {
        const content = contentRef.current
        const entries = Object.entries(sectionRefs.current).filter(([, el]) => el) as [SectionId, View][]
        if (!content || entries.length === 0) return then?.()
        let pending = entries.length
        for (const [id, el] of entries) {
            el.measureLayout(
                content,
                (_x, y) => { sectionY.current[id] = y; if (--pending === 0) then?.() },
                () => { if (--pending === 0) then?.() },
            )
        }
    }

    // A tapped chip stays highlighted while its scroll animates, and at the bottom of the
    // page (where the last sections can't reach the top) until the user scrolls away.
    const tapped = useRef<{ id: SectionId; until: number } | null>(null)
    const lastMeasure = useRef(0)

    const scrollToSection = (id: SectionId) => {
        haptics.light()
        setActiveSection(id)
        tapped.current = { id, until: Date.now() + 800 }
        measureSections(() => {
            const y = sectionY.current[id]
            if (y === undefined) return
            scrollRef.current?.scrollTo({ y: Math.max(0, contentTop.current + y - chipsHeight.current - 8), animated: true })
        })
    }

    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent
        const atBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 8
        const tap = tapped.current
        if (tap && (Date.now() < tap.until || atBottom)) return
        tapped.current = null

        // Sections load in late (bills, rewards, family) and shift everything below them, so
        // re-measure while scrolling rather than trusting the layout from first render.
        if (Date.now() - lastMeasure.current > 400) {
            lastMeasure.current = Date.now()
            measureSections()
        }

        const maxOffset = Math.max(0, contentSize.height - layoutMeasurement.height)
        const targetOf = (id: SectionId) => {
            const y = sectionY.current[id]
            return y === undefined ? undefined : contentTop.current + y - chipsHeight.current - 8
        }
        // Sections near the bottom can't be scrolled to the top of the screen (the page runs
        // out first), so a plain "which one is under the top edge" test skips right past them.
        // Starting at the last section that can reach the top, spread the remaining scroll
        // distance evenly across it and the sections that can't.
        const firstStuck = visibleSections.findIndex((id) => {
            const t = targetOf(id)
            return t !== undefined && t > maxOffset - 24
        })

        let current: SectionId = 'overview'
        const probe = contentOffset.y + chipsHeight.current + 24
        for (const id of visibleSections) {
            const y = sectionY.current[id]
            if (y !== undefined && contentTop.current + y <= probe) current = id
        }
        if (firstStuck !== -1) {
            const group = visibleSections.slice(Math.max(firstStuck - 1, 0))
            const start = targetOf(group[0]) ?? maxOffset
            if (contentOffset.y > start && maxOffset > start) {
                const t = Math.min(1, (contentOffset.y - start) / (maxOffset - start))
                current = group[Math.min(group.length - 1, Math.floor(t * group.length))]
            } else if (atBottom) {
                current = group[group.length - 1]
            }
        } else if (atBottom) {
            current = visibleSections[visibleSections.length - 1]
        }
        if (current !== activeSection) setActiveSection(current)
    }

    const firstName = user?.name?.split(' ')[0] ?? 'there'
    const isFirstRun = accounts !== undefined && accounts.length === 0

    const upcomingBills = [...(subs?.items ?? [])]
        .sort((a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime())
        .slice(0, 3)

    // Every row the Budgets tab shows, including the partner's own categories, but only those
    // with a budget above $0 (no budget = no limit). The limit is the total available
    // (budget + rollover + refunds + goal rewards = remaining + spent), like the web dashboard.
    const ownBudgets = (budgets ?? []).filter(b => b.amount > 0)
    const totalBudgeted = ownBudgets.reduce((s, b) => s + b.remaining + b.spent, 0)
    const totalSpent = ownBudgets.reduce((s, b) => s + b.spent, 0)
    const budgetPct = totalBudgeted > 0 ? Math.min((totalSpent / totalBudgeted) * 100, 100) : 0
    // Same test as the web dashboard banner and Budgets page: Remaining (which counts
    // rollover) below zero. A category with no budget (or $0) has no limit, so it never counts.
    const overBudgetCount = ownBudgets.filter((b) => b.remaining < 0).length

    const topGoals = (goals ?? []).slice(0, 2)

    // Spending by category (same slices as the Insights screen, top 4 + other).
    const breakdown = insights?.categoryBreakdown?.filter((c) => c.value > 0) ?? []
    const topCats = breakdown.slice(0, 4)
    const otherSpend = breakdown.slice(4).reduce((s, c) => s + c.value, 0)
    const spendSlices = [
        ...topCats.map((c, i) => ({ label: c.name, value: c.value, color: colorForIndex(i) })),
        ...(otherSpend > 0 ? [{ label: 'Other', value: otherSpend, color: '#3F3F50' }] : []),
    ]
    const savingsRate = insights?.trend?.length ? insights.trend[insights.trend.length - 1] : null

    const hasInvestments = !!investments?.hasInvestments
    const debts = debtAccounts(accounts ?? []).sort((a, b) => amountOwed(b) - amountOwed(a))
    const totalOwed = debts.reduce((s, a) => s + amountOwed(a), 0)
    const hasRewards = (rewards?.wallet.length ?? 0) > 0
    const rewardsMissed = rewards ? Math.max(0, rewards.optimalRewards - rewards.currentRewards) : 0
    const topRewardCards = [...(rewards?.wallet ?? [])].sort((a, b) => b.annualRewards - a.annualRewards).slice(0, 3)
    const hasKids = (kids?.length ?? 0) > 0
    const kidsTotal = (kids ?? []).reduce((s, k) => s + k.balance, 0)
    const visibleSections: SectionId[] = [
        'overview',
        ...(!isFirstRun ? ['spending' as const] : []),
        ...(debts.length > 0 ? ['debt' as const] : []),
        ...(hasInvestments ? ['investments' as const] : []),
        ...(hasRewards ? ['rewards' as const] : []),
        ...(upcomingBills.length > 0 ? ['bills' as const] : []),
        ...(topGoals.length > 0 ? ['goals' as const] : []),
        ...(hasKids ? ['family' as const] : []),
        'activity',
    ]

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            <ScrollView
                ref={scrollRef}
                className="flex-1"
                showsVerticalScrollIndicator={false}
                stickyHeaderIndices={[1]}
                onScroll={onScroll}
                scrollEventThrottle={32}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={refreshAll}
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
                            onPress={() => { haptics.medium(); router.push('/(app)/assistant' as any) }}
                            className="w-10 h-10 rounded-full bg-brand-accent/15 items-center justify-center"
                            activeOpacity={0.7}
                        >
                            <Sparkles size={18} color={colors.accent} strokeWidth={2} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => { haptics.light(); router.push('/(app)/settings' as any) }}
                            className="w-10 h-10 rounded-full bg-brand-surface border border-brand-border items-center justify-center"
                            activeOpacity={0.7}
                        >
                            <Settings size={18} color={colors.muted} strokeWidth={2} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Section chips (sticky) */}
                <View
                    className="bg-brand-bg pb-3"
                    onLayout={(e) => { chipsHeight.current = e.nativeEvent.layout.height }}
                >
                    <ScrollView
                        ref={chipRowRef}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}
                        onLayout={(e) => { chipRowWidth.current = e.nativeEvent.layout.width }}
                    >
                        {visibleSections.map((id) => (
                            <TouchableOpacity
                                key={id}
                                onLayout={(e) => { chipLayouts.current[id] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width } }}
                                onPress={() => scrollToSection(id)}
                                activeOpacity={0.7}
                                className={`px-3.5 h-8 rounded-full items-center justify-center border ${activeSection === id ? 'bg-brand-accent border-brand-accent' : 'bg-brand-surface border-brand-border'}`}
                            >
                                <Text className={`text-xs font-semibold ${activeSection === id ? 'text-white' : 'text-brand-muted'}`}>{SECTION_LABELS[id]}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                <View
                    ref={contentRef}
                    className="px-6 gap-y-4 pb-8"
                    onLayout={(e) => { contentTop.current = e.nativeEvent.layout.y; measureSections() }}
                >
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

                    <View ref={trackSection('overview')} className="gap-y-4">
                        {/* First-run hero */}
                        {isFirstRun && (
                            <Card className="items-center py-8 gap-y-3">
                                <View className="w-14 h-14 rounded-2xl bg-brand-accent/15 items-center justify-center mb-1">
                                    <PlusCircle size={26} color={colors.accent} strokeWidth={1.5} />
                                </View>
                                <Text className="text-brand-text text-base font-semibold">Connect your accounts</Text>
                                <Text className="text-brand-muted text-sm text-center leading-relaxed px-4">
                                    Link a bank or add an account manually to start tracking your finances.
                                </Text>
                                <TouchableOpacity
                                    className="mt-2 px-6 h-10 rounded-xl bg-brand-accent items-center justify-center"
                                    onPress={() => { haptics.light(); router.push('/(app)/accounts' as any) }}
                                    activeOpacity={0.8}
                                >
                                    <Text className="text-white font-semibold text-sm">Add Account</Text>
                                </TouchableOpacity>
                            </Card>
                        )}

                        {/* Net Worth Card */}
                        {!isFirstRun && (
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => { haptics.light(); router.push('/(app)/accounts' as any) }}
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
                                        <NetWorthSkeleton />
                                    )}
                                </Card>
                            </TouchableOpacity>
                        )}

                        {/* This month */}
                        <Card className="p-5">
                            <Text className="text-brand-muted text-xs font-medium uppercase tracking-widest mb-3">This Month</Text>
                            <View className="flex-row">
                                <View className="flex-1">
                                    <View className="flex-row items-center gap-x-1.5 mb-1">
                                        <TrendingUp size={13} color={colors.positive} strokeWidth={2} />
                                        <Text className="text-brand-muted text-xs">Income</Text>
                                    </View>
                                    {data
                                        ? <AmountText amount={data.monthlyIncome} size="md" neutral className="text-brand-positive" />
                                        : <SkeletonLine width="w-20" />
                                    }
                                </View>
                                <View className="flex-1">
                                    <View className="flex-row items-center gap-x-1.5 mb-1">
                                        <TrendingDown size={13} color={colors.negative} strokeWidth={2} />
                                        <Text className="text-brand-muted text-xs">Spending</Text>
                                    </View>
                                    {data
                                        ? <AmountText amount={-data.monthlyExpenses} size="md" />
                                        : <SkeletonLine width="w-20" />
                                    }
                                </View>
                            </View>
                            {savingsRate && savingsRate.income > 0 && (
                                <Text className="text-brand-muted text-xs mt-3">
                                    You're saving{' '}
                                    <Text className={`font-semibold ${savingsRate.savingsRate >= 20 ? 'text-brand-positive' : savingsRate.savingsRate >= 0 ? 'text-brand-text' : 'text-brand-negative'}`}>
                                        {savingsRate.savingsRate.toFixed(0)}%
                                    </Text>{' '}
                                    of your income
                                </Text>
                            )}
                        </Card>
                    </View>

                    {!isFirstRun && (
                        <View ref={trackSection('spending')} className="gap-y-4">
                            <Card className="p-5">
                                <View className="flex-row items-center justify-between mb-4">
                                    <Text className="text-brand-muted text-xs font-medium uppercase tracking-widest">Spending</Text>
                                    <TouchableOpacity onPress={() => { haptics.light(); router.push('/(app)/insights' as any) }} hitSlop={8} className="flex-row items-center">
                                        <Text className="text-brand-accent text-xs font-semibold">More insights</Text>
                                        <ChevronRight size={14} color={colors.accent} strokeWidth={2} />
                                    </TouchableOpacity>
                                </View>
                                {spendSlices.length > 0 ? (
                                    <View className="flex-row items-center gap-x-5">
                                        <DonutChart data={spendSlices} size={112} strokeWidth={14}>
                                            <Text className="text-brand-text text-sm font-bold">{compactUsd(insights?.expenses ?? 0)}</Text>
                                        </DonutChart>
                                        <View className="flex-1 gap-y-2">
                                            {spendSlices.map((sl) => (
                                                <View key={sl.label} className="flex-row items-center">
                                                    <View className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: sl.color }} />
                                                    <Text className="text-brand-text text-sm flex-1" numberOfLines={1}>{sl.label}</Text>
                                                    <Text className="text-brand-muted text-xs">{compactUsd(sl.value)}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                ) : insights ? (
                                    <Text className="text-brand-muted text-sm text-center py-2">No spending recorded this month.</Text>
                                ) : (
                                    <View className="h-28 bg-brand-elevated/50 rounded-xl" />
                                )}

                                {/* Budget progress */}
                                {budgets !== undefined && totalBudgeted > 0 && (
                                    <TouchableOpacity activeOpacity={0.7} onPress={() => { haptics.light(); router.push('/budgets') }} className="mt-5 pt-4 border-t border-brand-border gap-y-2">
                                        <View className="flex-row items-center justify-between">
                                            <Text className="text-brand-muted text-xs">
                                                Budget · <Text className="text-brand-text">{wholeUsd(totalSpent)}</Text> of {wholeUsd(totalBudgeted)}
                                            </Text>
                                            <ChevronRight size={14} color={colors.muted} strokeWidth={2} />
                                        </View>
                                        <View className="h-2 rounded-full bg-brand-elevated overflow-hidden">
                                            <View
                                                className={`h-full rounded-full ${overBudgetCount > 0 ? 'bg-brand-negative' : 'bg-brand-accent'}`}
                                                style={{ width: `${budgetPct}%` }}
                                            />
                                        </View>
                                        {overBudgetCount > 0 && (
                                            <Text className="text-brand-negative text-xs">
                                                {overBudgetCount} {overBudgetCount === 1 ? 'category' : 'categories'} over budget
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                )}
                            </Card>
                        </View>
                    )}

                    {debts.length > 0 && (
                        <View ref={trackSection('debt')} className="gap-y-4">
                            <TouchableOpacity activeOpacity={0.85} onPress={() => { haptics.light(); router.push('/(app)/debts' as any) }}>
                                <Card className="p-5">
                                    <View className="flex-row items-center justify-between mb-3">
                                        <Text className="text-brand-muted text-xs font-medium uppercase tracking-widest">Debt</Text>
                                        <ChevronRight size={16} color={colors.muted} strokeWidth={2} />
                                    </View>
                                    <Text className="text-2xl font-bold" style={{ color: colors.negative }}>{wholeUsd(totalOwed)}</Text>
                                    <Text className="text-brand-muted text-xs mt-0.5">
                                        owed across {debts.length} account{debts.length === 1 ? '' : 's'}
                                    </Text>
                                    <View className="mt-4 gap-y-2.5">
                                        {debts.slice(0, 3).map((a) => (
                                            <View key={a.id} className="flex-row items-center justify-between">
                                                <Text className="text-brand-text text-sm flex-1 mr-3" numberOfLines={1}>{a.name}</Text>
                                                <Text className="text-brand-muted text-sm font-mono">{wholeUsd(amountOwed(a))}</Text>
                                            </View>
                                        ))}
                                        {debts.length > 3 && (
                                            <Text className="text-brand-muted text-xs">+{debts.length - 3} more</Text>
                                        )}
                                    </View>
                                </Card>
                            </TouchableOpacity>
                        </View>
                    )}

                    {hasInvestments && (
                        <View ref={trackSection('investments')} className="gap-y-4">
                            <TouchableOpacity activeOpacity={0.85} onPress={() => { haptics.light(); router.push('/(app)/investments' as any) }}>
                                <Card className="p-5">
                                    <View className="flex-row items-center justify-between mb-3">
                                        <Text className="text-brand-muted text-xs font-medium uppercase tracking-widest">Investments</Text>
                                        <ChevronRight size={16} color={colors.muted} strokeWidth={2} />
                                    </View>
                                    {investments && (
                                        <>
                                            <AmountText amount={investments.totalValue} size="lg" neutral />
                                            <View className="flex-row flex-wrap gap-x-4 gap-y-1 mt-1">
                                                {investments.change30d && (
                                                    <Text className={`text-xs font-medium ${investments.change30d.amount >= 0 ? 'text-brand-positive' : 'text-brand-negative'}`}>
                                                        {investments.change30d.amount >= 0 ? '▲' : '▼'} {signedPct(investments.change30d.pct)} · 30 days
                                                    </Text>
                                                )}
                                                {investments.gain !== null && (
                                                    <Text className="text-brand-muted text-xs">
                                                        Total gain{' '}
                                                        <Text className={investments.gain >= 0 ? 'text-brand-positive' : 'text-brand-negative'}>
                                                            {investments.gain >= 0 ? '+' : '−'}{compactUsd(Math.abs(investments.gain))}
                                                        </Text>
                                                    </Text>
                                                )}
                                            </View>
                                            {investments.history.length >= 2 && (
                                                <View className="mt-3 -mb-1">
                                                    <LineChart points={investments.history.map((p) => p.value)} height={40} sparkline />
                                                </View>
                                            )}
                                            {investments.allocation.length > 0 && (
                                                <View className="mt-4 gap-y-2">
                                                    <View className="flex-row h-2 rounded-full overflow-hidden bg-brand-elevated">
                                                        {investments.allocation.map((a, i) => (
                                                            <View key={a.type} style={{ width: `${a.pct}%`, backgroundColor: colorForIndex(i) }} />
                                                        ))}
                                                    </View>
                                                    <View className="flex-row flex-wrap gap-x-3 gap-y-1">
                                                        {investments.allocation.slice(0, 3).map((a, i) => (
                                                            <View key={a.type} className="flex-row items-center gap-x-1">
                                                                <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colorForIndex(i) }} />
                                                                <Text className="text-brand-muted text-xs">{a.label} {a.pct.toFixed(0)}%</Text>
                                                            </View>
                                                        ))}
                                                    </View>
                                                </View>
                                            )}
                                            {investments.holdings.length > 0 && (
                                                <View className="mt-4 pt-3 border-t border-brand-border gap-y-2">
                                                    {investments.holdings.slice(0, 3).map((h, i) => (
                                                        <View key={`${h.ticker ?? h.name}-${i}`} className="flex-row items-center">
                                                            <Text className="text-brand-text text-sm flex-1 pr-3" numberOfLines={1}>{h.ticker ?? h.name}</Text>
                                                            <Text className="text-brand-muted text-xs mr-3">{h.weight.toFixed(0)}%</Text>
                                                            <AmountText amount={h.value} size="sm" neutral />
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                        </>
                                    )}
                                </Card>
                            </TouchableOpacity>
                        </View>
                    )}

                    {hasRewards && rewards && (
                        <View ref={trackSection('rewards')} className="gap-y-4">
                            <TouchableOpacity activeOpacity={0.85} onPress={() => { haptics.light(); router.push('/(app)/rewards' as any) }}>
                                <Card className="p-5">
                                    <View className="flex-row items-center justify-between mb-3">
                                        <Text className="text-brand-muted text-xs font-medium uppercase tracking-widest">Rewards</Text>
                                        <ChevronRight size={16} color={colors.muted} strokeWidth={2} />
                                    </View>
                                    {rewards.enoughData ? (
                                        <>
                                            <Text className="text-brand-text text-2xl font-bold">
                                                {wholeUsd(rewards.currentRewards)}
                                                <Text className="text-brand-muted text-sm font-normal"> / year earned</Text>
                                            </Text>
                                            {rewardsMissed >= 5 && (
                                                <Text className="text-xs font-medium mt-1" style={{ color: colors.positive }}>
                                                    Up to {wholeUsd(rewardsMissed)} more with the best card for each purchase
                                                </Text>
                                            )}
                                        </>
                                    ) : (
                                        <Text className="text-brand-muted text-sm">
                                            Tap to see which card to use for each purchase. Estimates appear after a few months of history.
                                        </Text>
                                    )}
                                    <View className="mt-4 gap-y-2.5">
                                        {topRewardCards.map((w) => (
                                            <View key={w.accountId} className="flex-row items-center justify-between">
                                                <Text className="text-brand-text text-sm flex-1 mr-3" numberOfLines={1}>
                                                    {w.card?.name ?? w.accountName}
                                                </Text>
                                                {rewards.enoughData && (
                                                    <Text className="text-brand-muted text-sm font-mono">{wholeUsd(w.annualRewards)}/yr</Text>
                                                )}
                                            </View>
                                        ))}
                                        {rewards.wallet.length > 3 && (
                                            <Text className="text-brand-muted text-xs">+{rewards.wallet.length - 3} more</Text>
                                        )}
                                    </View>
                                </Card>
                            </TouchableOpacity>
                        </View>
                    )}

                    {upcomingBills.length > 0 && (
                        <View ref={trackSection('bills')} className="gap-y-4">
                            <TouchableOpacity activeOpacity={0.85} onPress={() => { haptics.light(); router.push('/(app)/subscriptions' as any) }}>
                                <Card className="gap-y-0 p-0 overflow-hidden">
                                    <View className="px-4 py-3 border-b border-brand-border">
                                        <Text className="text-brand-muted text-xs font-medium uppercase tracking-widest">Upcoming Bills</Text>
                                </View>
                                {upcomingBills.map((bill, i) => (
                                    <View
                                        key={`${bill.merchantName}-${bill.nextDate}`}
                                        className={`flex-row items-center px-4 py-3 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                                    >
                                        <View className="flex-1 pr-3">
                                            <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>{bill.merchantName}</Text>
                                            <Text className="text-brand-muted text-xs mt-0.5">{formatShortDate(bill.nextDate)}</Text>
                                        </View>
                                        <AmountText amount={-bill.amount} size="sm" showSign />
                                    </View>
                                ))}
                            </Card>
                        </TouchableOpacity>
                        </View>
                    )}

                    {topGoals.length > 0 && (
                        <View ref={trackSection('goals')} className="gap-y-4">
                            <TouchableOpacity activeOpacity={0.85} onPress={() => { haptics.light(); router.push('/goals') }}>
                                <Card className="gap-y-3">
                                    <View className="flex-row items-center justify-between">
                                        <Text className="text-brand-muted text-xs font-medium uppercase tracking-widest">Goals</Text>
                                        <ChevronRight size={16} color={colors.muted} strokeWidth={2} />
                                </View>
                                {topGoals.map((goal, i) => {
                                    const pct = goal.targetAmount > 0
                                        ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
                                        : 0
                                    return (
                                        <View key={goal.id} className={`gap-y-1.5 ${i > 0 ? 'pt-3 border-t border-brand-border' : ''}`}>
                                            <View className="flex-row items-center justify-between">
                                                <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>{goal.name}</Text>
                                                <Text className="text-brand-muted text-xs">{Math.round(pct)}%</Text>
                                            </View>
                                            <View className="h-1.5 rounded-full bg-brand-elevated overflow-hidden">
                                                <View className="h-full rounded-full bg-brand-accent" style={{ width: `${pct}%` }} />
                                            </View>
                                        </View>
                                    )
                                })}
                            </Card>
                        </TouchableOpacity>
                        </View>
                    )}

                    {hasKids && kids && (
                        <View ref={trackSection('family')} className="gap-y-4">
                            <TouchableOpacity activeOpacity={0.85} onPress={() => { haptics.light(); router.push('/(app)/family' as any) }}>
                                <Card className="p-5">
                                    <View className="flex-row items-center justify-between mb-3">
                                        <Text className="text-brand-muted text-xs font-medium uppercase tracking-widest">Family</Text>
                                        <ChevronRight size={16} color={colors.muted} strokeWidth={2} />
                                    </View>
                                    <Text className="text-brand-text text-2xl font-bold">{`$${kidsTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</Text>
                                    <Text className="text-brand-muted text-xs mt-0.5">
                                        in {kids.length} kid wallet{kids.length === 1 ? '' : 's'}
                                    </Text>
                                    <View className="mt-4 gap-y-2.5">
                                        {kids.slice(0, 4).map((k) => (
                                            <View key={k.id} className="flex-row items-center justify-between">
                                                <View className="flex-row items-center gap-x-2 flex-1 mr-3">
                                                    <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: kidColor(k.color) }} />
                                                    <Text className="text-brand-text text-sm" numberOfLines={1}>{k.name}</Text>
                                                </View>
                                                <Text className="text-brand-muted text-sm font-mono">
                                                    {`$${k.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                                </Text>
                                            </View>
                                        ))}
                                        {kids.length > 4 && (
                                            <Text className="text-brand-muted text-xs">+{kids.length - 4} more</Text>
                                        )}
                                    </View>
                                </Card>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View ref={trackSection('activity')}>
                        <View className="flex-row items-center justify-between mb-3">
                            <Text className="text-brand-text font-semibold text-base">Recent Activity</Text>
                            <TouchableOpacity onPress={() => { haptics.light(); router.push('/transactions') }} hitSlop={8}>
                                <Text className="text-brand-accent text-xs font-semibold">See all</Text>
                            </TouchableOpacity>
                        </View>
                        {data?.recentTransactions?.length ? (
                            <Card className="overflow-hidden p-0">
                                {data.recentTransactions.map((tx, i) => (
                                    <View key={tx.id} className={`flex-row items-center px-4 py-3.5 ${i > 0 ? 'border-t border-brand-border' : ''}`}>
                                        <View className="flex-1 pr-3">
                                            <View className="flex-row items-center gap-x-1.5">
                                                <Text className="text-brand-text text-sm font-medium flex-shrink" numberOfLines={1}>
                                                    {tx.merchantName ?? tx.description}
                                                </Text>
                                                {tx.pending && <PendingBadge />}
                                            </View>
                                            <Text className="text-brand-muted text-xs mt-0.5">
                                                {tx.categoryName ?? 'Uncategorized'} · {formatShortDate(tx.date)}
                                            </Text>
                                        </View>
                                        <AmountText amount={tx.amount} size="sm" showSign />
                                    </View>
                                ))}
                            </Card>
                        ) : (
                            <RecentTransactionsSkeleton />
                        )}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

function SkeletonLine({ width }: { width: string }) {
    return <View className={`h-4 ${width} bg-brand-elevated rounded-md`} />
}

function NetWorthSkeleton() {
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

function RecentTransactionsSkeleton() {
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
