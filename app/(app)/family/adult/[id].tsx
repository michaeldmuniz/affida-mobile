import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft } from 'lucide-react-native'
import { apiClient } from '@/lib/api-client'
import type { AdultDetail, ChildTask, TaskKind } from '@/lib/types'
import { colors } from '@/lib/colors'
import { haptics } from '@/lib/haptics'
import { localDay } from '@/lib/format'
import { Card } from '@/components/ui/Card'
import { AmountText } from '@/components/ui/AmountText'
import { KidAvatar } from '@/components/family/KidAvatar'
import { TaskEditSheet } from '@/components/family/TaskEditSheet'
import { TodayTaskRow, TaskSection } from '@/components/family/TaskRows'

function money(n: number) {
    return `$${n.toFixed(2)}`
}

// An adult's own goals and chores. Rewards are logged toward an account they
// pick, as a running total; nothing moves. Both partners can see and check off.
export default function AdultGoalsScreen() {
    const { id } = useLocalSearchParams<{ id: string }>()
    const router = useRouter()
    const queryClient = useQueryClient()
    const [day] = useState(() => localDay())
    const [editingTask, setEditingTask] = useState<ChildTask | TaskKind | null>(null)
    const [togglingId, setTogglingId] = useState<string | null>(null)

    const detailQuery = useQuery<AdultDetail>({
        queryKey: ['family', 'adults', id],
        queryFn: async () => (await apiClient.get(`/family/adults/${id}`)).data.data,
    })
    const tasksQuery = useQuery<ChildTask[]>({
        queryKey: ['family', 'adults', id, 'tasks', day],
        queryFn: async () => (await apiClient.get(`/family/adults/${id}/tasks`, { params: { day } })).data.data,
    })

    const { mutate: toggle } = useMutation({
        mutationFn: async (task: ChildTask) => {
            if (task.doneOnDay) {
                await apiClient.delete(`/family/tasks/${task.id}/complete`, { params: { day } })
                return null
            }
            const result = (await apiClient.post(`/family/tasks/${task.id}/complete`, { day })).data.data as { earned: number; bonus: number; streak: number }
            return { ...result, accountName: task.rewardAccountName }
        },
        onMutate: (task) => setTogglingId(task.id),
        onSuccess: (result) => {
            haptics.success()
            if (result && result.bonus > 0) {
                Alert.alert(`${result.streak} in a row!`, `${money(result.earned + result.bonus)} logged${result.accountName ? ` toward ${result.accountName}` : ''}, including a ${money(result.bonus)} streak bonus.`)
            }
        },
        onError: (e: any) => {
            haptics.error()
            Alert.alert('Error', e?.response?.data?.error ?? 'Something went wrong.')
        },
        onSettled: async () => {
            await queryClient.invalidateQueries({ queryKey: ['family'] })
            setTogglingId(null)
        },
    })

    const refreshing = detailQuery.isRefetching || tasksQuery.isRefetching
    const onRefresh = () => { detailQuery.refetch(); tasksQuery.refetch() }

    const adult = detailQuery.data?.adult
    const totals = detailQuery.data?.totals ?? []
    const history = detailQuery.data?.history ?? []
    const tasks = tasksQuery.data ?? []
    const dueToday = tasks.filter(t => t.dueOnDay)
    const habits = tasks.filter(t => t.kind === 'HABIT')
    const chores = tasks.filter(t => t.kind === 'CHORE')
    const allTime = totals.reduce((s, t) => s + t.total, 0)
    const firstName = adult?.name.split(' ')[0] ?? ''

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            <View className="flex-row items-center px-4 pt-4 pb-3">
                <TouchableOpacity onPress={() => router.back()} hitSlop={8} className="w-8">
                    <ChevronLeft size={22} color={colors.muted} />
                </TouchableOpacity>
                <Text className="flex-1 text-center text-brand-text text-lg font-bold" numberOfLines={1}>
                    {adult ? (adult.isYou ? 'Your goals' : `${firstName}'s goals`) : ''}
                </Text>
                <View className="w-8" />
            </View>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
            >
                <View className="px-6 gap-y-5 pb-10 pt-2">
                    <Card className="p-5 items-center">
                        {adult ? (
                            <>
                                <KidAvatar name={adult.name} color="chart-2" size={52} />
                                <AmountText amount={allTime} size="xl" neutral className="mt-3" />
                                <Text className="text-brand-muted text-xs uppercase tracking-widest mt-1">Rewards logged</Text>
                                {totals.length > 0 && (
                                    <View className="self-stretch mt-4 gap-y-2">
                                        {totals.map(t => (
                                            <View key={t.accountId ?? 'none'} className="flex-row justify-between">
                                                <Text className={`text-sm ${t.accountId ? 'text-brand-text' : 'text-brand-muted'}`} numberOfLines={1}>{t.accountName}</Text>
                                                <Text className="text-brand-text text-sm font-semibold">{money(t.total)}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}
                                <Text className="text-brand-muted text-xs text-center mt-4">A running total toward your accounts. No money moves.</Text>
                            </>
                        ) : (
                            <View className="py-10"><ActivityIndicator color={colors.accent} /></View>
                        )}
                    </Card>

                    <View>
                        <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-3 px-1">Today</Text>
                        {tasksQuery.isLoading ? (
                            <Card className="p-4"><View className="h-4 w-40 bg-brand-elevated rounded" /></Card>
                        ) : dueToday.length === 0 ? (
                            <Card className="p-4"><Text className="text-brand-muted text-sm text-center">Nothing for today. Add a daily goal or chore below.</Text></Card>
                        ) : (
                            <View className="gap-y-2">
                                {dueToday.map(t => (
                                    <TodayTaskRow key={t.id} task={t} busy={togglingId === t.id} onToggle={() => toggle(t)} />
                                ))}
                            </View>
                        )}
                    </View>

                    <TaskSection title="Daily goals" empty="Things to do regularly, like a workout or no-spend days." tasks={habits} onAdd={() => setEditingTask('HABIT')} onEdit={setEditingTask} />
                    <TaskSection title="Chores" empty="Jobs to get done, one-time or repeating." tasks={chores} onAdd={() => setEditingTask('CHORE')} onEdit={setEditingTask} />

                    <View>
                        <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-3 px-1">History</Text>
                        {history.length === 0 ? (
                            <Card className="p-4"><Text className="text-brand-muted text-sm text-center">Nothing logged yet.</Text></Card>
                        ) : (
                            <Card className="p-0 overflow-hidden">
                                {history.map((h, i) => (
                                    <View key={h.id} className={`flex-row items-center px-4 py-3 ${i > 0 ? 'border-t border-brand-border' : ''}`}>
                                        <View className="flex-1">
                                            <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>{h.title}</Text>
                                            <Text className="text-brand-muted text-xs mt-0.5">
                                                {new Date(`${h.day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                {h.accountName ? ` · ${h.accountName}` : ''}
                                            </Text>
                                        </View>
                                        <AmountText amount={h.amount} size="sm" showSign />
                                    </View>
                                ))}
                            </Card>
                        )}
                    </View>
                </View>
            </ScrollView>

            {adult && (
                <TaskEditSheet
                    owner={{ adultId: adult.id }}
                    ownerName={adult.isYou ? 'you' : firstName}
                    rewardAccounts={detailQuery.data?.accounts ?? []}
                    task={editingTask}
                    onClose={() => setEditingTask(null)}
                />
            )}
        </SafeAreaView>
    )
}
