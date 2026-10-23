import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Users } from 'lucide-react-native'
import { apiClient } from '@/lib/api-client'
import type { Child, ChildTask, HouseholdAdult, TaskKind } from '@/lib/types'
import { colors } from '@/lib/colors'
import { haptics } from '@/lib/haptics'
import { localDay } from '@/lib/format'
import { Card } from '@/components/ui/Card'
import { AmountText } from '@/components/ui/AmountText'
import { KidAvatar } from '@/components/family/KidAvatar'
import { ChildEditSheet } from '@/components/family/ChildEditSheet'
import { FamilyCalendar } from '@/components/family/FamilyCalendar'
import { TaskEditSheet } from '@/components/family/TaskEditSheet'
import { TodayTaskRow, TaskSection } from '@/components/family/TaskRows'
import { OptionPicker } from '@/components/OptionPicker'

export default function FamilyScreen() {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [editing, setEditing] = useState<Child | 'new' | null>(null)
    const [day] = useState(() => localDay())
    const [editingTask, setEditingTask] = useState<ChildTask | TaskKind | null>(null)
    // An unassigned chore being checked off: pick who did it first.
    const [pickingDoer, setPickingDoer] = useState<ChildTask | null>(null)
    // Second step: which budget category that person's reward goes to
    const [pickingCategory, setPickingCategory] = useState<{ task: ChildTask; doneBy: { childId: string } | { adultId: string } } | null>(null)
    const [togglingId, setTogglingId] = useState<string | null>(null)

    const { data: kids, isLoading, refetch, isRefetching } = useQuery<Child[]>({
        queryKey: ['family'],
        queryFn: async () => (await apiClient.get('/family/children')).data.data,
        staleTime: 60 * 1000,
    })

    const { data: adults } = useQuery<HouseholdAdult[]>({
        queryKey: ['family', 'adults'],
        queryFn: async () => (await apiClient.get('/family/adults')).data.data,
        staleTime: 60 * 1000,
    })

    const { data: anyoneTasks } = useQuery<ChildTask[]>({
        queryKey: ['family', 'anyone', 'tasks', day],
        queryFn: async () => (await apiClient.get('/family/anyone/tasks', { params: { day } })).data.data,
    })

    const { data: categories } = useQuery<{ id: string; name: string }[]>({
        queryKey: ['family', 'reward-categories'],
        queryFn: async () => (await apiClient.get('/family/reward-categories')).data.data,
        staleTime: 5 * 60 * 1000,
    })

    const { mutate: toggleAnyone } = useMutation({
        mutationFn: async ({ task, doneBy, rewardCategoryId }: { task: ChildTask; doneBy?: { childId: string } | { adultId: string }; rewardCategoryId?: string | null }) => {
            if (task.doneOnDay) {
                await apiClient.delete(`/family/tasks/${task.id}/complete`, { params: { day } })
                return null
            }
            return (await apiClient.post(`/family/tasks/${task.id}/complete`, { day, ...doneBy, ...(rewardCategoryId !== undefined ? { rewardCategoryId } : {}) })).data.data as { earned: number; bonus: number; streak: number; recipientName: string | null }
        },
        onMutate: ({ task }) => setTogglingId(task.id),
        onSuccess: () => haptics.success(),
        onError: (e: any) => {
            haptics.error()
            Alert.alert('Error', e?.response?.data?.error ?? 'Something went wrong.')
        },
        onSettled: async () => {
            await queryClient.invalidateQueries({ queryKey: ['family'] })
            setTogglingId(null)
        },
    })

    const anyoneChores = (anyoneTasks ?? []).filter(t => t.kind === 'CHORE')
    const anyoneToday = anyoneChores.filter(t => t.dueOnDay)
    const doerOptions = [
        ...(adults ?? []).map(a => ({ label: a.isYou ? 'You' : a.name, value: `a:${a.id}` })),
        ...(kids ?? []).map(k => ({ label: k.name, value: `c:${k.id}` })),
    ]

    const total = kids?.reduce((s, k) => s + k.balance, 0) ?? 0

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
            >
                <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
                    <View className="flex-row items-center gap-x-2">
                        <TouchableOpacity onPress={() => router.back()} hitSlop={8} className="-ml-2">
                            <ChevronLeft size={24} color={colors.muted} />
                        </TouchableOpacity>
                        <Text className="text-brand-text text-2xl font-bold">Family</Text>
                    </View>
                    <TouchableOpacity
                        className="w-9 h-9 rounded-full bg-brand-surface border border-brand-border items-center justify-center"
                        onPress={() => { haptics.medium(); setEditing('new') }}
                    >
                        <Plus size={18} color={colors.accent} strokeWidth={2} />
                    </TouchableOpacity>
                </View>

                <View className="px-6 gap-y-3 pb-8 pt-4">
                    {adults && adults.length > 0 && (
                        <>
                            <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest px-1">Parents</Text>
                            {adults.map((a) => (
                                <TouchableOpacity key={a.id} activeOpacity={0.7} onPress={() => { haptics.light(); router.push(`/(app)/family/adult/${a.id}` as any) }}>
                                    <Card className="flex-row items-center gap-x-3 p-4">
                                        <KidAvatar name={a.name} color="chart-2" />
                                        <View className="flex-1">
                                            <Text className="text-brand-text text-base font-semibold" numberOfLines={1}>{a.isYou ? 'You' : a.name}</Text>
                                            <Text className="text-brand-muted text-xs mt-0.5">Goals &amp; rewards</Text>
                                        </View>
                                        <View className="items-end">
                                            <AmountText amount={a.earnedThisMonth} size="md" neutral className="font-semibold" />
                                            <Text className="text-brand-muted text-[10px]">to budgets this month</Text>
                                        </View>
                                        <ChevronRight size={14} color={colors.disabled} style={{ marginLeft: 4 }} />
                                    </Card>
                                </TouchableOpacity>
                            ))}
                        </>
                    )}
                    <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest px-1 mt-4">Kids</Text>
                    {isLoading ? (
                        [1, 2].map((i) => (
                            <Card key={i} className="flex-row items-center gap-x-3 p-4">
                                <View className="w-11 h-11 rounded-full bg-brand-elevated" />
                                <View className="flex-1 gap-y-2">
                                    <View className="h-3.5 w-24 bg-brand-elevated rounded" />
                                    <View className="h-2.5 w-12 bg-brand-elevated rounded" />
                                </View>
                                <View className="h-4 w-16 bg-brand-elevated rounded" />
                            </Card>
                        ))
                    ) : !kids || kids.length === 0 ? (
                        <View className="items-center py-16">
                            <View className="w-14 h-14 rounded-2xl bg-brand-surface border border-brand-border items-center justify-center mb-4">
                                <Users size={24} color={colors.muted} strokeWidth={1.5} />
                            </View>
                            <Text className="text-brand-text font-semibold mb-1">No kids added yet</Text>
                            <Text className="text-brand-muted text-sm text-center leading-relaxed px-8 mb-5">
                                Give each kid a wallet, then set chores and daily goals that pay into it.
                            </Text>
                            <TouchableOpacity
                                onPress={() => { haptics.medium(); setEditing('new') }}
                                className="flex-row items-center gap-x-2 bg-brand-accent rounded-xl px-5 h-11"
                            >
                                <Plus size={16} color="#fff" strokeWidth={2.2} />
                                <Text className="text-white font-semibold">Add your first kid</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            {kids.length > 1 && (
                                <Card className="p-5 mb-2">
                                    <Text className="text-brand-muted text-xs uppercase tracking-widest mb-2">All wallets</Text>
                                    <AmountText amount={total} size="lg" neutral />
                                </Card>
                            )}
                            {kids.map((kid) => {
                                const age = kid.birthYear ? new Date().getFullYear() - kid.birthYear : null
                                return (
                                    <TouchableOpacity key={kid.id} activeOpacity={0.7} onPress={() => { haptics.light(); router.push(`/(app)/family/${kid.id}` as any) }}>
                                        <Card className="flex-row items-center gap-x-3 p-4">
                                            <KidAvatar name={kid.name} color={kid.color} />
                                            <View className="flex-1">
                                                <Text className="text-brand-text text-base font-semibold" numberOfLines={1}>{kid.name}</Text>
                                                <Text className="text-brand-muted text-xs mt-0.5">{age !== null ? `Age ${age}` : 'Wallet'}</Text>
                                            </View>
                                            <View className="items-end">
                                                <AmountText amount={kid.balance} size="md" neutral className="font-semibold" />
                                                {(kid.addedToBudgetsThisMonth ?? 0) > 0 && (
                                                    <Text className="text-brand-muted text-[10px]">${(kid.addedToBudgetsThisMonth ?? 0).toFixed(2)} to budgets this month</Text>
                                                )}
                                            </View>
                                            <ChevronRight size={14} color={colors.disabled} style={{ marginLeft: 4 }} />
                                        </Card>
                                    </TouchableOpacity>
                                )
                            })}
                        </>
                    )}

                    <View className="mt-4 gap-y-3">
                        <View className="flex-row items-center justify-between px-1">
                            <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest">Anyone can do</Text>
                        </View>
                        {anyoneToday.length > 0 && (
                            <View className="gap-y-2">
                                {anyoneToday.map(t => (
                                    <View key={t.id}>
                                        <TodayTaskRow
                                            task={t}
                                            busy={togglingId === t.id}
                                            onToggle={() => {
                                                haptics.light()
                                                if (t.doneOnDay) toggleAnyone({ task: t })
                                                else setPickingDoer(t)
                                            }}
                                        />
                                        {t.doneOnDay && t.doneByName && (
                                            <Text className="text-brand-muted text-xs px-2 mt-1">Done by {t.doneByName}</Text>
                                        )}
                                    </View>
                                ))}
                            </View>
                        )}
                        <TaskSection
                            title="Unassigned chores"
                            empty="Chores anyone can do. Whoever does one gets the reward."
                            tasks={anyoneChores}
                            onAdd={() => setEditingTask('CHORE')}
                            onEdit={setEditingTask}
                        />
                    </View>

                    <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest px-1 mt-4">Calendar</Text>
                    <FamilyCalendar />
                </View>
            </ScrollView>

            <ChildEditSheet child={editing} onClose={() => setEditing(null)} />
            <TaskEditSheet owner={{ household: true }} ownerName="anyone" rewardCategories={categories ?? []} task={editingTask} onClose={() => setEditingTask(null)} />
            <OptionPicker
                visible={!!pickingDoer}
                title="Who did it?"
                options={doerOptions}
                selectedValue={null}
                noneLabel="Cancel"
                onSelect={(v) => {
                    const task = pickingDoer
                    if (!v || !task) return
                    const doneBy = v.startsWith('c:') ? { childId: v.slice(2) } : { adultId: v.slice(2) }
                    // With a reward and budget categories to choose from, ask where this person's reward goes
                    if (task.reward > 0 && (categories ?? []).length > 0) setPickingCategory({ task, doneBy })
                    else toggleAnyone({ task, doneBy })
                }}
                onClose={() => setPickingDoer(null)}
            />
            <OptionPicker
                visible={!!pickingCategory}
                title="Add the reward to budget"
                options={(categories ?? []).map(c => ({ label: c.name, value: c.id }))}
                selectedValue={(() => {
                    if (!pickingCategory) return null
                    const { task, doneBy } = pickingCategory
                    const key = 'childId' in doneBy ? `kid-${doneBy.childId}` : `adult-${doneBy.adultId}`
                    const own = task.categoryByPerson && key in task.categoryByPerson ? task.categoryByPerson[key] : task.rewardCategoryId
                    return own && (categories ?? []).some(c => c.id === own) ? own : null
                })()}
                noneLabel="No category"
                onSelect={(v) => {
                    if (!pickingCategory) return
                    toggleAnyone({ task: pickingCategory.task, doneBy: pickingCategory.doneBy, rewardCategoryId: v })
                }}
                onClose={() => setPickingCategory(null)}
            />
        </SafeAreaView>
    )
}
