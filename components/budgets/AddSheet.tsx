import { useState } from 'react'
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, ChevronRight } from 'lucide-react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { CategoryPicker } from '@/components/transactions/CategoryPicker'
import { haptics } from '@/lib/haptics'
import type { Budget, Category } from '@/lib/types'

interface Props {
    visible: boolean
    month: string
    existingBudgets: Budget[]
    onClose: () => void
}

export function BudgetAddSheet({ visible, month, existingBudgets, onClose }: Props) {
    const queryClient = useQueryClient()
    const [category, setCategory] = useState<Category | null>(null)
    const [amount, setAmount] = useState('')
    const [rollover, setRollover] = useState(false)
    const [showCategoryPicker, setShowCategoryPicker] = useState(false)

    const { data: categories } = useQuery<Category[]>({
        queryKey: ['categories'],
        queryFn: async () => (await apiClient.get('/categories')).data.data,
        enabled: visible,
        staleTime: 10 * 60 * 1000,
    })

    // Only expense categories that don't already have a budget this month
    const budgetedIds = new Set(existingBudgets.map((b) => b.categoryId))
    const available = (categories ?? []).filter(
        (c) => c.group === 'EXPENSE' && !budgetedIds.has(c.id)
    )

    const reset = () => {
        setCategory(null)
        setAmount('')
        setRollover(false)
    }

    const close = () => {
        reset()
        onClose()
    }

    const { mutate: save, isPending } = useMutation({
        mutationFn: async () => {
            const parsed = parseFloat(amount)
            if (!category) throw new Error('CATEGORY')
            if (isNaN(parsed) || parsed <= 0) throw new Error('AMOUNT')
            await apiClient.patch('/budgets', {
                categoryId: category.id,
                month,
                amount: parsed,
                rollover,
            })
        },
        onSuccess: () => {
            haptics.success()
            queryClient.invalidateQueries({ queryKey: ['budgets', month] })
            close()
        },
        onError: (e: any) => {
            haptics.error()
            if (e.message === 'CATEGORY') Alert.alert('Missing category', 'Choose a category to budget.')
            else if (e.message === 'AMOUNT') Alert.alert('Invalid amount', 'Enter an amount greater than zero.')
            else Alert.alert('Error', 'Failed to create budget. Please try again.')
        },
    })

    if (!visible) return null

    return (
        <Modal visible animationType="slide" presentationStyle="formSheet" onRequestClose={close}>
            <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                <KeyboardAvoidingView
                    className="flex-1"
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    {/* Header */}
                    <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                        <TouchableOpacity onPress={close} hitSlop={8} className="w-8">
                            <X size={20} color="#6B7280" />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-brand-text text-base font-semibold">
                            New Budget
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
                        {/* Category */}
                        <View>
                            <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">
                                Category
                            </Text>
                            <TouchableOpacity
                                className="flex-row items-center justify-between bg-brand-surface border border-brand-border rounded-xl px-4 h-14"
                                onPress={() => { haptics.light(); setShowCategoryPicker(true) }}
                                activeOpacity={0.7}
                            >
                                <Text className={category ? 'text-brand-text text-base' : 'text-brand-muted text-base'}>
                                    {category?.name ?? 'Choose category'}
                                </Text>
                                <ChevronRight size={16} color="#6B7280" />
                            </TouchableOpacity>
                        </View>

                        {/* Amount */}
                        <View>
                            <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">
                                Monthly Amount
                            </Text>
                            <View className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 h-14">
                                <Text className="text-brand-muted text-xl mr-1">$</Text>
                                <TextInput
                                    className="flex-1 text-brand-text text-xl font-semibold"
                                    placeholder="500"
                                    placeholderTextColor="#6B7280"
                                    value={amount}
                                    onChangeText={setAmount}
                                    keyboardType="decimal-pad"
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
                                onValueChange={(v) => { haptics.light(); setRollover(v) }}
                                trackColor={{ false: '#2A2A38', true: '#5B7BF8' }}
                                thumbColor="#fff"
                            />
                        </View>
                    </View>

                    <CategoryPicker
                        visible={showCategoryPicker}
                        categories={available}
                        selectedId={category?.id ?? null}
                        onSelect={(id) => {
                            setCategory(id ? available.find((c) => c.id === id) ?? null : null)
                            setShowCategoryPicker(false)
                        }}
                        onClose={() => setShowCategoryPicker(false)}
                    />
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    )
}
