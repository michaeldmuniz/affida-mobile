import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Alert, TextInput, Modal, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Card } from '@/components/ui/Card'
import { AmountText } from '@/components/ui/AmountText'
import { colors } from '@/lib/colors'
import { haptics } from '@/lib/haptics'
import { syncStatusLabel } from '@/lib/sync'
import { ReconnectBankButton } from '@/components/accounts/ReconnectBankButton'
import { PendingBadge } from '@/components/transactions/PendingBadge'
import { BusinessPicker } from '@/components/accounts/BusinessPicker'

interface AccountDetail {
    id: string
    name: string
    type: string
    institutionName: string
    balance: number
    creditLimit: number | null
    /** Personal (null) or the owner's business it belongs to */
    businessId: string | null
    purpose: 'PERSONAL' | 'BUSINESS'
    plaidLinked: boolean
    lastSyncAt: string | null
    needsReconnect: boolean
    /** The owner's bank connection, and the names of every account that disconnecting it removes */
    disconnectItemId: string | null
    disconnectAccountNames: string[]
    /** Set for the owner when the bank connection needs reconnecting */
    reconnectItemId: string | null
    updatedAt: string
    /** A partner's account shared with you — only the owner can delete it. */
    isShared: boolean
    /** Owner, or partner with EDITOR access. */
    canEdit: boolean
    ownerName: string | null
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
    const [editingLimit, setEditingLimit] = useState(false)
    const [limitText, setLimitText] = useState('')
    const [limitError, setLimitError] = useState<string | null>(null)

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

    // Credit limit is edited inline (no pop-up), so errors show in place.
    const { mutate: saveLimit, isPending: isSavingLimit } = useMutation({
        mutationFn: async (creditLimit: number) => {
            await apiClient.patch(`/accounts/${id}`, { creditLimit })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['account-detail', id] })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            setEditingLimit(false)
            setLimitError(null)
        },
        onError: () => setLimitError('Could not save the credit limit. Please try again.'),
    })

    const submitLimit = () => {
        const parsed = parseFloat(limitText.replace(/[$,\s]/g, ''))
        if (isNaN(parsed) || parsed <= 0) {
            setLimitError('Enter your credit limit as a number greater than 0.')
            return
        }
        setLimitError(null)
        saveLimit(parsed)
    }

    // Owner only: Personal or one of my businesses. A business account leaves the default (Personal) view.
    const [showBusinessPicker, setShowBusinessPicker] = useState(false)
    const { data: myBusinesses = [] } = useQuery<{ id: string; name: string }[]>({
        queryKey: ['businesses'],
        queryFn: async () => (await apiClient.get('/businesses')).data.data,
    })
    const { mutate: setBusiness, isPending: isSettingBusiness } = useMutation({
        mutationFn: async (businessId: string | null) => {
            await apiClient.put(`/accounts/${id}`, { businessId })
        },
        onSuccess: () => {
            haptics.light()
            queryClient.invalidateQueries({ queryKey: ['account-detail', id] })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            queryClient.invalidateQueries({ queryKey: ['scope'] })
        },
        onError: () => Alert.alert('Error', 'Could not change the account type. Please try again.'),
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

    const { mutate: disconnectBank, isPending: isDisconnecting } = useMutation({
        mutationFn: async (itemId: string) => {
            await apiClient.delete(`/plaid/items/${itemId}`)
        },
        onSuccess: () => {
            for (const key of ['accounts', 'dashboard', 'transactions', 'budgets', 'insights', 'investments']) {
                queryClient.invalidateQueries({ queryKey: [key] })
            }
            router.back()
        },
        onError: (err: any) => Alert.alert('Error', err?.response?.data?.error ?? 'Failed to disconnect bank.'),
    })

    const handleDelete = () => {
        const itemId = data?.account.disconnectItemId
        if (data?.account.plaidLinked) {
            if (!itemId) return
            const names = data.account.disconnectAccountNames
            Alert.alert(
                `Disconnect ${data.account.institutionName}?`,
                `This removes the bank connection and permanently deletes ${names.length > 1 ? `all ${names.length} of its accounts (${names.join(', ')})` : `"${names[0] ?? data.account.name}"`} and every transaction in ${names.length > 1 ? 'them' : 'it'}. This cannot be undone. To use the bank again you would need to reconnect it.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Disconnect', style: 'destructive', onPress: () => disconnectBank(itemId) },
                ]
            )
            return
        }
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
                    <ChevronLeft size={22} color={colors.muted} />
                </TouchableOpacity>
                <Text className="flex-1 text-center text-brand-text text-lg font-bold" numberOfLines={1}>
                    {account?.name ?? ''}
                </Text>
                {account && !account.isShared ? (
                    <TouchableOpacity onPress={handleDelete} hitSlop={8} className="w-8 items-end" disabled={isDeleting || isDisconnecting}>
                        {isDeleting || isDisconnecting
                            ? <ActivityIndicator size="small" color={colors.destructive} />
                            : <Trash2 size={18} color={colors.destructive} strokeWidth={1.8} />
                        }
                    </TouchableOpacity>
                ) : (
                    <View className="w-8" />
                )}
            </View>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
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
                                <Text className={`text-xs mt-2 ${account.needsReconnect ? 'text-brand-negative' : 'text-brand-muted'}`}>
                                    {account.plaidLinked ? syncStatusLabel(account) : `Manual account · updated ${formatDate(account.updatedAt)}`}
                                </Text>
                                {account.isShared && (
                                    <Text className="text-brand-muted text-xs mt-1">
                                        Shared by {account.ownerName?.split(' ')[0] ?? 'your partner'}{account.canEdit ? '' : ' · view only'}
                                    </Text>
                                )}

                                {(account.type === 'CREDIT_CARD' || account.type === 'LINE_OF_CREDIT') && (
                                    <View className="mt-4 pt-4 border-t border-brand-border">
                                        {editingLimit ? (
                                            <View className="gap-y-2">
                                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest">Credit limit</Text>
                                                <View className="flex-row items-center bg-brand-elevated border border-brand-border rounded-xl px-4 h-12">
                                                    <Text className="text-brand-muted text-lg mr-1">$</Text>
                                                    <TextInput
                                                        className="flex-1 text-brand-text text-lg font-semibold"
                                                        value={limitText}
                                                        onChangeText={setLimitText}
                                                        keyboardType="decimal-pad"
                                                        placeholder="5000"
                                                        placeholderTextColor={colors.muted}
                                                        autoFocus
                                                    />
                                                </View>
                                                {limitError && <Text className="text-brand-negative text-xs">{limitError}</Text>}
                                                <View className="flex-row gap-x-2">
                                                    <TouchableOpacity
                                                        className="flex-1 h-10 rounded-xl border border-brand-border items-center justify-center"
                                                        onPress={() => { setEditingLimit(false); setLimitError(null) }}
                                                        disabled={isSavingLimit}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Text className="text-brand-text text-sm font-medium">Cancel</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        className="flex-1 h-10 rounded-xl bg-brand-accent items-center justify-center"
                                                        onPress={submitLimit}
                                                        disabled={isSavingLimit}
                                                        activeOpacity={0.8}
                                                    >
                                                        {isSavingLimit
                                                            ? <ActivityIndicator size="small" color="#fff" />
                                                            : <Text className="text-white text-sm font-semibold">Save</Text>}
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        ) : (
                                            <View>
                                                <View className="flex-row items-center justify-between">
                                                    <View>
                                                        <Text className="text-brand-muted text-xs uppercase tracking-widest mb-0.5">Credit limit</Text>
                                                        <Text className="text-brand-text text-base font-semibold">
                                                            {account.creditLimit ? `$${account.creditLimit.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : 'Not set'}
                                                        </Text>
                                                    </View>
                                                    {account.canEdit && (
                                                        <TouchableOpacity
                                                            className="flex-row items-center gap-x-2 bg-brand-elevated border border-brand-border rounded-xl px-4 h-9"
                                                            onPress={() => { setLimitText(account.creditLimit ? String(account.creditLimit) : ''); setLimitError(null); setEditingLimit(true) }}
                                                            activeOpacity={0.7}
                                                        >
                                                            <Pencil size={13} color={colors.muted} />
                                                            <Text className="text-brand-muted text-sm font-medium">{account.creditLimit ? 'Edit' : 'Set limit'}</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                                {!!account.creditLimit && account.creditLimit > 0 && (() => {
                                                    const owed = account.plaidLinked ? account.balance : Math.abs(account.balance)
                                                    const pct = Math.max(0, (owed / account.creditLimit) * 100)
                                                    const color = pct >= 70 ? colors.negative : pct >= 30 ? '#F5AE39' : colors.positive
                                                    return (
                                                        <View className="mt-3">
                                                            <View className="h-2 bg-brand-elevated rounded-full overflow-hidden">
                                                                <View className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
                                                            </View>
                                                            <Text className="text-brand-muted text-xs mt-1.5">{pct.toFixed(0)}% of your limit used</Text>
                                                        </View>
                                                    )
                                                })()}
                                            </View>
                                        )}
                                    </View>
                                )}

                                {account.reconnectItemId && <ReconnectBankButton plaidItemId={account.reconnectItemId} />}
                                {account.needsReconnect && !account.reconnectItemId && (
                                    <Text className="text-brand-muted text-xs mt-1">
                                        {account.ownerName?.split(' ')[0] ?? 'Your partner'} needs to reconnect this bank.
                                    </Text>
                                )}

                                {!account.plaidLinked && account.canEdit && (
                                    <TouchableOpacity
                                        className="flex-row items-center gap-x-2 mt-4 self-start bg-brand-elevated border border-brand-border rounded-xl px-4 h-9"
                                        onPress={() => { setNewBalance(''); setShowUpdateBalance(true) }}
                                        activeOpacity={0.7}
                                    >
                                        <Pencil size={13} color={colors.muted} />
                                        <Text className="text-brand-muted text-sm font-medium">Update Balance</Text>
                                    </TouchableOpacity>
                                )}
                            </Card>

                            {/* Personal or a business (owner only) */}
                            {!account.isShared && (
                                <TouchableOpacity activeOpacity={0.7} onPress={() => setShowBusinessPicker(true)} disabled={isSettingBusiness}>
                                    <Card className="p-5">
                                        <View className="flex-row items-center">
                                            <View className="flex-1 pr-4">
                                                <Text className="text-brand-text text-sm font-medium">Belongs to</Text>
                                                <Text className="text-brand-muted text-xs mt-1">
                                                    Personal, or one of your groups. Each is shared separately.
                                                </Text>
                                            </View>
                                            <Text className="text-brand-accent text-sm font-medium">
                                                {account.businessId ? (myBusinesses.find(b => b.id === account.businessId)?.name ?? 'Business') : 'Personal'}
                                            </Text>
                                            <ChevronRight size={16} color={colors.muted} />
                                        </View>
                                    </Card>
                                </TouchableOpacity>
                            )}

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
                                                    <View className="flex-row items-center gap-x-1.5">
                                                        <Text className="text-brand-text text-sm font-medium flex-shrink" numberOfLines={1}>
                                                            {tx.merchantName ?? tx.description}
                                                        </Text>
                                                        {tx.pending && <PendingBadge />}
                                                    </View>
                                                    <Text className="text-brand-muted text-xs mt-0.5">
                                                        {tx.categoryName ?? 'Uncategorized'} · {formatShort(tx.date)}
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
                                placeholderTextColor={colors.muted}
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
            <BusinessPicker
                visible={showBusinessPicker}
                selectedId={account?.businessId ?? null}
                onSelect={(businessId) => setBusiness(businessId)}
                onClose={() => setShowBusinessPicker(false)}
            />
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
