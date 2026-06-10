import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft, ChevronRight, BarChart3 } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { apiClient } from '@/lib/api-client'
import { Card } from '@/components/ui/Card'
import { AmountText } from '@/components/ui/AmountText'
import type { Transaction } from '@/lib/types'

interface ReportStats {
    totalIncome: number
    totalExpenses: number
    netFlow: number
    topCategories: { name: string; total: number }[]
    weeklySpend: number[]
}

function computeReportStats(transactions: Transaction[]): ReportStats {
    let totalIncome = 0
    let totalExpenses = 0
    const categoryMap = new Map<string, number>()
    const weeklySpend = [0, 0, 0, 0, 0]

    for (const t of transactions) {
        const amount = t.amount
        const group = t.categoryGroup

        const isIncome = group === 'INCOME' || (!group && amount > 0)
        const isExpense = group === 'EXPENSE' || (!group && amount < 0)

        if (isIncome) {
            totalIncome += amount
        } else if (isExpense) {
            totalExpenses += Math.abs(amount)

            const cat = t.categoryName ?? 'Uncategorized'
            categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + Math.abs(amount))

            const day = new Date(t.date).getDate()
            const weekIndex = Math.min(Math.floor((day - 1) / 7), 4)
            weeklySpend[weekIndex] += Math.abs(amount)
        }
    }

    const topCategories = Array.from(categoryMap.entries())
        .map(([name, total]) => ({ name, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)

    return { totalIncome, totalExpenses, netFlow: totalIncome - totalExpenses, topCategories, weeklySpend }
}

function formatMonth(date: Date) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function monthBounds(date: Date) {
    const y = date.getFullYear()
    const m = date.getMonth()
    return {
        startDate: new Date(y, m, 1).toISOString(),
        endDate: new Date(y, m + 1, 0, 23, 59, 59).toISOString(),
        key: `${y}-${String(m + 1).padStart(2, '0')}`,
    }
}

export default function ReportsScreen() {
    const router = useRouter()
    const [offset, setOffset] = useState(0)

    const activeDate = new Date()
    activeDate.setMonth(activeDate.getMonth() + offset)
    const { startDate, endDate, key } = monthBounds(activeDate)

    const { data, isLoading, refetch, isRefetching } = useQuery<ReportStats>({
        queryKey: ['reports', key],
        queryFn: async () => {
            const res = await apiClient.get('/transactions', {
                params: { startDate, endDate, limit: '500', sort: 'date', order: 'asc' },
            })
            const items: Transaction[] = res.data.data?.items ?? []
            return computeReportStats(items)
        },
    })

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            {/* Header */}
            <View className="flex-row items-center px-4 pt-4 pb-3">
                <TouchableOpacity onPress={() => router.back()} hitSlop={8} className="w-8">
                    <ChevronLeft size={22} color="#6B7280" />
                </TouchableOpacity>
                <Text className="flex-1 text-center text-brand-text text-lg font-bold">Reports</Text>
                <View className="w-8" />
            </View>

            {/* Month Picker */}
            <View className="flex-row items-center justify-between px-6 pb-2">
                <TouchableOpacity
                    className="w-8 h-8 items-center justify-center"
                    onPress={() => setOffset(o => o - 1)}
                    hitSlop={8}
                >
                    <ChevronLeft size={20} color="#6B7280" strokeWidth={2} />
                </TouchableOpacity>
                <Text className="text-brand-text font-semibold text-base">
                    {formatMonth(activeDate)}
                </Text>
                <TouchableOpacity
                    className="w-8 h-8 items-center justify-center"
                    onPress={() => setOffset(o => o + 1)}
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
                <View className="px-6 gap-y-4 pb-8 pt-3">
                    {isLoading ? (
                        <ReportsSkeleton />
                    ) : !data || (data.totalIncome === 0 && data.totalExpenses === 0) ? (
                        <EmptyState />
                    ) : (
                        <>
                            {/* Summary */}
                            <Card className="p-5">
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-4">
                                    Cash Flow
                                </Text>
                                <View className="flex-row justify-between">
                                    <View className="flex-1 items-center">
                                        <Text className="text-brand-muted text-xs mb-1.5">Income</Text>
                                        <AmountText amount={data.totalIncome} size="md" neutral className="text-brand-positive" />
                                    </View>
                                    <View className="w-px bg-brand-border" />
                                    <View className="flex-1 items-center">
                                        <Text className="text-brand-muted text-xs mb-1.5">Expenses</Text>
                                        <AmountText amount={-data.totalExpenses} size="md" />
                                    </View>
                                    <View className="w-px bg-brand-border" />
                                    <View className="flex-1 items-center">
                                        <Text className="text-brand-muted text-xs mb-1.5">Net</Text>
                                        <AmountText
                                            amount={data.netFlow}
                                            size="md"
                                            neutral
                                            className={data.netFlow >= 0 ? 'text-brand-accent' : 'text-amber-400'}
                                        />
                                    </View>
                                </View>
                            </Card>

                            {/* Top Categories */}
                            {data.topCategories.length > 0 && (
                                <View>
                                    <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-3 px-1">
                                        Top Spending
                                    </Text>
                                    <Card className="p-4 gap-y-4">
                                        {data.topCategories.map((cat, i) => (
                                            <CategoryRow
                                                key={cat.name}
                                                name={cat.name}
                                                total={cat.total}
                                                max={data.topCategories[0].total}
                                                rank={i + 1}
                                            />
                                        ))}
                                    </Card>
                                </View>
                            )}

                            {/* Weekly Trend */}
                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-3 px-1">
                                    Weekly Spending
                                </Text>
                                <Card className="p-4">
                                    <WeeklyChart weeks={data.weeklySpend} />
                                </Card>
                            </View>
                        </>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

function CategoryRow({ name, total, max, rank }: { name: string; total: number; max: number; rank: number }) {
    const pct = max > 0 ? (total / max) * 100 : 0
    return (
        <View className="gap-y-1.5">
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-x-2 flex-1 pr-3">
                    <Text className="text-brand-muted text-xs font-bold w-4">#{rank}</Text>
                    <Text className="text-brand-text text-sm font-medium flex-1" numberOfLines={1}>{name}</Text>
                </View>
                <Text className="text-brand-text text-sm font-semibold font-mono">
                    ${total.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </Text>
            </View>
            <View className="h-1.5 bg-brand-elevated rounded-full overflow-hidden ml-6">
                <View
                    className="h-full bg-brand-accent rounded-full"
                    style={{ width: `${pct}%` }}
                />
            </View>
        </View>
    )
}

function WeeklyChart({ weeks }: { weeks: number[] }) {
    const max = Math.max(...weeks, 1)
    const labels = ['W1', 'W2', 'W3', 'W4', 'W5']

    return (
        <View className="gap-y-3">
            {weeks.map((amount, i) => {
                if (i === 4 && amount === 0) return null
                const pct = (amount / max) * 100
                return (
                    <View key={i} className="flex-row items-center gap-x-3">
                        <Text className="text-brand-muted text-xs w-6">{labels[i]}</Text>
                        <View className="flex-1 h-6 bg-brand-elevated rounded-lg overflow-hidden justify-center">
                            <View
                                className="h-full bg-brand-accent/70 rounded-lg"
                                style={{ width: `${Math.max(pct, 2)}%` }}
                            />
                        </View>
                        <Text className="text-brand-muted text-xs font-mono w-16 text-right">
                            ${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </Text>
                    </View>
                )
            })}
        </View>
    )
}

function ReportsSkeleton() {
    return (
        <>
            <Card className="p-5 gap-y-4">
                <View className="h-2.5 w-16 bg-brand-elevated rounded" />
                <View className="flex-row justify-between">
                    {[1, 2, 3].map(i => (
                        <View key={i} className="flex-1 items-center gap-y-2">
                            <View className="h-2.5 w-10 bg-brand-elevated rounded" />
                            <View className="h-4 w-16 bg-brand-elevated rounded" />
                        </View>
                    ))}
                </View>
            </Card>
            <Card className="p-4 gap-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                    <View key={i} className="gap-y-1.5">
                        <View className="flex-row justify-between">
                            <View className="h-3 w-28 bg-brand-elevated rounded" />
                            <View className="h-3 w-14 bg-brand-elevated rounded" />
                        </View>
                        <View className="h-1.5 bg-brand-elevated rounded-full" />
                    </View>
                ))}
            </Card>
            <Card className="p-4 gap-y-3">
                {[1, 2, 3, 4].map(i => (
                    <View key={i} className="flex-row items-center gap-x-3">
                        <View className="h-2.5 w-6 bg-brand-elevated rounded" />
                        <View className="flex-1 h-6 bg-brand-elevated rounded-lg" />
                        <View className="h-2.5 w-14 bg-brand-elevated rounded" />
                    </View>
                ))}
            </Card>
        </>
    )
}

function EmptyState() {
    return (
        <View className="items-center py-16">
            <View className="w-14 h-14 rounded-2xl bg-brand-surface border border-brand-border items-center justify-center mb-4">
                <BarChart3 size={24} color="#6B7280" strokeWidth={1.5} />
            </View>
            <Text className="text-brand-text font-semibold mb-1">No data for this month</Text>
            <Text className="text-brand-muted text-sm text-center leading-relaxed px-8">
                Transactions will appear here once you have activity for this period.
            </Text>
        </View>
    )
}
