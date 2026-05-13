import { useState, useEffect } from 'react'
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Budget } from '@/lib/types'

interface Props {
    budget: Budget | null
    month: string
    onClose: () => void
}

export function BudgetEditSheet({ budget, month, onClose }: Props) {
    const queryClient = useQueryClient()
    const [amount, setAmount] = useState('')
    const [rollover, setRollover] = useState(false)

    useEffect(() => {
        if (budget) {
            setAmount(budget.amount.toFixed(0))
            setRollover(budget.rollover ?? false)
        }
    }, [budget])

    const { mutate: save, isPending } = useMutation({
        mutationFn: async () => {
            if (!budget) return
            const parsed = parseFloat(amount)
            if (isNaN(parsed) || parsed < 0) throw new Error('Invalid amount')
            await apiClient.patch('/budgets', {
                categoryId: budget.categoryId,
                month,
                amount: parsed,
                rollover,
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets', month] })
            onClose()
        },
        onError: (e: any) => {
            Alert.alert('Error', e.message === 'Invalid amount' ? 'Please enter a valid amount.' : 'Failed to save. Please try again.')
        },
    })

    const handleDelete = () => {
        Alert.alert('Remove Budget', `Remove the budget for ${budget?.categoryName}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive', onPress: async () => {
                    try {
                        await apiClient.delete('/budgets', { data: { id: budget!.id } })
                        queryClient.invalidateQueries({ queryKey: ['budgets', month] })
                        onClose()
                    } catch {
                        Alert.alert('Error', 'Failed to remove budget.')
                    }
                },
            },
        ])
    }

    if (!budget) return null

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
                            <X size={20} color="#6B7280" />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-brand-text text-base font-semibold" numberOfLines={1}>
                            {budget.categoryName}
                        </Text>
                        <TouchableOpacity
                            onPress={() => save()}
                            disabled={isPending}
                            className="items-end"
                            hitSlop={8}
                        >
                            {isPending
                                ? <ActivityIndicator size="small" color="#5B7BF8" />
                                : <Text className="text-brand-accent font-semibold text-sm">Save</Text>
                            }
                        </TouchableOpacity>
                    </View>

                    <View className="px-4 pt-6 gap-y-5 flex-1">
                        {/* Spent summary */}
                        <View className="flex-row bg-brand-surface border border-brand-border rounded-2xl overflow-hidden">
                            <View className="flex-1 items-center py-4 border-r border-brand-border">
                                <Text className="text-brand-muted text-xs uppercase tracking-widest mb-1">Spent</Text>
                                <Text className="text-brand-text text-lg font-bold">
                                    ${budget.spent.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                                </Text>
                            </View>
                            <View className="flex-1 items-center py-4">
                                <Text className="text-brand-muted text-xs uppercase tracking-widest mb-1">Remaining</Text>
                                <Text className={`text-lg font-bold ${budget.remaining < 0 ? 'text-brand-negative' : 'text-brand-text'}`}>
                                    ${Math.abs(budget.remaining).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                                </Text>
                            </View>
                        </View>

                        {/* Amount */}
                        <View>
                            <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">
                                Budget Amount
                            </Text>
                            <View className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 h-14">
                                <Text className="text-brand-muted text-xl mr-1">$</Text>
                                <TextInput
                                    className="flex-1 text-brand-text text-xl font-semibold"
                                    value={amount}
                                    onChangeText={setAmount}
                                    keyboardType="decimal-pad"
                                    selectTextOnFocus
                                    autoFocus
                                />
                            </View>
                        </View>

                        {/* Rollover */}
                        <View className="flex-row items-center justify-between bg-brand-surface border border-brand-border rounded-xl px-4 h-14">
                            <View>
                                <Text className="text-brand-text text-sm font-medium">Roll over unused funds</Text>
                                <Text className="text-brand-muted text-xs mt-0.5">Add leftover to next month's budget</Text>
                            </View>
                            <Switch
                                value={rollover}
                                onValueChange={setRollover}
                                trackColor={{ false: '#2A2A38', true: '#5B7BF8' }}
                                thumbColor="#fff"
                            />
                        </View>

                        {/* Remove budget */}
                        <TouchableOpacity
                            className="h-12 rounded-xl border border-brand-negative/30 items-center justify-center mt-2"
                            onPress={handleDelete}
                            activeOpacity={0.7}
                        >
                            <Text className="text-brand-negative text-sm font-medium">Remove Budget</Text>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    )
}
