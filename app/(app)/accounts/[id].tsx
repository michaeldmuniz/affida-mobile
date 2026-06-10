import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert, TextInput, Modal, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronLeft, Pencil, Trash2 } from 'lucide-react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Card } from '@/components/ui/Card'
import { AmountText } from '@/components/ui/AmountText'

interface AccountDetail {
    id: string
    name: string
    type: string
    institutionName: string
    balance: number
    creditLimit: number | null
    plaidLinked: boolean
    updatedAt: string
    snapshots: { balance: number; createdAt: string }[]
}

interface TxRow {
    id: string
    amount: number
    date: string
    description: string
    merchantName: string | null
    categoryName: string | null
    pending: boolean
}

function formatType(type: string) {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatShort(iso: string) {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function AccountDetailScreen() {
    const { id } = useLocalSearchParams<{ id: string }>()
    const router = useRouter()
    const queryClient = useQueryClient()
    const [showUpdateBalance, setShowUpdateBalance] = useState(false)
    const [newBalance, setNewBalance] = useState('')

    const { data, isLoading, refetch, isRefetching } = useQuery({
        queryKey: ['account-detail', id],
        queryFn: async () => {
            const res = await apiClient.get(`/accounts/${id}`)
            return res.data.data as { account: AccountDetail; transactions: TxRow[] }
        },
    })

    const { mutate: updateBalance, isPending: isUpdating } = useMutation({
        mutationFn: async (balance: number) => {
            await apiClient.patch(`/accounts/${id}`, { balance })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['account-detail', id] })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            setShowUpdateBalance(false)
            setNewBalance('')
        },
        onError: () => Alert.alert('Error', 'Failed to update balance.'),
    })

    const { mutate: deleteAccount, isPending: isDeleting } = useMutation({
        mutationFn: async () => {
            await apiClient.delete(`/accounts/${id}`)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            router.back()
        },
        onError: () => Alert.alert('Error', 'Failed to delete account.'),
    })

    const handleDelete = () => {
        Alert.alert(
            'Delete Account',
            `Delete "${data?.account.name}"? This will also delete all associated transactions. This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => deleteAccount() },
            ]
        )
    }

    const handleUpdateBalance = () => {
        const parsed = parseFloat(newBalance)
        if (isNaN(parsed)) {
            Alert.alert('Error', 'Please enter a valid number.')
            return
        }
        updateBalance(parsed)
    }

    const account = data?.account
    const transactions = data?.transactions ?? []

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            {/* Header */}
            <View className="flex-row items-center px-4 pt-4 pb-3">
                <TouchableOpacity onPress={() => router.back()} hitSlop={8} className="w-8">
                    <ChevronLeft size={22} color="#6B7280" />
                </TouchableOpacity>
                <Text className="flex-1 text-center text-brand-text text-lg font-bold" numberOfLines={1}>
                    {account?.name ?? ''}
                </Text>
                <TouchableOpacity onPress={handleDelete} hitSlop={8} className="w-8 items-end" disabled={isDeleting}>
                    {isDeleting
                        ? <ActivityIndicator size="small" color="#EF4444" />
                        : <Trash2 size={18} color="#EF4444" strokeWidth={1.8} />
                    }
                </TouchableOpacity>
            </View>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#5B7BF8" />}
            >
                <View className="px-6 gap-y-4 pb-8 pt-2">

                    {isLoading ? (
                        <AccountDetailSkeleton />
                    ) : account ? (
                        <>
                            {/* Balance card */}
                            <Card className="p-5">
                                <Text className="text-brand-muted text-xs uppercase tracking-widest mb-1">
                                    {account.institutionName} · {formatType(account.type)}
                                </Text>
                                <AmountText amount={account.balance} size="xl" neutral className="text-brand-text mt-2" />
                                <Text className="text-brand-muted text-xs mt-2">
                                    Updated {formatDate(account.updatedAt)}
                                </Text>

                                {!account.plaidLinked && (
                                    <TouchableOpacity
                                        className="flex-row items-center gap-x-2 mt-4 self-start bg-brand-elevated border border-brand-border rounded-xl px-4 h-9"
                                        onPress={() => { setNewBalance(''); setShowUpdateBalance(true) }}
                                        activeOpacity={0.7}
                                    >
                                        <Pencil size={13} color="#6B7280" />
                                        <Text className="text-brand-muted text-sm font-medium">Update Balance</Text>
                                    </TouchableOpacity>
                                )}
                            </Card>

                            {/* Balance history */}
                            {account.snapshots.length > 0 && (
                                <View>
                                    <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-3 px-1">
                                        Balance History
                                    </Text>
                                    <Card className="p-0 overflow-hidden">
                                        {account.snapshots.slice(0, 8).map((snap, i) => (
                                            <View
                                                key={i}
                                                className={`flex-row items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                                            >
                                                <Text className="text-brand-muted text-sm">{formatDate(snap.createdAt)}</Text>
                                                <AmountText amount={snap.balance} size="sm" neutral />
                                            </View>
                                        ))}
                                    </Card>
                                </View>
                            )}

                            {/* Transactions */}
                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-3 px-1">
                                    Recent Transactions
                                </Text>
                                {transactions.length > 0 ? (
                                    <Card className="p-0 overflow-hidden">
                                        {transactions.map((tx, i) => (
                                            <View
                                                key={tx.id}
                                                className={`flex-row items-center px-4 py-3.5 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                                            >
                                                <View className="flex-1 pr-3">
                                                    <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>
                                                        {tx.merchantName ?? tx.description}
                                                    </Text>
                                                    <Text className="text-brand-muted text-xs mt-0.5">
                                                        {tx.categoryName ?? 'Uncategorized'} · {formatShort(tx.date)}
                                                        {tx.pending ? ' · Pending' : ''}
                                                    </Text>
                                                </View>
                                                <AmountText amount={tx.amount} size="sm" showSign />
                                            </View>
                                        ))}
                                    </Card>
                                ) : (
                                    <Card className="p-6 items-center">
                                        <Text className="text-brand-muted text-sm">No transactions found.</Text>
                                    </Card>
                                )}
                            </View>
                        </>
                    ) : null}
                </View>
            </ScrollView>

            {/* Update Balance Modal */}
            <Modal visible={showUpdateBalance} transparent animationType="fade" onRequestClose={() => setShowUpdateBalance(false)}>
                <View className="flex-1 bg-black/60 items-center justify-center px-6">
                    <View className="bg-brand-surface border border-brand-border rounded-2xl p-6 w-full">
                        <Text className="text-brand-text text-base font-bold mb-1">Update Balance</Text>
                        <Text className="text-brand-muted text-sm mb-4">
                            This will create a new balance snapshot.
                        </Text>
                        <View className="flex-row items-center bg-brand-elevated border border-brand-border rounded-xl px-4 h-14 mb-4">
                            <Text className="text-brand-muted text-xl mr-1">$</Text>
                            <TextInput
                                className="flex-1 text-brand-text text-xl font-semibold"
                                value={newBalance}
                                onChangeText={setNewBalance}
                                keyboardType="decimal-pad"
                                placeholder="0.00"
                                placeholderTextColor="#6B7280"
                                autoFocus
                                selectTextOnFocus
                            />
                        </View>
                        <View className="flex-row gap-x-3">
                            <TouchableOpacity
                                className="flex-1 h-12 rounded-xl border border-brand-border items-center justify-center"
                                onPress={() => setShowUpdateBalance(false)}
                                activeOpacity={0.7}
                            >
                                <Text className="text-brand-muted font-medium">Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className="flex-1 h-12 rounded-xl bg-brand-accent items-center justify-center"
                                onPress={handleUpdateBalance}
                                disabled={isUpdating}
                                activeOpacity={0.85}
                            >
                                {isUpdating
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text className="text-white font-semibold">Update</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    )
}

function AccountDetailSkeleton() {
    return (
        <>
            <Card className="p-5 gap-y-3">
                <View className="h-2.5 w-32 bg-brand-elevated rounded" />
                <View className="h-9 w-40 bg-brand-elevated rounded" />
                <View className="h-2.5 w-24 bg-brand-elevated rounded" />
            </Card>
            <Card className="p-0 overflow-hidden gap-y-0">
                {[1, 2, 3, 4].map(i => (
                    <View key={i} className={`flex-row items-center justify-between px-4 py-3.5 ${i > 1 ? 'border-t border-brand-border' : ''}`}>
                        <View className="gap-y-1.5 flex-1">
                            <View className="h-3.5 w-32 bg-brand-elevated rounded" />
                            <View className="h-2.5 w-20 bg-brand-elevated rounded" />
                        </View>
                        <View className="h-3.5 w-16 bg-brand-elevated rounded" />
                    </View>
                ))}
            </Card>
        </>
    )
}
