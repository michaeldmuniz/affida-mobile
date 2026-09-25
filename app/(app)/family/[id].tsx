import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, Pencil, Plus, Minus, Check, Flame, Sparkles } from 'lucide-react-native'
import { apiClient } from '@/lib/api-client'
import type { ChildDetail, ChildTask, TaskKind, WalletEntry, WalletKind } from '@/lib/types'
import { colors, KID_COLORS } from '@/lib/colors'
import { haptics } from '@/lib/haptics'
import { localDay, scheduleLabel } from '@/lib/format'
import { Card } from '@/components/ui/Card'
import { AmountText } from '@/components/ui/AmountText'
import { KidAvatar } from '@/components/family/KidAvatar'
import { ChildEditSheet } from '@/components/family/ChildEditSheet'
import { TaskEditSheet } from '@/components/family/TaskEditSheet'
import { WalletEntrySheet } from '@/components/family/WalletEntrySheet'

const STREAK_COLOR = KID_COLORS['chart-3']
const KIND_LABELS: Record<WalletKind, string> = {
    ALLOWANCE: 'Allowance', GIFT: 'Gift', EARNED: 'Earned', SPENT: 'Spent', CASHED_OUT: 'Cashed out', ADJUSTMENT: 'Adjustment',
}

function money(n: number) {
    return `$${n.toFixed(2)}`
}

export default function KidScreen() {
    const { id } = useLocalSearchParams<{ id: string }>()
    const router = useRouter()
    const queryClient = useQueryClient()
    const [day] = useState(() => localDay())
    const [editingKid, setEditingKid] = useState(false)
    const [editingTask, setEditingTask] = useState<ChildTask | TaskKind | null>(null)
    const [walletMode, setWalletMode] = useState<'add' | 'remove' | null>(null)
    const [togglingId, setTogglingId] = useState<string | null>(null)

    const detailQuery = useQuery<ChildDetail>({
        queryKey: ['family', id],
        queryFn: async () => (await apiClient.get(`/family/children/${id}`)).data.data,
    })
    const tasksQuery = useQuery<ChildTask[]>({
        queryKey: ['family', id, 'tasks', day],
        queryFn: async () => (await apiClient.get(`/family/children/${id}/tasks`, { params: { day } })).data.data,
    })

    const { mutate: toggle } = useMutation({
        mutationFn: async (task: ChildTask) => {
            if (task.doneOnDay) {
                await apiClient.delete(`/family/tasks/${task.id}/complete`, { params: { day } })
                return null
            }
            return (await apiClient.post(`/family/tasks/${task.id}/complete`, { day })).data.data as { earned: number; bonus: number; streak: number }
        },
        onMutate: (task) => setTogglingId(task.id),
        onSuccess: (result) => {
            haptics.success()
            if (result && result.bonus > 0) {
                Alert.alert(`${result.streak} in a row!`, `${detailQuery.data?.child.name ?? 'They'} earned a ${money(result.bonus)} streak bonus.`)
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

    const child = detailQuery.data?.child
    const entries = detailQuery.data?.entries ?? []
    const tasks = tasksQuery.data ?? []
    const dueToday = tasks.filter(t => t.dueOnDay)
    const habits = tasks.filter(t => t.kind === 'HABIT')
    const chores = tasks.filter(t => t.kind === 'CHORE')
    const leftToEarn = dueToday.filter(t => !t.doneOnDay).reduce((s, t) => s + t.reward, 0)

    const explainTaskEntry = (e: WalletEntry) => {
        if (e.fromTask) Alert.alert('Earned from a task', 'To take this back, tap the chore or goal again to undo it.')
        else confirmDeleteEntry(e)
    }

    const confirmDeleteEntry = (e: WalletEntry) => {
        haptics.warning()
        Alert.alert('Delete entry?', `${e.note || KIND_LABELS[e.kind]} · ${e.amount >= 0 ? '+' : '−'}${money(Math.abs(e.amount))}`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await apiClient.delete(`/family/entries/${e.id}`)
                        queryClient.invalidateQueries({ queryKey: ['family'] })
                    } catch (err: any) {
                        Alert.alert('Error', err?.response?.data?.error ?? 'Failed to delete.')
                    }
                },
            },
        ])
    }

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            <View className="flex-row items-center px-4 pt-4 pb-3">
                <TouchableOpacity onPress={() => router.back()} hitSlop={8} className="w-8">
                    <ChevronLeft size={22} color={colors.muted} />
                </TouchableOpacity>
                <Text className="flex-1 text-center text-brand-text text-lg font-bold" numberOfLines={1}>
                    {child?.name ?? ''}
                </Text>
                <TouchableOpacity onPress={() => setEditingKid(true)} disabled={!child} hitSlop={8} className="w-8 items-end">
                    <Pencil size={17} color={colors.muted} />
                </TouchableOpacity>
            </View>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
            >
                <View className="px-6 gap-y-5 pb-10 pt-2">
                    {/* Wallet summary */}
                    <Card className="p-5 items-center">
                        {child ? (
                            <>
                                <KidAvatar name={child.name} color={child.color} size={52} />
                                <AmountText amount={child.balance} size="xl" neutral className="mt-3" />
                                <Text className="text-brand-muted text-xs uppercase tracking-widest mt-1">In wallet</Text>
                                <View className="flex-row gap-x-3 mt-4 self-stretch">
                                    <TouchableOpacity onPress={() => { haptics.light(); setWalletMode('add') }} className="flex-1 h-11 rounded-xl bg-brand-accent flex-row items-center justify-center gap-x-2">
                                        <Plus size={16} color="#fff" strokeWidth={2.2} />
                                        <Text className="text-white font-semibold">Add</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => { haptics.light(); setWalletMode('remove') }}
                                        disabled={child.balance <= 0}
                                        className={`flex-1 h-11 rounded-xl border border-brand-border flex-row items-center justify-center gap-x-2 ${child.balance <= 0 ? 'opacity-40' : ''}`}
                                    >
                                        <Minus size={16} color={colors.text} strokeWidth={2.2} />
                                        <Text className="text-brand-text font-semibold">Take out</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        ) : (
                            <View className="py-10"><ActivityIndicator color={colors.accent} /></View>
                        )}
                    </Card>

                    {/* Today */}
                    <View>
                        <View className="flex-row items-center justify-between mb-3 px-1">
                            <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest">Today</Text>
                            {leftToEarn > 0 && <Text className="text-brand-muted text-xs"><Text className="text-brand-positive font-semibold">{money(leftToEarn)}</Text> left to earn</Text>}
                        </View>
                        {tasksQuery.isLoading ? (
                            <Card className="p-4"><View className="h-4 w-40 bg-brand-elevated rounded" /></Card>
                        ) : dueToday.length === 0 ? (
                            <Card className="p-4"><Text className="text-brand-muted text-sm text-center">Nothing for today. Add a chore or daily goal below.</Text></Card>
                        ) : (
                            <View className="gap-y-2">
                                {dueToday.map(t => (
                                    <TouchableOpacity key={t.id} activeOpacity={0.7} disabled={togglingId === t.id} onPress={() => toggle(t)}>
                                        <Card className="flex-row items-center gap-x-3 p-4">
                                            <View className={`w-7 h-7 rounded-full items-center justify-center border-2 ${t.doneOnDay ? 'bg-brand-positive border-brand-positive' : 'border-brand-muted'}`}>
                                                {togglingId === t.id
                                                    ? <ActivityIndicator size="small" color={t.doneOnDay ? '#fff' : colors.muted} />
                                                    : t.doneOnDay && <Check size={15} color="#fff" strokeWidth={3} />}
                                            </View>
                                            <View className="flex-1">
                                                <Text className={`text-sm font-medium ${t.doneOnDay ? 'text-brand-muted line-through' : 'text-brand-text'}`} numberOfLines={1}>{t.title}</Text>
                                                <Text className="text-brand-muted text-xs mt-0.5" numberOfLines={1}>
                                                    {t.kind === 'HABIT' ? 'Daily goal' : 'Chore'}
                                                    {t.nextBonusIn !== null && t.bonusAmount ? ` · ${t.nextBonusIn} more for ${money(t.bonusAmount)}` : ''}
                                                </Text>
                                            </View>
                                            {t.streak > 1 && (
                                                <View className="flex-row items-center gap-x-0.5">
                                                    <Flame size={13} color={STREAK_COLOR} />
                                                    <Text className="text-xs font-semibold" style={{ color: STREAK_COLOR }}>{t.streak}</Text>
                                                </View>
                                            )}
                                            {t.reward > 0 && (
                                                <Text className={`text-sm font-semibold ${t.doneOnDay ? 'text-brand-muted' : 'text-brand-positive'}`}>+{money(t.reward)}</Text>
                                            )}
                                        </Card>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>

                    <TaskSection title="Daily goals" empty="Things to do regularly, like reading or exercise." tasks={habits} onAdd={() => setEditingTask('HABIT')} onEdit={setEditingTask} />
                    <TaskSection title="Chores" empty="Jobs around the house, one-time or repeating." tasks={chores} onAdd={() => setEditingTask('CHORE')} onEdit={setEditingTask} />

                    {/* History */}
                    <View>
                        <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-3 px-1">History</Text>
                        {entries.length === 0 ? (
                            <Card className="p-4"><Text className="text-brand-muted text-sm text-center">No activity yet.</Text></Card>
                        ) : (
                            <Card className="p-0 overflow-hidden">
                                {entries.map((e, i) => (
                                    <TouchableOpacity
                                        key={e.id}
                                        onLongPress={() => explainTaskEntry(e)}
                                        delayLongPress={350}
                                        activeOpacity={0.7}
                                        className={`flex-row items-center px-4 py-3 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                                    >
                                        <View className="flex-1">
                                            <View className="flex-row items-center gap-x-1.5">
                                                {e.fromTask && <Sparkles size={12} color={STREAK_COLOR} />}
                                                <Text className="text-brand-text text-sm font-medium flex-1" numberOfLines={1}>{e.note || KIND_LABELS[e.kind]}</Text>
                                            </View>
                                            <Text className="text-brand-muted text-xs mt-0.5">
                                                {KIND_LABELS[e.kind]} · {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                {e.createdByName ? ` · ${e.createdByName.split(' ')[0]}` : ''}
                                            </Text>
                                        </View>
                                        <AmountText amount={e.amount} size="sm" showSign />
                                    </TouchableOpacity>
                                ))}
                            </Card>
                        )}
                        {entries.length > 0 && (
                            <Text className="text-brand-muted text-xs text-center mt-2">Press and hold an entry to delete it.</Text>
                        )}
                    </View>
                </View>
            </ScrollView>

            {child && (
                <>
                    <ChildEditSheet child={editingKid ? child : null} onClose={() => setEditingKid(false)} onRemoved={() => router.back()} />
                    <TaskEditSheet childId={child.id} childName={child.name} task={editingTask} onClose={() => setEditingTask(null)} />
                    <WalletEntrySheet childId={child.id} childName={child.name} mode={walletMode} onClose={() => setWalletMode(null)} />
                </>
            )}
        </SafeAreaView>
    )
}

function TaskSection({ title, empty, tasks, onAdd, onEdit }: {
    title: string
    empty: string
    tasks: ChildTask[]
    onAdd: () => void
    onEdit: (t: ChildTask) => void
}) {
    return (
        <View>
            <View className="flex-row items-center justify-between mb-3 px-1">
                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest">{title}</Text>
                <TouchableOpacity onPress={() => { haptics.light(); onAdd() }} hitSlop={8} className="flex-row items-center gap-x-1">
                    <Plus size={14} color={colors.accent} strokeWidth={2.2} />
                    <Text className="text-brand-accent text-sm font-semibold">Add</Text>
                </TouchableOpacity>
            </View>
            {tasks.length === 0 ? (
                <Card className="p-4"><Text className="text-brand-muted text-sm">{empty}</Text></Card>
            ) : (
                <Card className="p-0 overflow-hidden">
                    {tasks.map((t, i) => (
                        <TouchableOpacity
                            key={t.id}
                            onPress={() => { haptics.light(); onEdit(t) }}
                            activeOpacity={0.7}
                            className={`flex-row items-center px-4 py-3 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                        >
                            <View className="flex-1">
                                <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>{t.title}</Text>
                                <Text className="text-brand-muted text-xs mt-0.5" numberOfLines={1}>
                                    {scheduleLabel(t)}
                                    {t.frequency === 'ONCE' && t.lastDone ? ` · Done ${new Date(`${t.lastDone}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                                    {t.bonusEvery && t.bonusAmount ? ` · +${money(t.bonusAmount)} every ${t.bonusEvery}` : ''}
                                </Text>
                            </View>
                            {t.streak > 1 && (
                                <View className="flex-row items-center gap-x-0.5 mr-2">
                                    <Flame size={13} color={STREAK_COLOR} />
                                    <Text className="text-xs font-semibold" style={{ color: STREAK_COLOR }}>{t.streak}</Text>
                                </View>
                            )}
                            <Text className="text-brand-muted text-sm">{t.reward > 0 ? money(t.reward) : 'No reward'}</Text>
                        </TouchableOpacity>
                    ))}
                </Card>
            )}
        </View>
    )
}
