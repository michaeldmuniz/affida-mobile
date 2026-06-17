import { useState, useEffect } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Check } from 'lucide-react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Budget, Category } from '@/lib/types'
import { colors } from '@/lib/colors'

interface Props {
    visible: boolean
    month: string
    existingBudgets: Budget[]
    onClose: () => void
}

export function AddBudgetSheet({ visible, month, existingBudgets, onClose }: Props) {
    const queryClient = useQueryClient()
    const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
    const [amount, setAmount] = useState('')

    const { data: categories = [] } = useQuery<Category[]>({
        queryKey: ['categories'],
        queryFn: async () => (await apiClient.get('/categories')).data.data,
        staleTime: 5 * 60 * 1000,
        enabled: visible,
    })

    // Only show expense categories that don't already have a budget this month
    const budgetedCategoryIds = new Set(existingBudgets.map(b => b.categoryId))
    const available = categories.filter(c => c.group === 'EXPENSE' && !budgetedCategoryIds.has(c.id))

    useEffect(() => {
        if (!visible) {
            setSelectedCategory(null)
            setAmount('')
        }
    }, [visible])

    const { mutate: save, isPending } = useMutation({
        mutationFn: async () => {
            if (!selectedCategory) throw new Error('Please select a category.')
            const parsed = parseFloat(amount)
            if (isNaN(parsed) || parsed < 0) throw new Error('Please enter a valid amount.')
            await apiClient.patch('/budgets', {
                categoryId: selectedCategory.id,
                month,
                amount: parsed,
                rollover: false,
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['budgets', month] })
            onClose()
        },
        onError: (e: any) => Alert.alert('Error', e.message ?? 'Failed to create budget.'),
    })

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

                    {/* Header */}
                    <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                        <TouchableOpacity onPress={onClose} hitSlop={8} className="w-8">
                            <X size={20} color={colors.muted} />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-brand-text text-base font-semibold">Add Budget</Text>
                        <TouchableOpacity onPress={() => save()} disabled={isPending || !selectedCategory} className="items-end" hitSlop={8}>
                            {isPending
                                ? <ActivityIndicator size="small" color={colors.accent} />
                                : <Text className={`font-semibold text-sm ${selectedCategory ? 'text-brand-accent' : 'text-brand-muted'}`}>Save</Text>
                            }
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        <View className="px-4 pt-5 pb-8 gap-y-5">

                            {/* Amount */}
                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">Budget Amount</Text>
                                <View className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 h-14">
                                    <Text className="text-brand-muted text-xl mr-1">$</Text>
                                    <TextInput
                                        className="flex-1 text-brand-text text-xl font-semibold"
                                        value={amount}
                                        onChangeText={setAmount}
                                        keyboardType="decimal-pad"
                                        placeholder="0"
                                        placeholderTextColor={colors.muted}
                                        selectTextOnFocus
                                        autoFocus
                                    />
                                </View>
                            </View>

                            {/* Category picker */}
                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">Category</Text>
                                {available.length === 0 ? (
                                    <View className="bg-brand-surface border border-brand-border rounded-xl px-4 py-5 items-center">
                                        <Text className="text-brand-muted text-sm text-center leading-relaxed">
                                            All expense categories already have a budget this month.
                                        </Text>
                                    </View>
                                ) : (
                                    <View className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
                                        {available.map((cat, i) => {
                                            const selected = selectedCategory?.id === cat.id
                                            return (
                                                <TouchableOpacity
                                                    key={cat.id}
                                                    className={`flex-row items-center px-4 py-3.5 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                                                    onPress={() => setSelectedCategory(cat)}
                                                    activeOpacity={0.7}
                                                >
                                                    <Text className={`flex-1 text-sm ${selected ? 'text-brand-accent font-medium' : 'text-brand-text'}`}>
                                                        {cat.name}
                                                    </Text>
                                                    {selected && <Check size={16} color={colors.accent} />}
                                                </TouchableOpacity>
                                            )
                                        })}
                                    </View>
                                )}
                            </View>

                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    )
}
