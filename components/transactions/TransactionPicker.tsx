import { useEffect, useState } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Search } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { AmountText } from '@/components/ui/AmountText'
import { colors } from '@/lib/colors'
import { shortDay } from '@/lib/format'
import type { Transaction } from '@/lib/types'

interface Props {
    visible: boolean
    title: string
    /** The transaction being edited: left out of the list. */
    excludeId: string
    onPick: (tx: Transaction) => void
    onClose: () => void
}

/** Search your transactions and pick one (to link as the same purchase, or as the charge a refund is for). */
export function TransactionPicker({ visible, title, excludeId, onPick, onClose }: Props) {
    const [text, setText] = useState('')
    const [search, setSearch] = useState('')

    // Wait for a pause in typing before asking the server
    useEffect(() => {
        const t = setTimeout(() => setSearch(text.trim()), 300)
        return () => clearTimeout(t)
    }, [text])

    useEffect(() => {
        if (visible) { setText(''); setSearch('') }
    }, [visible])

    const { data, isLoading } = useQuery<Transaction[]>({
        queryKey: ['transaction-picker', search],
        queryFn: async () => {
            const res = await apiClient.get('/transactions', { params: { search: search || undefined, limit: 40 } })
            return res.data.data.items
        },
        enabled: visible,
        staleTime: 30 * 1000,
    })

    const items = (data ?? []).filter(t => t.id !== excludeId)

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView className="flex-1 bg-brand-bg">
                <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                    <TouchableOpacity onPress={onClose} hitSlop={8} className="w-8">
                        <X size={20} color={colors.muted} />
                    </TouchableOpacity>
                    <Text className="flex-1 text-center text-brand-text text-base font-semibold" numberOfLines={1}>{title}</Text>
                    <View className="w-8" />
                </View>

                <View className="px-4 py-3">
                    <View className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-3 h-11">
                        <Search size={16} color={colors.muted} />
                        <TextInput
                            className="flex-1 ml-2 text-brand-text text-base"
                            placeholder="Search merchant or description"
                            placeholderTextColor={colors.muted}
                            value={text}
                            onChangeText={setText}
                            autoCorrect={false}
                            autoCapitalize="none"
                        />
                    </View>
                </View>

                {isLoading ? (
                    <View className="py-10"><ActivityIndicator color={colors.accent} /></View>
                ) : (
                    <FlatList
                        data={items}
                        keyExtractor={t => t.id}
                        keyboardShouldPersistTaps="handled"
                        ListEmptyComponent={<Text className="text-brand-muted text-sm text-center py-10">No transactions found.</Text>}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                className="flex-row items-center px-4 py-3 border-b border-brand-border"
                                onPress={() => onPick(item)}
                                activeOpacity={0.7}
                            >
                                <View className="flex-1 pr-3">
                                    <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>
                                        {item.merchantName ?? item.description}
                                    </Text>
                                    <Text className="text-brand-muted text-xs mt-0.5" numberOfLines={1}>
                                        {shortDay(item.date.slice(0, 10))} · {item.accountName}
                                    </Text>
                                </View>
                                <AmountText amount={item.amount} size="sm" showSign />
                            </TouchableOpacity>
                        )}
                    />
                )}
            </SafeAreaView>
        </Modal>
    )
}
