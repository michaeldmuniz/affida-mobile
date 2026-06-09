import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft, ChevronRight, Repeat, ChevronRight as Chevron } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { apiClient } from '@/lib/api-client'
import { Card } from '@/components/ui/Card'
import { AmountText } from '@/components/ui/AmountText'
import { DonutChart } from '@/components/charts/DonutChart'
import { TrendBars } from '@/components/charts/TrendBars'
import { LineChart } from '@/components/charts/LineChart'
import { colorForIndex } from '@/components/charts/palette'
import { haptics } from '@/lib/haptics'
import type { Insights, SubscriptionsResponse } from '@/lib/types'

function formatMonth(date: Date) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function toMonthKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function compactUsd(n: number) {
    const abs = Math.abs(n)
    const formatted =
        abs >= 1000
            ? `$${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`
            : `$${abs.toFixed(0)}`
    return n < 0 ? `-${formatted}` : formatted
}

export default function InsightsScreen() {
    const router = useRouter()
    const [offset, setOffset] = useState(0)
    const activeDate = new Date()
    activeDate.setMonth(activeDate.getMonth() + offset)
    const month = toMonthKey(activeDate)

    const { data, isLoading, refetch, isRefetching } = useQuery<Insights>({
        queryKey: ['insights', month],
        queryFn: async () => {
            const res = await apiClient.get('/insights', { params: { month } })
            return res.data.data
        },
    })

    const { data: subs } = useQuery<SubscriptionsResponse>({
        queryKey: ['subscriptions'],
        queryFn: async () => {
            const res = await apiClient.get('/subscriptions')
            return res.data.data
        },
        staleTime: 10 * 60 * 1000,
    })

    const breakdown = data?.categoryBreakdown?.filter((c) => c.value > 0) ?? []
    const topSlices = breakdown.slice(0, 7)
    const otherTotal = breakdown.slice(7).reduce((s, c) => s + c.value, 0)
    const slices = [
        ...topSlices.map((c, i) => ({ label: c.name, value: c.value, color: colorForIndex(i) })),
        ...(otherTotal > 0 ? [{ label: 'Other', value: otherTotal, color: '#3F3F50' }] : []),
    ]

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            {/* Month Picker */}
            <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
                <TouchableOpacity
                    className="w-8 h-8 items-center justify-center"
                    onPress={() => { haptics.light(); setOffset((o) => o - 1) }}
                    hitSlop={8}
                >
                    <ChevronLeft size={20} color="#6B7280" strokeWidth={2} />
                </TouchableOpacity>
                <Text className="text-brand-text font-semibold text-base">
                    {formatMonth(activeDate)}
                </Text>
                <TouchableOpacity
                    className="w-8 h-8 items-center justify-center"
                    onPress={() => { haptics.light(); setOffset((o) => o + 1) }}
                    hitSlop={8}
                    disabled={offset >= 0}
                >
                    <ChevronRight size={20} color={offset >= 0 ? '#2A2A38' : '#6B7280'} strokeWidth={2} />
                </TouchableOpacity>
            </View>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#5B7BF8" />
                }
            >
                <View className="px-6 gap-y-4 pb-10 pt-2">
                    {/* Cashflow summary */}
                    <View className="flex-row gap-x-3">
                        <Card className="flex-1 p-4">
                            <Text className="text-brand-muted text-xs uppercase tracking-widest mb-2">Income</Text>
                            {data ? (
                                <AmountText amount={data.income} size="md" neutral className="text-brand-positive" />
                            ) : (
                                <Skeleton w="w-20" />
                            )}
                        </Card>
                        <Card className="flex-1 p-4">
                            <Text className="text-brand-muted text-xs uppercase tracking-widest mb-2">Spent</Text>
                            {data ? (
                                <AmountText amount={-data.expenses} size="md" />
                            ) : (
                                <Skeleton w="w-20" />
                            )}
                        </Card>
                        <Card className="flex-1 p-4">
                            <Text className="text-brand-muted text-xs uppercase tracking-widest mb-2">Net</Text>
                            {data ? (
                                <AmountText
                                    amount={data.net}
                                    size="md"
                                    neutral
                                    className={data.net >= 0 ? 'text-brand-positive' : 'text-brand-negative'}
                                />
                            ) : (
                                <Skeleton w="w-20" />
                            )}
                        </Card>
                    </View>

                    {/* Spending by category */}
                    <Card className="p-5">
                        <Text className="text-brand-text font-semibold text-base mb-4">Spending by Category</Text>
                        {isLoading ? (
                            <DonutSkeleton />
                        ) : slices.length > 0 ? (
                            <>
                                <View className="items-center mb-5">
                                    <DonutChart data={slices} size={190} strokeWidth={24}>
                                        <Text className="text-brand-muted text-[10px] uppercase tracking-widest">Spent</Text>
                                        <Text className="text-brand-text text-xl font-bold font-mono">
                                            {compactUsd(data?.expenses ?? 0)}
                                        </Text>
                                    </DonutChart>
                                </View>
                                <View className="gap-y-2.5">
                                    {slices.map((s) => {
                                        const pct = data && data.expenses > 0 ? (s.value / data.expenses) * 100 : 0
                                        return (
                                            <View key={s.label} className="flex-row items-center">
                                                <View className="w-2.5 h-2.5 rounded-full mr-3" style={{ backgroundColor: s.color }} />
                                                <Text className="text-brand-text text-sm flex-1" numberOfLines={1}>
                                                    {s.label}
                                                </Text>
                                                <Text className="text-brand-muted text-xs mr-3">{pct.toFixed(0)}%</Text>
                                                <Text className="text-brand-text text-sm font-mono font-medium">
                                                    {compactUsd(s.value)}
                                                </Text>
                                            </View>
                                        )
                                    })}
                                </View>
                            </>
                        ) : (
                            <Text className="text-brand-muted text-sm py-6 text-center">
                                No spending recorded this month.
                            </Text>
                        )}
                    </Card>

                    {/* Recurring subscriptions teaser */}
                    {subs && subs.items.length > 0 && (
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => { haptics.light(); router.push('/subscriptions') }}
                        >
                            <Card className="p-5 flex-row items-center">
                                <View className="w-10 h-10 rounded-xl bg-brand-accent/15 items-center justify-center mr-4">
                                    <Repeat size={18} color="#5B7BF8" strokeWidth={2} />
                                </View>
                                <View className="flex-1">
                                    <Text className="text-brand-text font-semibold text-sm">Recurring</Text>
                                    <Text className="text-brand-muted text-xs mt-0.5">
                                        {subs.items.length} subscription{subs.items.length === 1 ? '' : 's'} detected
                                    </Text>
                                </View>
                                <View className="items-end mr-2">
                                    <AmountText amount={-subs.monthlyTotal} size="sm" />
                                    <Text className="text-brand-muted text-[10px]">per month</Text>
                                </View>
                                <Chevron size={16} color="#6B7280" strokeWidth={2} />
                            </Card>
                        </TouchableOpacity>
                    )}

                    {/* Income vs Spending trend */}
                    <Card className="p-5">
                        <View className="flex-row items-center justify-between mb-1">
                            <Text className="text-brand-text font-semibold text-base">6-Month Trend</Text>
                            <View className="flex-row items-center gap-x-3">
                                <View className="flex-row items-center gap-x-1">
                                    <View className="w-2 h-2 rounded-full bg-brand-positive/80" />
                                    <Text className="text-brand-muted text-[10px]">In</Text>
                                </View>
                                <View className="flex-row items-center gap-x-1">
                                    <View className="w-2 h-2 rounded-full bg-brand-negative/80" />
                                    <Text className="text-brand-muted text-[10px]">Out</Text>
                                </View>
                            </View>
                        </View>
                        {data?.trend?.length ? (
                            <>
                                <SavingsRateLine trend={data.trend} />
                                <View className="mt-4">
                                    <TrendBars data={data.trend} />
                                </View>
                            </>
                        ) : (
                            <ChartSkeleton />
                        )}
                    </Card>

                    {/* Net worth history */}
                    <Card className="p-5">
                        <Text className="text-brand-text font-semibold text-base mb-1">Net Worth</Text>
                        {data?.netWorthHistory && data.netWorthHistory.length >= 2 ? (
                            <>
                                <View className="flex-row items-baseline gap-x-2 mb-3">
                                    <Text className="text-brand-text text-xl font-bold font-mono">
                                        {compactUsd(data.netWorthHistory[data.netWorthHistory.length - 1].netWorth)}
                                    </Text>
                                    <NetWorthDelta history={data.netWorthHistory.map((p) => p.netWorth)} />
                                </View>
                                <LineChart
                                    points={data.netWorthHistory.map((p) => p.netWorth)}
                                    labels={data.netWorthHistory.map((p) => p.month.split(' ')[0])}
                                />
                            </>
                        ) : isLoading ? (
                            <ChartSkeleton />
                        ) : (
                            <Text className="text-brand-muted text-sm py-6 text-center">
                                Connect an account to start tracking net worth over time.
                            </Text>
                        )}
                    </Card>

                    {/* Top merchants */}
                    <Card className="p-5">
                        <Text className="text-brand-text font-semibold text-base mb-4">Top Merchants</Text>
                        {data?.topMerchants?.length ? (
                            <View className="gap-y-3">
                                {data.topMerchants.slice(0, 8).map((m, i) => {
                                    const max = data.topMerchants[0].amount || 1
                                    return (
                                        <View key={m.name}>
                                            <View className="flex-row items-center justify-between mb-1.5">
                                                <Text className="text-brand-text text-sm flex-1 pr-3" numberOfLines={1}>
                                                    {m.name}
                                                </Text>
                                                <Text className="text-brand-text text-sm font-mono font-medium">
                                                    {compactUsd(m.amount)}
                                                </Text>
                                            </View>
                                            <View className="h-1.5 bg-brand-elevated rounded-full overflow-hidden">
                                                <View
                                                    className="h-full rounded-full"
                                                    style={{
                                                        width: `${Math.max(2, (m.amount / max) * 100)}%`,
                                                        backgroundColor: colorForIndex(i),
                                                    }}
                                                />
                                            </View>
                                        </View>
                                    )
                                })}
                            </View>
                        ) : isLoading ? (
                            <View className="gap-y-3">
                                {[1, 2, 3, 4].map((i) => (
                                    <Skeleton key={i} w="w-full" />
                                ))}
                            </View>
                        ) : (
                            <Text className="text-brand-muted text-sm py-4 text-center">
                                No merchant spending this month.
                            </Text>
                        )}
                    </Card>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

function SavingsRateLine({ trend }: { trend: Array<{ month: string; income: number; savingsRate: number }> }) {
    const current = trend[trend.length - 1]
    if (!current || current.income <= 0) return null
    const rate = current.savingsRate
    const color = rate >= 20 ? 'text-brand-positive' : rate >= 0 ? 'text-brand-text' : 'text-brand-negative'
    return (
        <Text className="text-brand-muted text-xs mt-1">
            You're saving <Text className={`font-semibold ${color}`}>{rate.toFixed(0)}%</Text> of your income this month
        </Text>
    )
}

function NetWorthDelta({ history }: { history: number[] }) {
    const first = history[0]
    const last = history[history.length - 1]
    const delta = last - first
    if (Math.abs(delta) < 1) return null
    const up = delta > 0
    return (
        <Text className={`text-xs font-medium ${up ? 'text-brand-positive' : 'text-brand-negative'}`}>
            {up ? '▲' : '▼'} {compactUsd(Math.abs(delta))} over 6 mo
        </Text>
    )
}

function Skeleton({ w }: { w: string }) {
    return <View className={`h-4 ${w} bg-brand-elevated rounded-md`} />
}

function DonutSkeleton() {
    return (
        <View className="items-center py-6">
            <View className="w-44 h-44 rounded-full border-[24px] border-brand-elevated" />
        </View>
    )
}

function ChartSkeleton() {
    return <View className="h-32 bg-brand-elevated/50 rounded-xl mt-4" />
}
