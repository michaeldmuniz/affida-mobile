import { useState, useEffect } from 'react'
import { Modal, View, Text, TouchableOpacity, ScrollView, Alert, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, CheckCircle, Clock, AlertCircle, ChevronRight } from 'lucide-react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { CategoryPicker } from '@/components/transactions/CategoryPicker'
import { AmountText } from '@/components/ui/AmountText'
import { haptics } from '@/lib/haptics'
import { colors } from '@/lib/colors'
import type { Receipt } from '@/lib/types'
import type { Category } from '@/lib/types'

interface Props {
    receipt: Receipt | null
    onClose: () => void
}

export function ReceiptDetailSheet({ receipt, onClose }: Props) {
    const queryClient = useQueryClient()
    const [lineItems, setLineItems] = useState<Receipt['lineItems']>([])
    const [pickingIndex, setPickingIndex] = useState<number | null>(null)

    useEffect(() => {
        if (receipt) setLineItems(receipt.lineItems)
    }, [receipt?.id])

    const { data: categories = [] } = useQuery<Category[]>({
        queryKey: ['categories'],
        queryFn: async () => (await apiClient.get('/categories')).data.data,
        staleTime: 5 * 60 * 1000,
        enabled: !!receipt,
    })

    const { mutate: saveLineItems } = useMutation({
        mutationFn: async (items: Receipt['lineItems']) => {
            await apiClient.patch(`/receipts/${receipt!.id}`, { lineItems: items })
        },
        onSuccess: () => {
            haptics.success()
            queryClient.invalidateQueries({ queryKey: ['receipts'] })
        },
        onError: () => Alert.alert('Error', 'Failed to save category change.'),
    })

    const { mutate: applySplit, isPending: isSplitting } = useMutation({
        mutationFn: async () => {
            await apiClient.post(`/receipts/${receipt!.id}/split`)
        },
        onSuccess: () => {
            haptics.success()
            queryClient.invalidateQueries({ queryKey: ['receipts'] })
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            onClose()
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to split transaction'
            Alert.alert('Error', msg)
        },
    })

    const handleApplySplit = () => {
        haptics.light()
        Alert.alert(
            'Split Transaction',
            'This will split the matched transaction into one entry per category from this receipt. This cannot be undone from here.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Split', onPress: () => applySplit() },
            ]
        )
    }

    if (!receipt) return null

    const currentItems = lineItems.length ? lineItems : receipt.lineItems

    const handleCategorySelect = (index: number, categoryId: string | null, categoryName: string | null) => {
        const updated = currentItems.map((item, i) =>
            i === index ? { ...item, categoryId, categoryName } : item
        )
        setLineItems(updated)
        setPickingIndex(null)
        saveLineItems(updated)
    }

    return (
        <Modal
                visible={!!receipt}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={onClose}
            >
                <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                    {/* Header */}
                    <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                        <TouchableOpacity onPress={onClose} hitSlop={8} className="w-8">
                            <X size={20} color={colors.muted} />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-brand-text text-base font-semibold">
                            Receipt Details
                        </Text>
                        <View className="w-8" />
                    </View>

                    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                        <View className="px-6 py-5 gap-y-4">
                            {receipt.imageUrl && (
                                <Image
                                    source={{ uri: receipt.imageUrl }}
                                    style={{ width: '100%', height: 360, borderRadius: 16, backgroundColor: '#111' }}
                                    resizeMode="contain"
                                />
                            )}

                            {/* Status banner */}
                            {receipt.status === 'matched' ? (
                                <View className="flex-row items-center gap-x-3 bg-brand-positive/10 border border-brand-positive/25 rounded-2xl px-4 py-3.5">
                                    <CheckCircle size={20} color={colors.positive} />
                                    <View className="flex-1">
                                        <Text className="text-brand-positive font-semibold text-sm">Matched</Text>
                                        <Text className="text-brand-positive/80 text-xs mt-0.5">
                                            Linked to {receipt.matchedTransaction?.merchantName ?? receipt.matchedTransaction?.description ?? 'a transaction'}
                                        </Text>
                                    </View>
                                </View>
                            ) : receipt.status === 'pending' ? (
                                <View className="flex-row items-center gap-x-3 bg-brand-accent/10 border border-brand-accent/25 rounded-2xl px-4 py-3.5">
                                    <Clock size={20} color={colors.accent} />
                                    <View className="flex-1">
                                        <Text className="text-brand-accent font-semibold text-sm">Pending Match</Text>
                                        <Text className="text-brand-accent/80 text-xs mt-0.5">
                                            Waiting to be matched to a transaction
                                        </Text>
                                    </View>
                                </View>
                            ) : (
                                <View className="flex-row items-center gap-x-3 bg-brand-elevated border border-brand-border rounded-2xl px-4 py-3.5">
                                    <AlertCircle size={20} color={colors.muted} />
                                    <View className="flex-1">
                                        <Text className="text-brand-text font-semibold text-sm">Unmatched</Text>
                                        <Text className="text-brand-muted text-xs mt-0.5">No matching transaction found</Text>
                                    </View>
                                </View>
                            )}

                            {/* Merchant + total */}
                            <View className="bg-brand-surface border border-brand-border rounded-2xl overflow-hidden">
                                <View className="px-4 py-3.5 border-b border-brand-border flex-row items-center justify-between">
                                    <View className="flex-1 pr-3">
                                        <Text className="text-brand-text font-semibold" numberOfLines={1}>
                                            {receipt.merchantName ?? 'Unknown Merchant'}
                                        </Text>
                                        {receipt.date && (
                                            <Text className="text-brand-muted text-xs mt-0.5">
                                                {new Date(receipt.date + 'T00:00:00').toLocaleDateString('en-US', {
                                                    month: 'short', day: 'numeric', year: 'numeric',
                                                })}
                                            </Text>
                                        )}
                                    </View>
                                    {receipt.total != null && (
                                        <AmountText amount={-receipt.total} size="md" showSign />
                                    )}
                                </View>

                                {/* Line items */}
                                {currentItems.length > 0 ? (
                                    currentItems.map((item, i) => (
                                        <TouchableOpacity
                                            key={i}
                                            className={`flex-row items-center px-4 py-3.5 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                                            onPress={() => { haptics.light(); setPickingIndex(i) }}
                                            activeOpacity={0.7}
                                        >
                                            <View className="flex-1 pr-3">
                                                <Text className="text-brand-text text-sm" numberOfLines={1}>
                                                    {item.description}
                                                </Text>
                                                <Text className="text-brand-accent text-xs mt-0.5">
                                                    {item.categoryName ?? 'Tap to categorize'}
                                                </Text>
                                            </View>
                                            <AmountText amount={-item.amount} size="sm" showSign />
                                            <ChevronRight size={14} color={colors.muted} strokeWidth={2} className="ml-2" />
                                        </TouchableOpacity>
                                    ))
                                ) : (
                                    <View className="px-4 py-4">
                                        <Text className="text-brand-muted text-sm">No line items parsed</Text>
                                    </View>
                                )}
                            </View>

                            {/* Apply split to matched transaction */}
                            {receipt.status === 'matched' && currentItems.length > 0 && (
                                receipt.splitApplied ? (
                                    <View className="flex-row items-center gap-x-3 bg-brand-positive/10 border border-brand-positive/25 rounded-2xl px-4 py-3.5">
                                        <CheckCircle size={20} color={colors.positive} />
                                        <View className="flex-1">
                                            <Text className="text-brand-positive font-semibold text-sm">Split Applied</Text>
                                            <Text className="text-brand-positive/80 text-xs mt-0.5">
                                                The transaction has been split by category
                                            </Text>
                                        </View>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        className="h-14 rounded-2xl bg-brand-accent items-center justify-center"
                                        onPress={handleApplySplit}
                                        disabled={isSplitting}
                                        activeOpacity={0.8}
                                    >
                                        <Text className="text-white font-semibold text-base">
                                            {isSplitting ? 'Splitting…' : 'Split Transaction by Category'}
                                        </Text>
                                    </TouchableOpacity>
                                )
                            )}
                        </View>
                    </ScrollView>

                    <CategoryPicker
                        visible={pickingIndex !== null}
                        categories={categories}
                        selectedId={pickingIndex !== null ? (currentItems[pickingIndex]?.categoryId ?? null) : null}
                        onSelect={(id, name) => {
                            if (pickingIndex !== null) handleCategorySelect(pickingIndex, id, name)
                        }}
                        onClose={() => setPickingIndex(null)}
                    />
                </SafeAreaView>
        </Modal>
    )
}
