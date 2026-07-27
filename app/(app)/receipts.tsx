import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Image, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ArrowLeft, ReceiptText, Link2, Trash2 } from 'lucide-react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Card } from '@/components/ui/Card'
import { LinkTransactionSheet } from '@/components/receipts/LinkTransactionSheet'
import { ReceiptDetailSheet } from '@/components/receipts/ReceiptDetailSheet'
import { haptics } from '@/lib/haptics'
import { colors } from '@/lib/colors'
import type { Receipt } from '@/lib/types'

export default function ReceiptsScreen() {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [linking, setLinking] = useState<Receipt | null>(null)
    const [detailing, setDetailing] = useState<Receipt | null>(null)

    const { data: receipts = [], isLoading, isRefetching, refetch } = useQuery<Receipt[]>({
        queryKey: ['receipts', 'pending'],
        queryFn: async () => {
            const res = await apiClient.get('/receipts', { params: { status: 'pending' } })
            return res.data.data ?? []
        },
        staleTime: 30 * 1000,
    })

    const { mutate: dismiss } = useMutation({
        mutationFn: async (id: string) => apiClient.delete(`/receipts/${id}`),
        onSuccess: () => {
            haptics.light()
            queryClient.invalidateQueries({ queryKey: ['receipts'] })
        },
        onError: () => Alert.alert('Error', 'Failed to dismiss receipt.'),
    })

    const handleDismiss = (receipt: Receipt) => {
        Alert.alert('Dismiss Receipt', 'Remove this receipt from the pending list?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Dismiss', style: 'destructive', onPress: () => dismiss(receipt.id) },
        ])
    }

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            {/* Header */}
            <View className="flex-row items-center px-4 pt-4 pb-3 gap-x-3">
                <TouchableOpacity onPress={() => router.back()} hitSlop={8}>
                    <ArrowLeft size={22} color={colors.text} strokeWidth={1.8} />
                </TouchableOpacity>
                <Text className="text-brand-text text-2xl font-bold flex-1">Pending Receipts</Text>
            </View>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
                }
            >
                <View className="px-6 gap-y-4 pb-8">
                    {isLoading ? (
                        <ReceiptsSkeleton />
                    ) : receipts.length === 0 ? (
                        <EmptyState />
                    ) : (
                        <>
                            <Text className="text-brand-muted text-sm">
                                {receipts.length} {receipts.length === 1 ? 'receipt' : 'receipts'} waiting to be matched
                            </Text>
                            {receipts.map((receipt) => (
                                <ReceiptCard
                                    key={receipt.id}
                                    receipt={receipt}
                                    onPress={() => { haptics.light(); setDetailing(receipt) }}
                                    onLink={() => { haptics.light(); setLinking(receipt) }}
                                    onDismiss={() => handleDismiss(receipt)}
                                />
                            ))}
                        </>
                    )}
                </View>
            </ScrollView>

            <LinkTransactionSheet receipt={linking} onClose={() => setLinking(null)} />
            <ReceiptDetailSheet receipt={detailing} onClose={() => setDetailing(null)} />
        </SafeAreaView>
    )
}

function ReceiptCard({
    receipt,
    onPress,
    onLink,
    onDismiss,
}: {
    receipt: Receipt
    onPress: () => void
    onLink: () => void
    onDismiss: () => void
}) {
    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <Card className="overflow-hidden p-0">
            <View className="flex-row">
                {receipt.imageUrl ? (
                    <Image
                        source={{ uri: receipt.imageUrl }}
                        style={{ width: 80, height: 96, resizeMode: 'cover' }}
                    />
                ) : (
                    <View className="bg-brand-elevated items-center justify-center" style={{ width: 80, height: 96 }}>
                        <ReceiptText size={24} color={colors.muted} strokeWidth={1.5} />
                    </View>
                )}
                <View className="flex-1 px-4 py-3 justify-between">
                    <View className="gap-y-0.5">
                        <Text className="text-brand-text font-semibold text-sm" numberOfLines={1}>
                            {receipt.merchantName ?? 'Unknown Merchant'}
                        </Text>
                        <Text className="text-brand-muted text-xs">
                            {receipt.date
                                ? new Date(receipt.date + 'T00:00:00').toLocaleDateString('en-US', {
                                    month: 'short', day: 'numeric', year: 'numeric',
                                })
                                : 'Unknown date'}
                            {receipt.total != null ? ` · $${receipt.total.toFixed(2)}` : ''}
                        </Text>
                        {receipt.lineItems.length > 0 && (
                            <Text className="text-brand-muted text-xs">
                                {receipt.lineItems.length} {receipt.lineItems.length === 1 ? 'item' : 'items'}
                            </Text>
                        )}
                    </View>
                    <View className="flex-row gap-x-2 mt-3">
                        <TouchableOpacity
                            className="flex-1 h-8 rounded-lg bg-brand-accent items-center justify-center flex-row gap-x-1.5"
                            onPress={onLink}
                            activeOpacity={0.8}
                        >
                            <Link2 size={13} color="#fff" strokeWidth={2} />
                            <Text className="text-white text-xs font-semibold">Link</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            className="w-8 h-8 rounded-lg bg-brand-surface border border-brand-border items-center justify-center"
                            onPress={onDismiss}
                            activeOpacity={0.8}
                        >
                            <Trash2 size={14} color={colors.muted} strokeWidth={1.8} />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Card>
        </TouchableOpacity>
    )
}

function ReceiptsSkeleton() {
    return (
        <View className="gap-y-4">
            {[1, 2].map((i) => (
                <Card key={i} className="p-0 overflow-hidden">
                    <View className="flex-row">
                        <View className="bg-brand-elevated" style={{ width: 80, height: 96 }} />
                        <View className="flex-1 px-4 py-3 gap-y-2">
                            <View className="h-3.5 w-28 bg-brand-elevated rounded" />
                            <View className="h-2.5 w-36 bg-brand-elevated rounded" />
                            <View className="h-2.5 w-16 bg-brand-elevated rounded" />
                        </View>
                    </View>
                </Card>
            ))}
        </View>
    )
}

function EmptyState() {
    return (
        <View className="items-center py-16">
            <View className="w-14 h-14 rounded-2xl bg-brand-surface border border-brand-border items-center justify-center mb-4">
                <ReceiptText size={24} color={colors.muted} strokeWidth={1.5} />
            </View>
            <Text className="text-brand-text font-semibold mb-1">No pending receipts</Text>
            <Text className="text-brand-muted text-sm text-center leading-relaxed px-8">
                Receipts that couldn't be automatically matched will appear here.
            </Text>
        </View>
    )
}
