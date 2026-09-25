import { useState, useEffect } from 'react'
import {
    Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Trash2, ChevronRight } from 'lucide-react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { ChildTask, TaskKind } from '@/lib/types'
import { colors } from '@/lib/colors'
import { haptics } from '@/lib/haptics'
import { OptionPicker } from '@/components/OptionPicker'

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]
const WEEKDAYS = [1, 2, 3, 4, 5]

interface Props {
    /** A kid (reward pays into their wallet) or a parent (reward is added to a budget category). */
    owner: { childId: string } | { adultId: string }
    ownerName: string
    /** Parents: budget categories the reward can be added to. */
    rewardCategories?: { id: string; name: string }[]
    /** 'CHORE' / 'HABIT' to create that kind, a task to edit it, null when closed. */
    task: ChildTask | TaskKind | null
    onClose: () => void
}

export function TaskEditSheet({ owner, ownerName, rewardCategories = [], task, onClose }: Props) {
    const queryClient = useQueryClient()
    const existing = task && typeof task === 'object' ? task : null
    const isAdult = 'adultId' in owner
    const [rewardCategoryId, setRewardCategoryId] = useState<string | null>(null)
    const [pickingCategory, setPickingCategory] = useState(false)
    const [title, setTitle] = useState('')
    const [kind, setKind] = useState<TaskKind>('CHORE')
    const [reward, setReward] = useState('')
    const [repeating, setRepeating] = useState(false)
    const [days, setDays] = useState<number[]>(EVERY_DAY)
    const [bonusOn, setBonusOn] = useState(false)
    const [bonusEvery, setBonusEvery] = useState('7')
    const [bonusAmount, setBonusAmount] = useState('')

    useEffect(() => {
        if (!task) return
        if (existing) {
            setTitle(existing.title)
            setKind(existing.kind)
            setReward(existing.reward ? String(existing.reward) : '')
            setRepeating(existing.frequency === 'REPEATING')
            setDays(existing.days.length ? existing.days : EVERY_DAY)
            setBonusOn(!!existing.bonusEvery)
            setBonusEvery(String(existing.bonusEvery ?? 7))
            setBonusAmount(existing.bonusAmount ? String(existing.bonusAmount) : '')
            setRewardCategoryId(existing.rewardCategoryId)
        } else {
            const k = task as TaskKind
            setTitle('')
            setKind(k)
            setReward('')
            // Daily goals are usually every day; chores are usually one-off.
            setRepeating(k === 'HABIT')
            setDays(EVERY_DAY)
            setBonusOn(false)
            setBonusEvery('7')
            setBonusAmount('')
            setRewardCategoryId(null)
        }
    }, [existing?.id ?? task])

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['family'] })

    const { mutate: save, isPending } = useMutation({
        mutationFn: async () => {
            const body = {
                title: title.trim(),
                kind,
                reward: reward ? Number(reward) : 0,
                frequency: repeating ? 'REPEATING' : 'ONCE',
                days: repeating ? days : [],
                bonusEvery: repeating && bonusOn ? Number(bonusEvery) : null,
                bonusAmount: repeating && bonusOn ? Number(bonusAmount) : null,
                ...(isAdult ? { rewardCategoryId } : {}),
            }
            if (!Number.isFinite(body.reward) || body.reward < 0) throw new Error('Enter a valid reward.')
            if (repeating && days.length === 0) throw new Error('Pick at least one day.')
            if (repeating && bonusOn && (!(body.bonusEvery! >= 2) || !(body.bonusAmount! > 0)))
                throw new Error('Set how many in a row (2 or more) and a bonus amount.')
            if (existing) await apiClient.patch(`/family/tasks/${existing.id}`, body)
            else if ('adultId' in owner) await apiClient.post(`/family/adults/${owner.adultId}/tasks`, body)
            else await apiClient.post(`/family/children/${owner.childId}/tasks`, body)
        },
        onSuccess: () => {
            haptics.success()
            invalidate()
            onClose()
        },
        onError: (e: any) => {
            haptics.error()
            Alert.alert('Error', e?.response?.data?.error ?? e?.message ?? 'Failed to save.')
        },
    })

    const handleDelete = () => {
        if (!existing) return
        haptics.warning()
        Alert.alert(`Delete "${existing.title}"?`, isAdult ? 'It stops showing up. Rewards it already added stay in those budgets.' : 'It stops showing up. Money already earned from it stays in the wallet.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await apiClient.delete(`/family/tasks/${existing.id}`)
                        invalidate()
                        onClose()
                    } catch {
                        Alert.alert('Error', 'Failed to delete.')
                    }
                },
            },
        ])
    }

    const toggleDay = (d: number) => {
        haptics.light()
        setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort())
    }

    if (!task) return null
    const noun = kind === 'HABIT' ? 'daily goal' : 'chore'

    return (
        <Modal visible animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
            <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                        <TouchableOpacity onPress={onClose} hitSlop={8} className="w-8">
                            <X size={20} color={colors.muted} />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-brand-text text-base font-semibold" numberOfLines={1}>
                            {existing ? `Edit ${noun}` : `New ${noun} for ${ownerName}`}
                        </Text>
                        <TouchableOpacity onPress={() => save()} disabled={isPending || !title.trim()} hitSlop={8} className="items-end">
                            {isPending
                                ? <ActivityIndicator size="small" color={colors.accent} />
                                : <Text className={`font-semibold text-sm ${title.trim() ? 'text-brand-accent' : 'text-brand-muted'}`}>Save</Text>
                            }
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
                        <View className="px-4 pt-6 pb-10 gap-y-5">
                            <View className="flex-row bg-brand-surface border border-brand-border rounded-xl p-1">
                                {(['CHORE', 'HABIT'] as const).map(k => (
                                    <TouchableOpacity
                                        key={k}
                                        onPress={() => { haptics.light(); setKind(k) }}
                                        className={`flex-1 h-9 rounded-lg items-center justify-center ${kind === k ? 'bg-brand-accent' : ''}`}
                                    >
                                        <Text className={`text-sm font-semibold ${kind === k ? 'text-white' : 'text-brand-muted'}`}>
                                            {k === 'CHORE' ? 'Chore' : 'Daily goal'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">What</Text>
                                <TextInput
                                    className="bg-brand-surface border border-brand-border rounded-xl px-4 h-12 text-brand-text text-base"
                                    value={title}
                                    onChangeText={setTitle}
                                    placeholder={kind === 'HABIT' ? 'e.g. Read a book for 20 min' : 'e.g. Clean your room'}
                                    placeholderTextColor={colors.muted}
                                    maxLength={100}
                                    autoFocus={!existing}
                                />
                            </View>

                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">Reward each time (optional)</Text>
                                <TextInput
                                    className="bg-brand-surface border border-brand-border rounded-xl px-4 h-12 text-brand-text text-base"
                                    value={reward}
                                    onChangeText={setReward}
                                    placeholder="$0.00"
                                    placeholderTextColor={colors.muted}
                                    keyboardType="decimal-pad"
                                />
                            </View>

                            {isAdult && (
                                <View>
                                    <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">Add rewards to budget</Text>
                                    <TouchableOpacity
                                        onPress={() => { haptics.light(); setPickingCategory(true) }}
                                        className="bg-brand-surface border border-brand-border rounded-xl px-4 h-12 flex-row items-center"
                                    >
                                        <Text className={`flex-1 text-base ${rewardCategoryId ? 'text-brand-text' : 'text-brand-muted'}`} numberOfLines={1}>
                                            {rewardCategories.find(c => c.id === rewardCategoryId)?.name ?? 'No category'}
                                        </Text>
                                        <ChevronRight size={16} color={colors.muted} />
                                    </TouchableOpacity>
                                    <Text className="text-brand-muted text-xs mt-1.5">Each time it&apos;s done, the reward is added to this category&apos;s budget for that month.</Text>
                                </View>
                            )}

                            <View className="bg-brand-surface border border-brand-border rounded-2xl p-4 gap-y-4">
                                <View className="flex-row items-center justify-between">
                                    <Text className="text-brand-text text-sm font-medium">Repeats</Text>
                                    <Switch value={repeating} onValueChange={(v) => { haptics.light(); setRepeating(v) }} trackColor={{ true: colors.accent }} />
                                </View>

                                {repeating && (
                                    <>
                                        <View className="flex-row justify-between">
                                            {DAY_LETTERS.map((l, d) => (
                                                <TouchableOpacity
                                                    key={d}
                                                    onPress={() => toggleDay(d)}
                                                    className={`w-10 h-10 rounded-full items-center justify-center border ${days.includes(d) ? 'bg-brand-accent border-brand-accent' : 'border-brand-border'}`}
                                                >
                                                    <Text className={`text-sm font-semibold ${days.includes(d) ? 'text-white' : 'text-brand-muted'}`}>{l}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                        <View className="flex-row gap-x-4">
                                            <TouchableOpacity onPress={() => setDays(EVERY_DAY)}><Text className="text-brand-accent text-xs font-medium">Every day</Text></TouchableOpacity>
                                            <TouchableOpacity onPress={() => setDays(WEEKDAYS)}><Text className="text-brand-accent text-xs font-medium">Weekdays</Text></TouchableOpacity>
                                        </View>

                                        <View className="border-t border-brand-border pt-4 gap-y-3">
                                            <View className="flex-row items-center justify-between">
                                                <View className="flex-1 pr-3">
                                                    <Text className="text-brand-text text-sm font-medium">Streak bonus</Text>
                                                    <Text className="text-brand-muted text-xs mt-0.5">{isAdult ? 'Extra added to the budget for keeping it up.' : 'Extra money for keeping it up.'}</Text>
                                                </View>
                                                <Switch value={bonusOn} onValueChange={(v) => { haptics.light(); setBonusOn(v) }} trackColor={{ true: colors.accent }} />
                                            </View>
                                            {bonusOn && (
                                                <View className="flex-row items-center gap-x-2">
                                                    <Text className="text-brand-text">+</Text>
                                                    <TextInput
                                                        className="bg-brand-elevated border border-brand-border rounded-xl px-3 h-11 text-brand-text w-20"
                                                        value={bonusAmount}
                                                        onChangeText={setBonusAmount}
                                                        placeholder="$5"
                                                        placeholderTextColor={colors.muted}
                                                        keyboardType="decimal-pad"
                                                    />
                                                    <Text className="text-brand-text">every</Text>
                                                    <TextInput
                                                        className="bg-brand-elevated border border-brand-border rounded-xl px-3 h-11 text-brand-text w-14 text-center"
                                                        value={bonusEvery}
                                                        onChangeText={(t) => setBonusEvery(t.replace(/\D/g, ''))}
                                                        keyboardType="number-pad"
                                                    />
                                                    <Text className="text-brand-text">in a row</Text>
                                                </View>
                                            )}
                                        </View>
                                    </>
                                )}
                            </View>

                            {existing && (
                                <TouchableOpacity onPress={handleDelete} className="flex-row items-center justify-center gap-x-2 py-3">
                                    <Trash2 size={16} color={colors.destructive} />
                                    <Text className="text-brand-negative font-medium">Delete {noun}</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
            <OptionPicker
                visible={pickingCategory}
                title="Add rewards to budget"
                options={rewardCategories.map(c => ({ label: c.name, value: c.id }))}
                selectedValue={rewardCategoryId}
                onSelect={setRewardCategoryId}
                onClose={() => setPickingCategory(false)}
                noneLabel="No category"
            />
        </Modal>
    )
}
