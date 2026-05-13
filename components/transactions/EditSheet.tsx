import { useState, useEffect } from 'react'
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Flag, ChevronRight, Tag, Zap } from 'lucide-react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { CategoryPicker } from './CategoryPicker'
import type { Transaction, Category } from '@/lib/types'

interface EditState {
    merchantName: string
    categoryId: string | null
    categoryName: string | null
    notes: string
    flagged: boolean
    amount: string
}

interface Props {
    transaction: Transaction | null
    onClose: () => void
}

export function EditSheet({ transaction, onClose }: Props) {
    const queryClient = useQueryClient()
    const [form, setForm] = useState<EditState | null>(null)
    const [showCategoryPicker, setShowCategoryPicker] = useState(false)
    const [createRule, setCreateRule] = useState(false)

    useEffect(() => {
        setCreateRule(false)
        if (transaction) {
            setForm({
                merchantName: transaction.merchantName ?? transaction.description,
                categoryId: transaction.categoryId,
                categoryName: transaction.categoryName,
                notes: transaction.notes ?? '',
                flagged: transaction.flagged,
                amount: Math.abs(transaction.amount).toFixed(2),
            })
        }
    }, [transaction])

    const { data: categories = [] } = useQuery<Category[]>({
        queryKey: ['categories'],
        queryFn: async () => {
            const res = await apiClient.get('/categories')
            return res.data.data
        },
        enabled: !!transaction,
        staleTime: 5 * 60 * 1000,
    })

    const { mutate: save, isPending } = useMutation({
        mutationFn: async () => {
            if (!transaction || !form) return
            const payload: Record<string, unknown> = {
                merchantName: form.merchantName.trim() || undefined,
                categoryId: form.categoryId,
                notes: form.notes.trim() || null,
                flagged: form.flagged,
            }
            if (transaction.isManual) {
                const parsed = parseFloat(form.amount)
                if (!isNaN(parsed)) {
                    payload.amount = transaction.amount < 0 ? -Math.abs(parsed) : Math.abs(parsed)
                }
            }
            await apiClient.patch(`/transactions/${transaction.id}`, payload)
            if (createRule && form.merchantName.trim() && form.categoryId) {
                await apiClient.post('/rules', {
                    containsText: form.merchantName.trim(),
                    categoryId: form.categoryId,
                })
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            if (createRule) queryClient.invalidateQueries({ queryKey: ['rules'] })
            onClose()
        },
        onError: () => {
            Alert.alert('Error', 'Failed to save changes. Please try again.')
        },
    })

    const handleDelete = () => {
        Alert.alert('Delete Transaction', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await apiClient.delete(`/transactions/${transaction!.id}`)
                        queryClient.invalidateQueries({ queryKey: ['transactions'] })
                        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
                        onClose()
                    } catch {
                        Alert.alert('Error', 'Failed to delete transaction.')
                    }
                }
            },
        ])
    }

    if (!transaction || !form) return null

    return (
        <>
            <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
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
                                Edit Transaction
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

                        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

                            {/* Amount (manual only) */}
                            {transaction.isManual && (
                                <View className="px-4 pt-6 pb-2">
                                    <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">Amount</Text>
                                    <View className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 h-12">
                                        <Text className="text-brand-muted text-base mr-1">$</Text>
                                        <TextInput
                                            className="flex-1 text-brand-text text-base"
                                            value={form.amount}
                                            onChangeText={v => setForm(f => f ? { ...f, amount: v } : f)}
                                            keyboardType="decimal-pad"
                                            selectTextOnFocus
                                        />
                                    </View>
                                </View>
                            )}

                            {/* Merchant */}
                            <View className="px-4 pt-5 pb-2">
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">Merchant</Text>
                                <View className="bg-brand-surface border border-brand-border rounded-xl px-4 h-12 justify-center">
                                    <TextInput
                                        className="text-brand-text text-base"
                                        value={form.merchantName}
                                        onChangeText={v => setForm(f => f ? { ...f, merchantName: v } : f)}
                                        placeholder="Merchant name"
                                        placeholderTextColor="#6B7280"
                                    />
                                </View>
                            </View>

                            {/* Category */}
                            <View className="px-4 pt-5 pb-2">
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">Category</Text>
                                <TouchableOpacity
                                    className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 h-12"
                                    onPress={() => setShowCategoryPicker(true)}
                                    activeOpacity={0.7}
                                >
                                    <Tag size={15} color="#6B7280" style={{ marginRight: 8 }} />
                                    <Text className={`flex-1 text-base ${form.categoryName ? 'text-brand-text' : 'text-brand-muted'}`}>
                                        {form.categoryName ?? 'Uncategorized'}
                                    </Text>
                                    <ChevronRight size={16} color="#6B7280" />
                                </TouchableOpacity>
                            </View>

                            {/* Auto-rule toggle */}
                            {form.categoryId && form.merchantName.trim() && (
                                <View className="px-4 pt-3 pb-1">
                                    <TouchableOpacity
                                        className={`flex-row items-center gap-x-3 bg-brand-surface border rounded-xl px-4 h-12 ${createRule ? 'border-brand-accent/40' : 'border-brand-border'}`}
                                        onPress={() => setCreateRule(r => !r)}
                                        activeOpacity={0.7}
                                    >
                                        <Zap size={16} color={createRule ? '#5B7BF8' : '#6B7280'} fill={createRule ? '#5B7BF8' : 'none'} />
                                        <Text className={`flex-1 text-sm ${createRule ? 'text-brand-accent' : 'text-brand-muted'}`} numberOfLines={1}>
                                            Always categorize "{form.merchantName.trim()}" as {form.categoryName}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            {/* Notes */}
                            <View className="px-4 pt-5 pb-2">
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">Notes</Text>
                                <View className="bg-brand-surface border border-brand-border rounded-xl px-4 py-3 min-h-20">
                                    <TextInput
                                        className="text-brand-text text-base"
                                        value={form.notes}
                                        onChangeText={v => setForm(f => f ? { ...f, notes: v } : f)}
                                        placeholder="Add a note..."
                                        placeholderTextColor="#6B7280"
                                        multiline
                                        textAlignVertical="top"
                                    />
                                </View>
                            </View>

                            {/* Flag */}
                            <View className="px-4 pt-5 pb-2">
                                <TouchableOpacity
                                    className={`flex-row items-center gap-x-3 bg-brand-surface border rounded-xl px-4 h-12 ${form.flagged ? 'border-red-400/40' : 'border-brand-border'}`}
                                    onPress={() => setForm(f => f ? { ...f, flagged: !f.flagged } : f)}
                                    activeOpacity={0.7}
                                >
                                    <Flag
                                        size={16}
                                        color={form.flagged ? '#F87171' : '#6B7280'}
                                        fill={form.flagged ? '#F87171' : 'none'}
                                    />
                                    <Text className={`text-base ${form.flagged ? 'text-red-400' : 'text-brand-muted'}`}>
                                        {form.flagged ? 'Flagged' : 'Flag transaction'}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* Delete (manual only) */}
                            {transaction.isManual && (
                                <View className="px-4 pt-6 pb-2">
                                    <TouchableOpacity
                                        className="h-12 rounded-xl border border-brand-negative/30 items-center justify-center"
                                        onPress={handleDelete}
                                        activeOpacity={0.7}
                                    >
                                        <Text className="text-brand-negative text-sm font-medium">Delete Transaction</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View className="h-8" />
                        </ScrollView>
                    </KeyboardAvoidingView>
                </SafeAreaView>

                <CategoryPicker
                    visible={showCategoryPicker}
                    categories={categories}
                    selectedId={form.categoryId}
                    onSelect={(id, name) => setForm(f => f ? { ...f, categoryId: id, categoryName: name } : f)}
                    onClose={() => setShowCategoryPicker(false)}
                />
            </Modal>
        </>
    )
}
