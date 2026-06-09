import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Target, Plus, Link2 } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { apiClient } from '@/lib/api-client'
import { Card } from '@/components/ui/Card'
import { GoalEditSheet } from '@/components/goals/EditSheet'
import { GoalContributeSheet } from '@/components/goals/ContributeSheet'
import { haptics } from '@/lib/haptics'
import type { Goal } from '@/lib/types'

function daysUntil(dateStr: string | null) {
    if (!dateStr) return null
    const diff = new Date(dateStr).getTime() - Date.now()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    if (days < 0) return 'Past due'
    if (days === 0) return 'Due today'
    if (days === 1) return '1 day left'
    if (days > 60) return `${Math.round(days / 30.5)} months left`
    return `${days} days left`
}

function GoalProgressBar({ current, target }: { current: number; target: number }) {
    const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0
    const done = pct >= 100
    return (
        <View className="h-2 bg-brand-elevated rounded-full overflow-hidden mt-3">
            <View
                className={`h-full rounded-full ${done ? 'bg-brand-positive' : 'bg-brand-accent'}`}
                style={{ width: `${pct}%` }}
            />
        </View>
    )
}

export default function GoalsScreen() {
    const [editing, setEditing] = useState<Goal | 'new' | null>(null)
    const [contributing, setContributing] = useState<Goal | null>(null)

    const { data: goals, isLoading, refetch, isRefetching } = useQuery<Goal[]>({
        queryKey: ['goals'],
        queryFn: async () => {
            const res = await apiClient.get('/goals')
            return res.data.data
        },
        enabled: true,
    })

    const totalSaved = goals?.reduce((s, g) => s + g.currentAmount, 0) ?? 0
    const totalTarget = goals?.reduce((s, g) => s + g.targetAmount, 0) ?? 0

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#5B7BF8" />
                }
            >
                {/* Header */}
                <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
                    <Text className="text-brand-text text-2xl font-bold">Goals</Text>
                    <TouchableOpacity
                        onPress={() => { haptics.medium(); setEditing('new') }}
                        hitSlop={8}
                        className="w-9 h-9 rounded-full bg-brand-accent/15 items-center justify-center"
                        activeOpacity={0.7}
                    >
                        <Plus size={20} color="#5B7BF8" strokeWidth={2.2} />
                    </TouchableOpacity>
                </View>

                {goals && goals.length > 0 && totalTarget > 0 && (
                    <View className="px-6 pt-1 pb-2">
                        <Text className="text-brand-muted text-sm">
                            ${totalSaved.toLocaleString('en-US', { maximumFractionDigits: 0 })} saved of $
                            {totalTarget.toLocaleString('en-US', { maximumFractionDigits: 0 })} across all goals
                        </Text>
                    </View>
                )}

                <View className="px-6 gap-y-3 pb-8 pt-4">
                    {isLoading ? (
                        [1, 2, 3].map((i) => <GoalCardSkeleton key={i} />)
                    ) : goals?.length ? (
                        goals.map((goal) => (
                            <GoalCard
                                key={goal.id}
                                goal={goal}
                                onEdit={() => { haptics.light(); setEditing(goal) }}
                                onContribute={() => { haptics.medium(); setContributing(goal) }}
                            />
                        ))
                    ) : (
                        <EmptyState onCreate={() => { haptics.medium(); setEditing('new') }} />
                    )}
                </View>
            </ScrollView>

            {editing && <GoalEditSheet goal={editing} onClose={() => setEditing(null)} />}
            {contributing && (
                <GoalContributeSheet goal={contributing} onClose={() => setContributing(null)} />
            )}
        </SafeAreaView>
    )
}

function GoalCard({
    goal,
    onEdit,
    onContribute,
}: {
    goal: Goal
    onEdit: () => void
    onContribute: () => void
}) {
    const pct = goal.targetAmount > 0
        ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
        : 0
    const deadline = daysUntil(goal.deadline)
    const isLinked = goal.accounts.length > 0
    const lastContribution = goal.contributions?.[0]

    return (
        <TouchableOpacity activeOpacity={0.8} onPress={onEdit}>
            <Card className="p-5">
                <View className="flex-row items-start justify-between mb-1">
                    <View className="flex-1 flex-row items-center pr-3 gap-x-2">
                        <Text className="text-brand-text font-semibold text-base" numberOfLines={1}>
                            {goal.name}
                        </Text>
                        {isLinked && <Link2 size={13} color="#6B7280" strokeWidth={2} />}
                    </View>
                    {deadline && (
                        <View className={`px-2 py-0.5 rounded-full ${
                            deadline === 'Past due'
                                ? 'bg-brand-negative/10'
                                : 'bg-brand-accent/10'
                        }`}>
                            <Text className={`text-xs font-medium ${
                                deadline === 'Past due' ? 'text-brand-negative' : 'text-brand-accent'
                            }`}>
                                {deadline}
                            </Text>
                        </View>
                    )}
                </View>

                <View className="flex-row items-baseline gap-x-1.5 mt-2">
                    <Text className="text-brand-text text-2xl font-bold font-mono">
                        ${goal.currentAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </Text>
                    <Text className="text-brand-muted text-sm">
                        of ${goal.targetAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </Text>
                </View>

                <GoalProgressBar current={goal.currentAmount} target={goal.targetAmount} />

                <View className="flex-row items-center justify-between mt-3">
                    <Text className="text-brand-muted text-xs">
                        {pct.toFixed(0)}% complete
                        {lastContribution
                            ? ` · last added $${lastContribution.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                            : ''}
                    </Text>
                    {!isLinked && (
                        <TouchableOpacity
                            onPress={(e) => { e.stopPropagation(); onContribute() }}
                            className="bg-brand-accent/15 px-3.5 py-1.5 rounded-full"
                            activeOpacity={0.7}
                            hitSlop={6}
                        >
                            <Text className="text-brand-accent text-xs font-semibold">Add money</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </Card>
        </TouchableOpacity>
    )
}

function GoalCardSkeleton() {
    return (
        <Card className="p-5 gap-y-3">
            <View className="h-4 w-32 bg-brand-elevated rounded" />
            <View className="h-7 w-24 bg-brand-elevated rounded" />
            <View className="h-2 bg-brand-elevated rounded-full" />
        </Card>
    )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
    return (
        <View className="items-center py-16">
            <View className="w-14 h-14 rounded-2xl bg-brand-surface border border-brand-border items-center justify-center mb-4">
                <Target size={24} color="#6B7280" strokeWidth={1.5} />
            </View>
            <Text className="text-brand-text font-semibold mb-1">No goals yet</Text>
            <Text className="text-brand-muted text-sm text-center leading-relaxed px-8 mb-4">
                Set a savings target and watch your progress grow with every contribution.
            </Text>
            <TouchableOpacity
                className="bg-brand-accent px-6 py-3 rounded-xl"
                onPress={onCreate}
                activeOpacity={0.85}
            >
                <Text className="text-white font-semibold text-sm">Create your first goal</Text>
            </TouchableOpacity>
        </View>
    )
}
