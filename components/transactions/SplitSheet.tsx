import { useEffect, useState } from 'react'
import {
    Modal, View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator,
    Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Plus, Trash2, Tag, ChevronRight } from 'lucide-react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { CategoryPicker } from './CategoryPicker'
import { colors } from '@/lib/colors'
import { haptics } from '@/lib/haptics'
import type { Transaction, Category } from '@/lib/types'

interface Row { amount: string; categoryId: string | null; categoryName: string | null; notes: string }

const blank = (): Row => ({ amount: '', categoryId: null, categoryName: null, notes: '' })
const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

interface Props {
    transaction: Transaction | null
    categories: Category[]
    onClose: () => void
    /** Called after the split is saved. */
    onSplit: () => void
}

/** Break one transaction into several categories. Same rules as the web Split dialog. */
export function SplitSheet({ transaction, categories, onClose, onSplit }: Props) {
    const queryClient = useQueryClient()
    const [rows, setRows] = useState<Row[]>([blank(), blank()])
    const [pickingFor, setPickingFor] = useState<number | null>(null)

    useEffect(() => {
        if (transaction) setRows([blank(), blank()])
    }, [transaction?.id])

    const { mutate: save, isPending } = useMutation({
        mutationFn: async (splits: { amount: number; categoryId: string | null; notes: string }[]) => {
            await apiClient.post(`/transactions/${transaction!.id}/split`, { splits })
        },
        onSuccess: () => {
            haptics.success()
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['transaction', transaction?.id] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            onSplit()
        },
        onError: (err: any) => {
            Alert.alert('Could not split', err?.response?.data?.error ?? 'Failed to split transaction.')
        },
    })

    if (!transaction) return null

    const original = Math.abs(transaction.amount)
    const total = rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
    // Compared in cents so 3.99 + 5.50 + 12.25 style sums don't land a hair off
    const remainingCents = Math.round(original * 100) - Math.round(total * 100)
    const remaining = remainingCents / 100

    const update = (i: number, patch: Partial<Row>) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r))

    const handleSave = () => {
        const valid = rows.filter(r => parseFloat(r.amount) > 0)
        if (valid.length === 0) return Alert.alert('Add an amount', 'Enter at least one split amount.')
        if (remainingCents < 0) return Alert.alert('Too much', `Split amounts exceed the original transaction (${money(original)}).`)
        if (remainingCents === 0 && valid.length < 2) {
            return Alert.alert('Needs two parts', 'To split a transaction it must be broken into at least two parts. To put the whole amount in one category, just edit the category.')
        }
        save(valid.map(r => ({ amount: parseFloat(r.amount), categoryId: r.categoryId, notes: r.notes.trim() })))
    }

    return (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8} className="w-8">
                            <X size={20} color={colors.muted} />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-brand-text text-base font-semibold">Split Transaction</Text>
                        <TouchableOpacity onPress={handleSave} disabled={isPending} hitSlop={8}>
                            {isPending
                                ? <ActivityIndicator size="small" color={colors.accent} />
                                : <Text className="text-brand-accent font-semibold text-sm">Save</Text>}
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        {/* The original */}
                        <View className="mx-4 mt-5 bg-brand-surface border border-brand-border rounded-xl px-4 py-3 flex-row items-center justify-between">
                            <Text className="flex-1 text-brand-text text-sm font-medium pr-3" numberOfLines={1}>
                                {transaction.merchantName ?? transaction.description}
                            </Text>
                            <View className="items-end">
                                <Text className="text-brand-text text-base font-semibold">{money(original)}</Text>
                                <Text className="text-brand-muted text-xs">Original amount</Text>
                            </View>
                        </View>

                        <View className="flex-row items-center justify-between px-4 pt-5 pb-2">
                            <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest">Splits</Text>
                            <Text className={`text-sm font-medium ${remainingCents === 0 ? 'text-brand-positive' : remainingCents < 0 ? 'text-brand-negative' : 'text-brand-muted'}`}>
                                Remaining {money(Math.abs(remaining))}
                            </Text>
                        </View>

                        {rows.map((r, i) => (
                            <View key={i} className="mx-4 mb-3 bg-brand-surface border border-brand-border rounded-xl p-3 gap-y-2.5">
                                <View className="flex-row items-center gap-x-2">
                                    <View className="flex-1 flex-row items-center bg-brand-bg border border-brand-border rounded-lg px-3 h-11">
                                        <Text className="text-brand-muted text-base mr-1">$</Text>
                                        <TextInput
                                            className="flex-1 text-brand-text text-base"
                                            value={r.amount}
                                            onChangeText={v => update(i, { amount: v })}
                                            keyboardType="decimal-pad"
                                            placeholder="0.00"
                                            placeholderTextColor={colors.muted}
                                            selectTextOnFocus
                                        />
                                        {r.amount === '' && remaining > 0 && (
                                            <TouchableOpacity onPress={() => update(i, { amount: remaining.toFixed(2) })} hitSlop={6}>
                                                <Text className="text-brand-accent text-xs font-medium">Remain</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    {rows.length > 2 && (
                                        <TouchableOpacity onPress={() => setRows(rs => rs.filter((_, idx) => idx !== i))} hitSlop={8} className="p-2">
                                            <Trash2 size={16} color={colors.negative} />
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <TouchableOpacity
                                    className="flex-row items-center bg-brand-bg border border-brand-border rounded-lg px-3 h-11"
                                    onPress={() => setPickingFor(i)}
                                    activeOpacity={0.7}
                                >
                                    <Tag size={14} color={colors.muted} style={{ marginRight: 8 }} />
                                    <Text className={`flex-1 text-base ${r.categoryName ? 'text-brand-text' : 'text-brand-muted'}`}>
                                        {r.categoryName ?? 'Uncategorized'}
                                    </Text>
                                    <ChevronRight size={15} color={colors.muted} />
                                </TouchableOpacity>
                                <TextInput
                                    className="bg-brand-bg border border-brand-border rounded-lg px-3 h-11 text-brand-text text-base"
                                    value={r.notes}
                                    onChangeText={v => update(i, { notes: v })}
                                    placeholder="Notes (optional)"
                                    placeholderTextColor={colors.muted}
                                />
                            </View>
                        ))}

                        <TouchableOpacity
                            className="mx-4 h-11 rounded-xl border border-brand-border flex-row items-center justify-center gap-x-1.5"
                            onPress={() => setRows(rs => [...rs, blank()])}
                            activeOpacity={0.7}
                        >
                            <Plus size={15} color={colors.muted} />
                            <Text className="text-brand-muted text-sm font-medium">Add another split</Text>
                        </TouchableOpacity>
                        <View className="h-10" />
                    </ScrollView>
                </KeyboardAvoidingView>

                <CategoryPicker
                    visible={pickingFor !== null}
                    categories={categories}
                    selectedId={pickingFor !== null ? rows[pickingFor]?.categoryId ?? null : null}
                    onSelect={(id, name) => { if (pickingFor !== null) update(pickingFor, { categoryId: id, categoryName: name }) }}
                    onClose={() => setPickingFor(null)}
                />
            </SafeAreaView>
        </Modal>
    )
}
