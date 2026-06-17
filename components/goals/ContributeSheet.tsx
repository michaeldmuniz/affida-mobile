import { useState, useEffect } from 'react'
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { haptics } from '@/lib/haptics'
import type { Goal } from '@/lib/types'
import { colors } from '@/lib/colors'

interface Props {
    goal: Goal | null
    onClose: () => void
}

const QUICK_AMOUNTS = [25, 50, 100, 250]

export function GoalContributeSheet({ goal, onClose }: Props) {
    const queryClient = useQueryClient()
    const [amount, setAmount] = useState('')
    const [note, setNote] = useState('')

    useEffect(() => {
        if (goal) {
            setAmount('')
            setNote('')
        }
    }, [goal])

    const { mutate: save, isPending } = useMutation({
        mutationFn: async () => {
            if (!goal) return
            const parsed = parseFloat(amount)
            if (isNaN(parsed) || parsed <= 0) throw new Error('AMOUNT')
            await apiClient.post(`/goals/${goal.id}/contributions`, {
                amount: parsed,
                note: note.trim() || null,
            })
        },
        onSuccess: () => {
            haptics.success()
            queryClient.invalidateQueries({ queryKey: ['goals'] })
            onClose()
        },
        onError: (e: any) => {
            haptics.error()
            if (e.message === 'AMOUNT') Alert.alert('Invalid amount', 'Enter an amount greater than zero.')
            else Alert.alert('Error', 'Failed to add contribution. Please try again.')
        },
    })

    if (!goal) return null

    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount)

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
                        <Text className="flex-1 text-center text-brand-text text-base font-semibold" numberOfLines={1}>
                            Add to {goal.name}
                        </Text>
                        <TouchableOpacity
                            onPress={() => save()}
                            disabled={isPending}
                            className="items-end"
                            hitSlop={8}
                        >
                            {isPending
                                ? <ActivityIndicator size="small" color={colors.accent} />
                                : <Text className="text-brand-accent font-semibold text-sm">Add</Text>
                            }
                        </TouchableOpacity>
                    </View>

                    <View className="px-4 pt-6 gap-y-5 flex-1">
                        {remaining > 0 && (
                            <Text className="text-brand-muted text-sm text-center">
                                ${remaining.toLocaleString('en-US', { maximumFractionDigits: 0 })} to go
                            </Text>
                        )}

                        {/* Amount */}
                        <View>
                            <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">
                                Amount
                            </Text>
                            <View className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 h-14">
                                <Text className="text-brand-muted text-xl mr-1">$</Text>
                                <TextInput
                                    className="flex-1 text-brand-text text-xl font-semibold"
                                    placeholder="0"
                                    placeholderTextColor={colors.muted}
                                    value={amount}
                                    onChangeText={setAmount}
                                    keyboardType="decimal-pad"
                                    autoFocus
                                />
                            </View>
                            <View className="flex-row gap-2 mt-3">
                                {QUICK_AMOUNTS.map((q) => (
                                    <TouchableOpacity
                                        key={q}
                                        onPress={() => { haptics.light(); setAmount(String(q)) }}
                                        className="flex-1 py-2.5 rounded-xl bg-brand-surface border border-brand-border items-center"
                                        activeOpacity={0.7}
                                    >
                                        <Text className="text-brand-text text-sm font-medium">${q}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Note */}
                        <View>
                            <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">
                                Note (optional)
                            </Text>
                            <TextInput
                                className="bg-brand-surface border border-brand-border rounded-xl px-4 h-14 text-brand-text text-base"
                                placeholder="e.g. Tax refund"
                                placeholderTextColor={colors.muted}
                                value={note}
                                onChangeText={setNote}
                            />
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    )
}
