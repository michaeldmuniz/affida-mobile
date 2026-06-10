import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Plus, Landmark, CreditCard, TrendingUp, Wallet, ExternalLink, ChevronLeft } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Card } from '@/components/ui/Card'
import { AmountText } from '@/components/ui/AmountText'
import { AddAccountSheet } from '@/components/accounts/AddSheet'
import { getPaymentUrl } from '@/lib/payment-links'
import { DEBT_TYPES } from '@/lib/account-types'
import { formatAccountType } from '@/lib/format'
import type { Account } from '@/lib/types'

const ACCOUNT_ICONS: Record<string, any> = {
    CHECKING: Landmark,
    SAVINGS: Wallet,
    CREDIT_CARD: CreditCard,
    INVESTMENT: TrendingUp,
}

function AccountIcon({ type }: { type: string }) {
    const Icon = ACCOUNT_ICONS[type] ?? Wallet
    return (
        <View className="w-10 h-10 rounded-xl bg-brand-accent/10 items-center justify-center">
            <Icon size={18} color="#5B7BF8" strokeWidth={1.8} />
        </View>
    )
}

export default function AccountsScreen() {
    const router = useRouter()
    const [showAdd, setShowAdd] = useState(false)

    const { data: accounts, isLoading, refetch, isRefetching } = useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: async () => {
            const res = await apiClient.get('/accounts')
            return res.data.data
        },
        retry: 1,
    })

    const netWorth = accounts?.reduce((sum, a) => {
        if (a.excludeFromNetWorth) return sum
        return sum + a.balance
    }, 0) ?? 0

    const assets = accounts?.filter((a) => !DEBT_TYPES.has(a.type) && a.balance > 0) ?? []
    const liabilities = accounts?.filter((a) => DEBT_TYPES.has(a.type) || a.balance < 0) ?? []

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#5B7BF8" />
                }
            >
                {/* Header */}
                <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
                    <View className="flex-row items-center gap-x-2">
                        <TouchableOpacity onPress={() => router.back()} hitSlop={8} className="-ml-2">
                            <ChevronLeft size={24} color="#6B7280" />
                        </TouchableOpacity>
                        <Text className="text-brand-text text-2xl font-bold">Accounts</Text>
                    </View>
                    <TouchableOpacity
                        className="w-9 h-9 rounded-full bg-brand-surface border border-brand-border items-center justify-center"
                        onPress={() => setShowAdd(true)}
                    >
                        <Plus size={18} color="#5B7BF8" strokeWidth={2} />
                    </TouchableOpacity>
                </View>

                <View className="px-6 gap-y-5 pb-8 pt-4">
                    {/* Summary */}
                    <Card className="p-5">
                        <Text className="text-brand-muted text-xs uppercase tracking-widest mb-3">Net Worth</Text>
                        <AmountText amount={netWorth} size="lg" neutral className="text-brand-text" />
                    </Card>

                    {/* Assets */}
                    {(assets.length > 0 || isLoading) && (
                        <View>
                            <Text className="text-brand-muted text-xs font-medium uppercase tracking-widest mb-3 px-1">
                                Assets
                            </Text>
                            <View className="gap-y-2">
                                {isLoading
                                    ? [1, 2, 3].map((i) => <AccountRowSkeleton key={i} />)
                                    : assets.map((account) => (
                                        <AccountRow key={account.id} account={account} />
                                    ))
                                }
                            </View>
                        </View>
                    )}

                    {/* Liabilities */}
                    {liabilities.length > 0 && (
                        <View>
                            <Text className="text-brand-muted text-xs font-medium uppercase tracking-widest mb-3 px-1">
                                Liabilities
                            </Text>
                            <View className="gap-y-2">
                                {liabilities.map((account) => (
                                    <AccountRow key={account.id} account={account} />
                                ))}
                            </View>
                        </View>
                    )}

                    {!isLoading && !accounts && (
                        <EmptyState />
                    )}
                </View>
            </ScrollView>

            <AddAccountSheet visible={showAdd} onClose={() => setShowAdd(false)} />
        </SafeAreaView>
    )
}

function AccountRow({ account }: { account: Account }) {
    const router = useRouter()
    const payUrl = DEBT_TYPES.has(account.type) ? getPaymentUrl(account.institutionName) : null

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.push(`/accounts/${account.id}`)}
        >
        <Card className="flex-row items-center gap-x-3 p-4">
            <AccountIcon type={account.type} />
            <View className="flex-1">
                <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>
                    {account.name}
                </Text>
                <Text className="text-brand-muted text-xs mt-0.5">{formatAccountType(account.type)}</Text>
            </View>
            <View className="items-end gap-y-1">
                <AmountText amount={account.balance} size="sm" neutral />
                {payUrl && (
                    <TouchableOpacity
                        className="flex-row items-center gap-x-1 px-2 py-0.5 rounded-full bg-blue-500/15"
                        onPress={() => Linking.openURL(payUrl)}
                        activeOpacity={0.7}
                        hitSlop={8}
                    >
                        <Text className="text-blue-400 text-xs font-semibold">Pay Now</Text>
                        <ExternalLink size={10} color="#60A5FA" />
                    </TouchableOpacity>
                )}
            </View>
        </Card>
        </TouchableOpacity>
    )
}

function AccountRowSkeleton() {
    return (
        <Card className="flex-row items-center gap-x-3 p-4">
            <View className="w-10 h-10 rounded-xl bg-brand-elevated" />
            <View className="flex-1 gap-y-2">
                <View className="h-3.5 w-28 bg-brand-elevated rounded" />
                <View className="h-2.5 w-16 bg-brand-elevated rounded" />
            </View>
            <View className="h-3.5 w-16 bg-brand-elevated rounded" />
        </Card>
    )
}

function EmptyState() {
    return (
        <View className="items-center py-16">
            <View className="w-14 h-14 rounded-2xl bg-brand-surface border border-brand-border items-center justify-center mb-4">
                <Landmark size={24} color="#6B7280" strokeWidth={1.5} />
            </View>
            <Text className="text-brand-text font-semibold mb-1">No accounts yet</Text>
            <Text className="text-brand-muted text-sm text-center leading-relaxed px-8">
                Connect a bank account or add one manually to get started.
            </Text>
        </View>
    )
}
