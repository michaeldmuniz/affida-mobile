import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { Card } from '@/components/ui/Card'
import { BudgetEditSheet } from '@/components/budgets/EditSheet'
import type { Budget } from '@/lib/types'

function formatMonth(date: Date) {
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function toMonthKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function BudgetBar({ spent, total }: { spent: number; total: number }) {
    const pct = total > 0 ? Math.min((spent / total) * 100, 100) : 0
    const over = spent > total
    return (
        <View className="h-1.5 bg-brand-elevated rounded-full overflow-hidden mt-3">
            <View
                className={`h-full rounded-full ${over ? 'bg-brand-negative' : 'bg-brand-accent'}`}
                style={{ width: `${pct}%` }}
            />
        </View>
    )
}

export default function BudgetsScreen() {
    const [offset, setOffset] = useState(0)
    const [editing, setEditing] = useState<Budget | null>(null)
    const activeDate = new Date()
    activeDate.setMonth(activeDate.getMonth() + offset)
    const month = toMonthKey(activeDate)

    const { data: budgets, isLoading, refetch, isRefetching } = useQuery<Budget[]>({
        queryKey: ['budgets', month],
        queryFn: async () => {
            const res = await apiClient.get('/budgets', { params: { month } })
            return res.data.data
        },
        enabled: true,
    })

    const totalBudgeted = budgets?.reduce((s, b) => s + b.amount, 0) ?? 0
    const totalSpent = budgets?.reduce((s, b) => s + b.spent, 0) ?? 0

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            {/* Month Picker */}
            <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
                <TouchableOpacity
                    className="w-8 h-8 items-center justify-center"
                    onPress={() => setOffset((o) => o - 1)}
                    hitSlop={8}
                >
                    <ChevronLeft size={20} color="#6B7280" strokeWidth={2} />
                </TouchableOpacity>
                <Text className="text-brand-text font-semibold text-base">
                    {formatMonth(activeDate)}
                </Text>
                <TouchableOpacity
                    className="w-8 h-8 items-center justify-center"
                    onPress={() => setOffset((o) => o + 1)}
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
                <View className="px-6 gap-y-4 pb-8 pt-4">
                    {/* Summary */}
                    <Card className="flex-row justify-between p-5">
                        <View>
                            <Text className="text-brand-muted text-xs uppercase tracking-widest mb-1">Spent</Text>
                            <Text className="text-brand-text text-xl font-bold">
                                ${totalSpent.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </Text>
                        </View>
                        <View className="items-end">
                            <Text className="text-brand-muted text-xs uppercase tracking-widest mb-1">Budgeted</Text>
                            <Text className="text-brand-muted text-xl font-semibold">
                                ${totalBudgeted.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </Text>
                        </View>
                    </Card>

                    {/* Budget rows */}
                    {isLoading ? (
                        <View className="gap-y-2">
                            {[1, 2, 3, 4, 5].map((i) => <BudgetRowSkeleton key={i} />)}
                        </View>
                    ) : budgets?.length ? (
                        <View className="gap-y-2">
                            {budgets.map((b) => (
                                <BudgetRow key={b.id} budget={b} onEdit={() => setEditing(b)} />
                            ))}
                        </View>
                    ) : (
                        <EmptyState />
                    )}
                </View>
            </ScrollView>

            <BudgetEditSheet budget={editing} month={month} onClose={() => setEditing(null)} />
        </SafeAreaView>
    )
}

function BudgetRow({ budget, onEdit }: { budget: Budget; onEdit: () => void }) {
    const over = budget.spent > budget.amount
    const remaining = budget.amount - budget.spent

    return (
        <TouchableOpacity activeOpacity={0.7} onPress={onEdit}>
        <Card className="p-4">
            <View className="flex-row items-center justify-between">
                <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>
                    {budget.categoryName}
                </Text>
                <Text className={`text-sm font-semibold font-mono ${over ? 'text-brand-negative' : 'text-brand-muted'}`}>
                    ${Math.abs(remaining).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    <Text className="text-brand-muted font-normal"> {over ? 'over' : 'left'}</Text>
                </Text>
            </View>
            <BudgetBar spent={budget.spent} total={budget.amount} />
            <View className="flex-row justify-between mt-1.5">
                <Text className="text-brand-muted text-xs">
                    ${budget.spent.toLocaleString('en-US', { minimumFractionDigits: 0 })} spent
                </Text>
                <Text className="text-brand-muted text-xs">
                    of ${budget.amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                </Text>
            </View>
        </Card>
        </TouchableOpacity>
    )
}

function BudgetRowSkeleton() {
    return (
        <Card className="p-4 gap-y-3">
            <View className="flex-row justify-between">
                <View className="h-3.5 w-24 bg-brand-elevated rounded" />
                <View className="h-3.5 w-16 bg-brand-elevated rounded" />
            </View>
            <View className="h-1.5 bg-brand-elevated rounded-full" />
        </Card>
    )
}

function EmptyState() {
    return (
        <View className="items-center py-16">
            <Text className="text-brand-text font-semibold mb-1">No budgets</Text>
            <Text className="text-brand-muted text-sm text-center leading-relaxed px-8">
                Set up budgets on the web app and they'll appear here.
            </Text>
        </View>
    )
}
