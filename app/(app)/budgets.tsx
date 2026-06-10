import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft, ChevronRight, Plus, Copy } from 'lucide-react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { Card } from '@/components/ui/Card'
import { BudgetEditSheet } from '@/components/budgets/EditSheet'
import { AddBudgetSheet } from '@/components/budgets/AddSheet'
import type { Budget } from '@/lib/types'

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
    const queryClient = useQueryClient()
    const [offset, setOffset] = useState(0)
    const [editing, setEditing] = useState<Budget | null>(null)
    const [showAdd, setShowAdd] = useState(false)
    const activeDate = new Date()
    activeDate.setMonth(activeDate.getMonth() + offset)
    const month = toMonthKey(activeDate)

    const { mutate: copyPrevMonth, isPending: isCopying } = useMutation({
        mutationFn: async () => {
            const res = await apiClient.post('/budgets/copy', { targetMonth: month })
            return res.data.data
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['budgets', month] })
            if (data?.copied === 0) {
                Alert.alert('Nothing to Copy', 'No budgets found in the previous month.')
            }
        },
        onError: () => Alert.alert('Error', 'Failed to copy budgets.'),
    })

    const handleCopy = () => {
        Alert.alert(
            'Copy Previous Month',
            'This will copy all budget amounts from last month into this month. Existing budgets will be overwritten.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Copy', onPress: () => copyPrevMonth() },
            ]
        )
    }

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
            {/* Month Picker + actions */}
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
                    className="w-9 h-9 rounded-full bg-brand-accent/15 items-center justify-center"
                    onPress={() => { haptics.medium(); setShowAdd(true) }}
                    hitSlop={6}
                >
                    <Plus size={18} color="#5B7BF8" strokeWidth={2.2} />
                </TouchableOpacity>
            </View>
            {/* Sub-actions */}
            <View className="flex-row gap-x-2 px-6 pb-1">
                <TouchableOpacity
                    className="flex-row items-center gap-x-1.5 bg-brand-surface border border-brand-border rounded-xl px-3 h-8"
                    onPress={() => setShowAdd(true)}
                    activeOpacity={0.7}
                >
                    <Plus size={13} color="#5B7BF8" />
                    <Text className="text-brand-accent text-xs font-medium">Add Budget</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    className="flex-row items-center gap-x-1.5 bg-brand-surface border border-brand-border rounded-xl px-3 h-8"
                    onPress={handleCopy}
                    disabled={isCopying}
                    activeOpacity={0.7}
                >
                    {isCopying
                        ? <ActivityIndicator size="small" color="#6B7280" />
                        : <Copy size={13} color="#6B7280" />
                    }
                    <Text className="text-brand-muted text-xs font-medium">Copy Previous</Text>
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
                                <BudgetRow key={b.id} budget={b} onEdit={() => { haptics.light(); setEditing(b) }} />
                            ))}
                        </View>
                    ) : (
                        <EmptyState onCreate={() => { haptics.medium(); setShowAdd(true) }} />
                    )}
                </View>
            </ScrollView>

            <BudgetEditSheet budget={editing} month={month} onClose={() => setEditing(null)} />
            <AddBudgetSheet visible={showAdd} month={month} existingBudgets={budgets ?? []} onClose={() => setShowAdd(false)} />
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

function EmptyState({ onCreate }: { onCreate: () => void }) {
    return (
        <View className="items-center py-16">
            <Text className="text-brand-text font-semibold mb-1">No budgets this month</Text>
            <Text className="text-brand-muted text-sm text-center leading-relaxed px-8 mb-4">
                Give every category a monthly limit and we'll track your spending against it.
            </Text>
            <TouchableOpacity
                className="bg-brand-accent px-6 py-3 rounded-xl"
                onPress={onCreate}
                activeOpacity={0.85}
            >
                <Text className="text-white font-semibold text-sm">Create a budget</Text>
            </TouchableOpacity>
        </View>
    )
}
