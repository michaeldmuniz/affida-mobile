import { useState, useMemo } from 'react'
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Search } from 'lucide-react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { AmountText } from '@/components/ui/AmountText'
import { haptics } from '@/lib/haptics'
import { colors } from '@/lib/colors'
import type { Receipt, Transaction, PaginatedResponse } from '@/lib/types'

interface Props {
    receipt: Receipt | null
    onClose: () => void
}

export function LinkTransactionSheet({ receipt, onClose }: Props) {
    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')

    const { data: transactions = [], isLoading } = useQuery<Transaction[]>({
        queryKey: ['transactions-for-linking', receipt?.id, receipt?.date],
        queryFn: async () => {
            const params: Record<string, string> = {
                limit: '100',
                page: '1',
                sort: 'date',
                order: 'desc',
            }
            // Narrow to within ±7 days of the receipt date when we have one
            if (receipt?.date) {
                const d = new Date(receipt.date + 'T00:00:00')
                const from = new Date(d)
                from.setDate(from.getDate() - 7)
                const to = new Date(d)
                to.setDate(to.getDate() + 3)
                params.startDate = from.toISOString()
                params.endDate = to.toISOString()
            }
            const res = await apiClient.get('/transactions', { params })
            const page = res.data.data as PaginatedResponse<Transaction>
            return page.items
        },
        enabled: !!receipt,
        staleTime: 30 * 1000,
    })

    const filtered = useMemo(() => {
        if (!search.trim()) return transactions
        const q = search.toLowerCase()
        return transactions.filter((tx) =>
            (tx.merchantName ?? tx.description).toLowerCase().includes(q)
        )
    }, [transactions, search])

    const { mutate: link, isPending } = useMutation({
        mutationFn: async (transactionId: string) => {
            await apiClient.patch(`/receipts/${receipt!.id}`, { transactionId })
        },
        onSuccess: () => {
            haptics.success()
            queryClient.invalidateQueries({ queryKey: ['receipts'] })
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            onClose()
        },
        onError: () => {
            Alert.alert('Error', 'Failed to link receipt. Please try again.')
        },
    })

    const handleClose = () => {
        setSearch('')
        onClose()
    }

    if (!receipt) return null

    const receiptLabel = [
        receipt.merchantName ?? 'Unknown',
        receipt.date
            ? new Date(receipt.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : null,
        receipt.total != null ? `$${receipt.total.toFixed(2)}` : null,
    ].filter(Boolean).join(' · ')

    return (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
            <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                {/* Header */}
                <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                    <TouchableOpacity onPress={handleClose} hitSlop={8} className="w-8">
                        <X size={20} color={colors.muted} />
                    </TouchableOpacity>
                    <Text className="flex-1 text-center text-brand-text text-base font-semibold">
                        Link to Transaction
                    </Text>
                    <View className="w-8" />
                </View>

                {/* Receipt context + search */}
                <View className="px-4 pt-3 pb-2 border-b border-brand-border gap-y-2.5">
                    <Text className="text-brand-muted text-xs" numberOfLines={1}>
                        Receipt: {receiptLabel}
                    </Text>
                    <View className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-3.5 h-11 gap-x-2">
                        <Search size={16} color={colors.muted} strokeWidth={1.8} />
                        <TextInput
                            className="flex-1 text-brand-text text-sm"
                            placeholder="Search transactions..."
                            placeholderTextColor={colors.muted}
                            value={search}
                            onChangeText={setSearch}
                            autoCorrect={false}
                        />
                    </View>
                    {receipt.date && (
                        <Text className="text-brand-muted text-xs">
                            Showing transactions within 7 days of the receipt date
                        </Text>
                    )}
                </View>

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <View className="px-4 py-3 gap-y-2 pb-8">
                        {isLoading ? (
                            <View className="py-12 items-center">
                                <ActivityIndicator color={colors.accent} />
                            </View>
                        ) : filtered.length === 0 ? (
                            <View className="py-12 items-center gap-y-2">
                                <Text className="text-brand-muted text-sm">No transactions found</Text>
                                {search.length === 0 && (
                                    <Text className="text-brand-muted text-xs text-center px-8">
                                        Try pulling to refresh on the Transactions screen to sync the latest data, then come back.
                                    </Text>
                                )}
                            </View>
                        ) : (
                            filtered.map((tx) => (
                                <TouchableOpacity
                                    key={tx.id}
                                    className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 py-3.5"
                                    onPress={() => { haptics.light(); link(tx.id) }}
                                    disabled={isPending}
                                    activeOpacity={0.7}
                                >
                                    <View className="flex-1 pr-3">
                                        <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>
                                            {tx.merchantName ?? tx.description}
                                        </Text>
                                        <Text className="text-brand-muted text-xs mt-0.5">
                                            {new Date(tx.date.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', {
                                                month: 'short', day: 'numeric',
                                            })} · {tx.categoryName ?? 'Uncategorized'} · {tx.accountName}
                                        </Text>
                                    </View>
                                    {isPending
                                        ? <ActivityIndicator size="small" color={colors.accent} />
                                        : <AmountText amount={tx.amount} size="sm" showSign />
                                    }
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                </ScrollView>
            </SafeAreaView>
        </Modal>
    )
}
