import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft, Pencil, ExternalLink, Landmark } from 'lucide-react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { apiClient } from '@/lib/api-client'
import { Card } from '@/components/ui/Card'
import { AmountText } from '@/components/ui/AmountText'
import { AccountEditSheet } from '@/components/accounts/EditSheet'
import { getPaymentUrl } from '@/lib/payment-links'
import { DEBT_TYPES } from '@/lib/account-types'
import { formatAccountType, formatShortDate } from '@/lib/format'
import { haptics } from '@/lib/haptics'
import type { Account, Transaction, PaginatedResponse } from '@/lib/types'

export default function AccountDetailScreen() {
    const router = useRouter()
    const { id } = useLocalSearchParams<{ id: string }>()
    const queryClient = useQueryClient()
    const [showEdit, setShowEdit] = useState(false)

    const { data: accounts, refetch, isRefetching } = useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: async () => (await apiClient.get('/accounts')).data.data,
    })

    const account = accounts?.find((a) => a.id === id)

    const { data: txData, isLoading: txLoading } = useQuery<PaginatedResponse<Transaction>>({
        queryKey: ['transactions', 'account', id],
        queryFn: async () => {
            const res = await apiClient.get('/transactions', {
                params: { accountId: id, limit: '10', page: '1' },
            })
            return res.data.data
        },
        enabled: !!id,
    })

    const transactions = txData?.items ?? []
    const isDebt = account ? DEBT_TYPES.has(account.type) : false
    const payUrl = account && isDebt ? getPaymentUrl(account.institutionName) : null
    const utilization =
        account && isDebt && account.creditLimit && account.creditLimit > 0
            ? (Math.abs(account.balance) / account.creditLimit) * 100
            : null

    const handleDeleted = () => {
        queryClient.invalidateQueries({ queryKey: ['accounts'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        router.back()
    }

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            {/* Header */}
            <View className="flex-row items-center px-4 pt-4 pb-3">
                <TouchableOpacity onPress={() => router.back()} hitSlop={8} className="w-8">
                    <ChevronLeft size={22} color="#6B7280" />
                </TouchableOpacity>
                <Text className="flex-1 text-center text-brand-text text-lg font-bold" numberOfLines={1}>
                    {account?.name ?? 'Account'}
                </Text>
                <TouchableOpacity
                    onPress={() => { haptics.light(); setShowEdit(true) }}
                    hitSlop={8}
                    className="w-8 items-end"
                    disabled={!account}
                >
                    <Pencil size={18} color="#5B7BF8" strokeWidth={2} />
                </TouchableOpacity>
            </View>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#5B7BF8" />
                }
            >
                <View className="px-6 gap-y-4 pb-10 pt-2">
                    {/* Balance card */}
                    <Card className="p-6">
                        <View className="flex-row items-center justify-between mb-3">
                            <Text className="text-brand-muted text-xs font-medium uppercase tracking-widest">
                                {isDebt ? 'Balance Owed' : 'Balance'}
                            </Text>
                            {account?.excludeFromNetWorth && (
                                <View className="px-2 py-0.5 rounded-full bg-brand-elevated">
                                    <Text className="text-brand-muted text-[10px] font-medium">Hidden from net worth</Text>
                                </View>
                            )}
                        </View>
                        {account ? (
                            <>
                                <AmountText
                                    amount={isDebt ? -Math.abs(account.balance) : account.balance}
                                    size="xl"
                                    neutral={!isDebt}
                                    className={isDebt ? undefined : 'text-brand-text'}
                                />
                                <Text className="text-brand-muted text-sm mt-3">
                                    {formatAccountType(account.type)}
                                    {account.institutionName && account.institutionName !== 'Manual'
                                        ? ` · ${account.institutionName}`
                                        : ' · Manual account'}
                                </Text>

                                {utilization != null && (
                                    <View className="mt-4">
                                        <View className="flex-row justify-between mb-1.5">
                                            <Text className="text-brand-muted text-xs">Credit used</Text>
                                            <Text className={`text-xs font-medium ${utilization > 30 ? 'text-brand-negative' : 'text-brand-positive'}`}>
                                                {utilization.toFixed(0)}% of ${account.creditLimit!.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                            </Text>
                                        </View>
                                        <View className="h-1.5 bg-brand-elevated rounded-full overflow-hidden">
                                            <View
                                                className={`h-full rounded-full ${utilization > 30 ? 'bg-brand-negative' : 'bg-brand-positive'}`}
                                                style={{ width: `${Math.min(100, Math.max(2, utilization))}%` }}
                                            />
                                        </View>
                                    </View>
                                )}

                                {payUrl && (
                                    <TouchableOpacity
                                        className="flex-row items-center justify-center gap-x-2 bg-brand-accent rounded-xl h-12 mt-5"
                                        onPress={() => { haptics.medium(); Linking.openURL(payUrl) }}
                                        activeOpacity={0.85}
                                    >
                                        <Text className="text-white font-semibold text-sm">Make a Payment</Text>
                                        <ExternalLink size={14} color="#FFFFFF" strokeWidth={2} />
                                    </TouchableOpacity>
                                )}
                            </>
                        ) : (
                            <View className="h-10 w-40 bg-brand-elevated rounded-lg" />
                        )}
                    </Card>

                    {/* Recent transactions */}
                    <View>
                        <Text className="text-brand-text font-semibold text-base mb-3">Recent Activity</Text>
                        {txLoading ? (
                            <Card className="gap-y-4 p-4">
                                {[1, 2, 3].map((i) => (
                                    <View key={i} className="flex-row justify-between">
                                        <View className="h-3.5 w-32 bg-brand-elevated rounded" />
                                        <View className="h-3.5 w-16 bg-brand-elevated rounded" />
                                    </View>
                                ))}
                            </Card>
                        ) : transactions.length > 0 ? (
                            <Card className="overflow-hidden p-0">
                                {transactions.map((tx, i) => (
                                    <View
                                        key={tx.id}
                                        className={`flex-row items-center justify-between px-4 py-3.5 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                                    >
                                        <View className="flex-1 pr-3">
                                            <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>
                                                {tx.merchantName ?? tx.description}
                                            </Text>
                                            <Text className="text-brand-muted text-xs mt-0.5">
                                                {tx.categoryName ?? 'Uncategorized'} · {formatShortDate(tx.date)}
                                            </Text>
                                        </View>
                                        <AmountText amount={tx.amount} size="sm" showSign />
                                    </View>
                                ))}
                            </Card>
                        ) : (
                            <Card className="items-center py-10">
                                <Landmark size={20} color="#6B7280" strokeWidth={1.5} />
                                <Text className="text-brand-muted text-sm mt-2">No transactions yet</Text>
                            </Card>
                        )}
                    </View>
                </View>
            </ScrollView>

            {account && (
                <AccountEditSheet
                    visible={showEdit}
                    account={account}
                    onClose={() => setShowEdit(false)}
                    onDeleted={handleDeleted}
                />
            )}
        </SafeAreaView>
    )
}
