import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Plus, Target } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Card } from '@/components/ui/Card'
import type { Goal } from '@/lib/types'

function daysUntil(dateStr: string | null) {
    if (!dateStr) return null
    const diff = new Date(dateStr).getTime() - Date.now()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    if (days < 0) return 'Past due'
    if (days === 0) return 'Due today'
    if (days === 1) return '1 day left'
    return `${days} days left`
}

function GoalProgressBar({ current, target }: { current: number; target: number }) {
    const pct = target > 0 ? Math.min((current / target) * 100, 100) : 0
    return (
        <View className="h-2 bg-brand-elevated rounded-full overflow-hidden mt-3">
            <View
                className="h-full bg-brand-accent rounded-full"
                style={{ width: `${pct}%` }}
            />
        </View>
    )
}

export default function GoalsScreen() {
    const { data: goals, isLoading, refetch, isRefetching } = useQuery<Goal[]>({
        queryKey: ['goals'],
        queryFn: async () => {
            const res = await apiClient.get('/goals')
            return res.data.data
        },
        enabled: true,
    })

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
                    <TouchableOpacity className="w-9 h-9 rounded-full bg-brand-surface border border-brand-border items-center justify-center">
                        <Plus size={18} color="#5B7BF8" strokeWidth={2} />
                    </TouchableOpacity>
                </View>

                <View className="px-6 gap-y-3 pb-8 pt-4">
                    {isLoading ? (
                        [1, 2, 3].map((i) => <GoalCardSkeleton key={i} />)
                    ) : goals?.length ? (
                        goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)
                    ) : (
                        <EmptyState />
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

function GoalCard({ goal }: { goal: Goal }) {
    const pct = goal.targetAmount > 0
        ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
        : 0
    const deadline = daysUntil(goal.deadline)

    return (
        <TouchableOpacity activeOpacity={0.8}>
            <Card className="p-5">
                <View className="flex-row items-start justify-between mb-1">
                    <Text className="text-brand-text font-semibold text-base flex-1 pr-3" numberOfLines={1}>
                        {goal.name}
                    </Text>
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
                        ${goal.currentAmount.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                    </Text>
                    <Text className="text-brand-muted text-sm">
                        of ${goal.targetAmount.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                    </Text>
                </View>

                <GoalProgressBar current={goal.currentAmount} target={goal.targetAmount} />

                <Text className="text-brand-muted text-xs mt-2">
                    {pct.toFixed(0)}% complete
                </Text>
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

function EmptyState() {
    return (
        <View className="items-center py-16">
            <View className="w-14 h-14 rounded-2xl bg-brand-surface border border-brand-border items-center justify-center mb-4">
                <Target size={24} color="#6B7280" strokeWidth={1.5} />
            </View>
            <Text className="text-brand-text font-semibold mb-1">No goals yet</Text>
            <Text className="text-brand-muted text-sm text-center leading-relaxed px-8">
                Create savings goals on the web app and track your progress here.
            </Text>
        </View>
    )
}
