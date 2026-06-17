import { useState, useEffect } from 'react'
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { haptics } from '@/lib/haptics'
import type { Goal } from '@/lib/types'
import { colors } from '@/lib/colors'

interface Props {
    goal: Goal | 'new' | null
    onClose: () => void
}

const DEADLINE_OPTIONS: Array<{ label: string; months: number | null }> = [
    { label: 'No deadline', months: null },
    { label: '3 months', months: 3 },
    { label: '6 months', months: 6 },
    { label: '1 year', months: 12 },
    { label: '2 years', months: 24 },
]

function deadlineFromMonths(months: number): string {
    const d = new Date()
    d.setMonth(d.getMonth() + months)
    return d.toISOString()
}

function monthsForDeadline(deadline: string | null): number | null {
    if (!deadline) return null
    const diff = new Date(deadline).getTime() - Date.now()
    const months = Math.round(diff / (1000 * 60 * 60 * 24 * 30.5))
    const match = DEADLINE_OPTIONS.find((o) => o.months === months)
    return match ? match.months : months > 0 ? months : null
}

export function GoalEditSheet({ goal, onClose }: Props) {
    const queryClient = useQueryClient()
    const isNew = goal === 'new'
    const existing = isNew || !goal ? null : goal

    const [name, setName] = useState('')
    const [target, setTarget] = useState('')
    const [starting, setStarting] = useState('')
    const [deadlineMonths, setDeadlineMonths] = useState<number | null>(null)
    const [notes, setNotes] = useState('')

    useEffect(() => {
        if (existing) {
            setName(existing.name)
            setTarget(existing.targetAmount.toFixed(0))
            setNotes(existing.notes ?? '')
            setDeadlineMonths(monthsForDeadline(existing.deadline))
        } else if (isNew) {
            setName('')
            setTarget('')
            setStarting('')
            setNotes('')
            setDeadlineMonths(null)
        }
    }, [goal])

    const hasLinkedAccounts = (existing?.accounts?.length ?? 0) > 0

    const { mutate: save, isPending } = useMutation({
        mutationFn: async () => {
            const parsedTarget = parseFloat(target)
            if (!name.trim()) throw new Error('NAME')
            if (isNaN(parsedTarget) || parsedTarget <= 0) throw new Error('TARGET')

            const deadline = deadlineMonths != null ? deadlineFromMonths(deadlineMonths) : null
            const payload: Record<string, unknown> = {
                name: name.trim(),
                targetAmount: parsedTarget,
                deadline,
                notes: notes.trim() || null,
            }

            if (isNew) {
                const parsedStarting = parseFloat(starting)
                if (starting.trim() && !isNaN(parsedStarting) && parsedStarting > 0) {
                    payload.currentAmount = parsedStarting
                }
                await apiClient.post('/goals', payload)
            } else if (existing) {
                await apiClient.patch(`/goals/${existing.id}`, payload)
            }
        },
        onSuccess: () => {
            haptics.success()
            queryClient.invalidateQueries({ queryKey: ['goals'] })
            onClose()
        },
        onError: (e: any) => {
            haptics.error()
            if (e.message === 'NAME') Alert.alert('Missing name', 'Give your goal a name.')
            else if (e.message === 'TARGET') Alert.alert('Invalid target', 'Enter a target amount greater than zero.')
            else Alert.alert('Error', 'Failed to save goal. Please try again.')
        },
    })

    const handleDelete = () => {
        if (!existing) return
        haptics.warning()
        Alert.alert('Delete Goal', `Delete "${existing.name}"? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await apiClient.delete(`/goals/${existing.id}`)
                        queryClient.invalidateQueries({ queryKey: ['goals'] })
                        onClose()
                    } catch {
                        Alert.alert('Error', 'Failed to delete goal.')
                    }
                },
            },
        ])
    }

    const handleComplete = () => {
        if (!existing) return
        haptics.success()
        Alert.alert('Complete Goal', `Mark "${existing.name}" as completed? It will be removed from your active goals.`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Complete', onPress: async () => {
                    try {
                        await apiClient.patch(`/goals/${existing.id}`, { status: 'COMPLETED' })
                        queryClient.invalidateQueries({ queryKey: ['goals'] })
                        onClose()
                    } catch {
                        Alert.alert('Error', 'Failed to update goal.')
                    }
                },
            },
        ])
    }

    if (!goal) return null

    return (
        <Modal visible animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
            <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                <KeyboardAvoidingView
                    className="flex-1"
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    {/* Header */}
                    <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                        <TouchableOpacity onPress={onClose} hitSlop={8} className="w-8">
                            <X size={20} color={colors.muted} />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-brand-text text-base font-semibold">
                            {isNew ? 'New Goal' : 'Edit Goal'}
                        </Text>
                        <TouchableOpacity
                            onPress={() => save()}
                            disabled={isPending}
                            className="items-end"
                            hitSlop={8}
                        >
                            {isPending
                                ? <ActivityIndicator size="small" color={colors.accent} />
                                : <Text className="text-brand-accent font-semibold text-sm">Save</Text>
                            }
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
                        <View className="px-4 pt-6 gap-y-5 pb-10">
                            {/* Name */}
                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">
                                    Goal Name
                                </Text>
                                <TextInput
                                    className="bg-brand-surface border border-brand-border rounded-xl px-4 h-14 text-brand-text text-base"
                                    placeholder="e.g. Emergency fund"
                                    placeholderTextColor={colors.muted}
                                    value={name}
                                    onChangeText={setName}
                                    autoFocus={isNew}
                                />
                            </View>

                            {/* Target */}
                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">
                                    Target Amount
                                </Text>
                                <View className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 h-14">
                                    <Text className="text-brand-muted text-xl mr-1">$</Text>
                                    <TextInput
                                        className="flex-1 text-brand-text text-xl font-semibold"
                                        placeholder="5,000"
                                        placeholderTextColor={colors.muted}
                                        value={target}
                                        onChangeText={setTarget}
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                            </View>

                            {/* Starting amount (new, unlinked goals only) */}
                            {isNew && (
                                <View>
                                    <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">
                                        Already Saved (optional)
                                    </Text>
                                    <View className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 h-14">
                                        <Text className="text-brand-muted text-xl mr-1">$</Text>
                                        <TextInput
                                            className="flex-1 text-brand-text text-xl font-semibold"
                                            placeholder="0"
                                            placeholderTextColor={colors.muted}
                                            value={starting}
                                            onChangeText={setStarting}
                                            keyboardType="decimal-pad"
                                        />
                                    </View>
                                </View>
                            )}

                            {/* Deadline */}
                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">
                                    Target Date
                                </Text>
                                <View className="flex-row flex-wrap gap-2">
                                    {DEADLINE_OPTIONS.map((opt) => {
                                        const selected = deadlineMonths === opt.months
                                        return (
                                            <TouchableOpacity
                                                key={opt.label}
                                                onPress={() => { haptics.light(); setDeadlineMonths(opt.months) }}
                                                className={`px-4 py-2.5 rounded-xl border ${
                                                    selected
                                                        ? 'bg-brand-accent border-brand-accent'
                                                        : 'bg-brand-surface border-brand-border'
                                                }`}
                                                activeOpacity={0.7}
                                            >
                                                <Text className={`text-sm font-medium ${selected ? 'text-white' : 'text-brand-text'}`}>
                                                    {opt.label}
                                                </Text>
                                            </TouchableOpacity>
                                        )
                                    })}
                                    {deadlineMonths != null && !DEADLINE_OPTIONS.some((o) => o.months === deadlineMonths) && (
                                        <View className="px-4 py-2.5 rounded-xl border bg-brand-accent border-brand-accent">
                                            <Text className="text-sm font-medium text-white">{deadlineMonths} months</Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Notes */}
                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">
                                    Notes (optional)
                                </Text>
                                <TextInput
                                    className="bg-brand-surface border border-brand-border rounded-xl px-4 py-3.5 text-brand-text text-base min-h-[80px]"
                                    placeholder="Why this goal matters…"
                                    placeholderTextColor={colors.muted}
                                    value={notes}
                                    onChangeText={setNotes}
                                    multiline
                                    textAlignVertical="top"
                                />
                            </View>

                            {hasLinkedAccounts && (
                                <Text className="text-brand-muted text-xs leading-relaxed px-1">
                                    This goal tracks the balance of linked accounts ({existing!.accounts.map((a) => a.name).join(', ')}).
                                    Manage linked accounts on the web app.
                                </Text>
                            )}

                            {!isNew && (
                                <View className="gap-y-3 mt-2">
                                    <TouchableOpacity
                                        className="h-12 rounded-xl bg-brand-positive/10 border border-brand-positive/30 items-center justify-center"
                                        onPress={handleComplete}
                                        activeOpacity={0.7}
                                    >
                                        <Text className="text-brand-positive text-sm font-medium">Mark as Completed</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        className="h-12 rounded-xl border border-brand-negative/30 items-center justify-center"
                                        onPress={handleDelete}
                                        activeOpacity={0.7}
                                    >
                                        <Text className="text-brand-negative text-sm font-medium">Delete Goal</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    )
}
