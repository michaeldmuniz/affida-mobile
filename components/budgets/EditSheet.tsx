import { useState, useEffect } from 'react'
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    ActivityIndicator, KeyboardAvoidingView, Platform, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Budget } from '@/lib/types'
import { colors } from '@/lib/colors'

/** Whole dollars when exact, otherwise always two decimals ($71.10, never $71.1). */
function dollars(n: number) {
    const d = Number.isInteger(n) ? 0 : 2
    return `$${n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`
}

interface Props {
    budget: Budget | null
    month: string
    onClose: () => void
}

export function BudgetEditSheet({ budget, month, onClose }: Props) {
    const queryClient = useQueryClient()
    const [amount, setAmount] = useState('')
    const [rollover, setRollover] = useState(false)
    const [confirmingDisable, setConfirmingDisable] = useState(false)
    const [disableError, setDisableError] = useState<string | null>(null)
    const [saveError, setSaveError] = useState<string | null>(null)

    useEffect(() => {
        if (budget) {
            setAmount(budget.amount.toFixed(0))
            setRollover(budget.rollover ?? false)
        }
        setConfirmingDisable(false)
        setDisableError(null)
        setSaveError(null)
    }, [budget])

    const followsRule = budget?.method === 'AVERAGE_3_MONTHS' || budget?.method === 'PREVIOUS_MONTH'

    const { mutate: save, isPending } = useMutation({
        mutationFn: async () => {
            if (!budget) return
            setSaveError(null)
            const parsed = parseFloat(amount)
            if (isNaN(parsed) || parsed < 0) throw new Error('Invalid amount')
            await apiClient.patch('/budgets', {
                categoryId: budget.categoryId,
                month,
                amount: parsed,
                rollover,
                // A budget that follows a rule would ignore the number typed here,
                // so changing the amount makes it a fixed amount.
                ...(followsRule && parsed !== budget.amount && { method: 'MANUAL' }),
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets', month] })
            onClose()
        },
        // Inline, not a native Alert: an Alert over this Modal can crash the app on iOS.
        onError: (e: any) => {
            setSaveError(e.message === 'Invalid amount' ? 'Please enter a valid amount.' : 'Failed to save. Please try again.')
        },
    })

    // Disables from this month on (the web's "stop using"): the amount and earlier months are
    // kept, and it can be turned back on from "Disabled budgets" on the Budgets screen.
    const { mutate: disable, isPending: isDisabling } = useMutation({
        mutationFn: async () => {
            await apiClient.post('/budgets/inactive', { categoryId: budget!.categoryId, fromMonth: month })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            onClose()
        },
        onError: () => setDisableError('Could not disable this budget. Please try again.'),
    })

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
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8} className="w-8">
                            <X size={20} color={colors.muted} />
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
                                ? <ActivityIndicator size="small" color={colors.accent} />
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
                                    {dollars(budget.spent)}
                                </Text>
                            </View>
                            <View className="flex-1 items-center py-4">
                                <Text className="text-brand-muted text-xs uppercase tracking-widest mb-1">Remaining</Text>
                                <Text className={`text-lg font-bold ${budget.remaining < 0 ? 'text-brand-negative' : 'text-brand-text'}`}>
                                    {dollars(Math.abs(budget.remaining))}
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
                            {followsRule && (
                                <Text className="text-brand-muted text-xs mt-2 leading-relaxed">
                                    This budget follows {budget.method === 'PREVIOUS_MONTH' ? 'last month' : 'the average of the last 3 months'}. Changing the amount makes it a fixed amount.
                                </Text>
                            )}
                            {saveError && <Text className="text-red-400 text-xs mt-2">{saveError}</Text>}
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
                                trackColor={{ false: colors.disabled, true: colors.accent }}
                                thumbColor="#fff"
                            />
                        </View>

                        {/* Disable budget — also for a category with spending but no budget set */}
                        {!confirmingDisable && (
                            <TouchableOpacity
                                className="h-12 rounded-xl border border-brand-negative/30 items-center justify-center mt-2"
                                onPress={() => { setDisableError(null); setConfirmingDisable(true) }}
                                activeOpacity={0.7}
                            >
                                <Text className="text-brand-negative text-sm font-medium">Disable Budget</Text>
                            </TouchableOpacity>
                        )}
                        {confirmingDisable && (
                            <View className="rounded-xl border border-brand-border bg-brand-surface p-4 mt-2 gap-y-3">
                                <Text className="text-brand-text text-sm leading-relaxed">
                                    Disable the {budget.categoryName} budget from this month on? It will stop showing in
                                    your budgets. Your spending isn't deleted, earlier months stay as they were, and you
                                    can turn it back on any time under "Disabled budgets".
                                </Text>
                                {disableError && <Text className="text-brand-negative text-sm">{disableError}</Text>}
                                <View className="flex-row gap-x-2">
                                    <TouchableOpacity
                                        className="flex-1 h-11 rounded-xl border border-brand-border items-center justify-center"
                                        onPress={() => setConfirmingDisable(false)}
                                        disabled={isDisabling}
                                        activeOpacity={0.7}
                                    >
                                        <Text className="text-brand-text text-sm font-medium">Cancel</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        className="flex-1 h-11 rounded-xl bg-brand-negative/15 border border-brand-negative/30 items-center justify-center"
                                        onPress={() => disable()}
                                        disabled={isDisabling}
                                        activeOpacity={0.7}
                                    >
                                        {isDisabling
                                            ? <ActivityIndicator size="small" color={colors.negative} />
                                            : <Text className="text-brand-negative text-sm font-semibold">Disable</Text>
                                        }
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    )
}
