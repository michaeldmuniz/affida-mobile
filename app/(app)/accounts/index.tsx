import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Plus, Landmark, CreditCard, TrendingUp, Wallet, ExternalLink, ChevronRight, ChevronDown } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { apiClient } from '@/lib/api-client'
import { Card } from '@/components/ui/Card'
import { AmountText } from '@/components/ui/AmountText'
import { AddAccountSheet } from '@/components/accounts/AddSheet'
import { ScopeSheet, useScope, scopeSummary } from '@/components/accounts/ScopeSheet'
import { getPaymentUrl } from '@/lib/payment-links'
import { DEBT_TYPES, computeNetWorth } from '@/lib/account-types'
import { formatAccountType } from '@/lib/format'
import type { Account } from '@/lib/types'
import { colors } from '@/lib/colors'

const ACCOUNT_ICONS: Record<string, any> = {
    CHECKING: Landmark,
    SAVINGS: Wallet,
    CREDIT_CARD: CreditCard,
    INVESTMENT: TrendingUp,
}

type Group = { key: string; title: string; debt: boolean; test: (a: Account) => boolean }

// Grouped by what the account is, in this order. Anything unrecognised lands in "Other".
const GROUPS: Group[] = [
    { key: 'cash', title: 'Cash', debt: false, test: (a) => ['CHECKING', 'SAVINGS', 'CASH', 'MONEY_MARKET'].includes(a.type) },
    { key: 'invest', title: 'Investments', debt: false, test: (a) => /INVEST|BROKER|RETIRE|401|IRA|CRYPTO|HSA/.test(a.type) },
    { key: 'cards', title: 'Credit Cards', debt: true, test: (a) => a.type === 'CREDIT_CARD' || a.type === 'LINE_OF_CREDIT' },
    { key: 'loans', title: 'Loans', debt: true, test: (a) => DEBT_TYPES.has(a.type) },
    { key: 'other', title: 'Other', debt: false, test: () => true },
]

/** What an account contributes to its group's total, same sign rules as net worth. */
function counted(a: Account, debt: boolean) {
    if (a.excludeFromNetWorth || a.hideFromGlobal) return 0
    if (debt) return a.plaidLinked ? a.balance : Math.abs(a.balance)
    return a.balance
}

function money(n: number) {
    return `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function AccountIcon({ type }: { type: string }) {
    const Icon = ACCOUNT_ICONS[type] ?? Wallet
    return (
        <View className="w-10 h-10 rounded-xl bg-brand-accent/10 items-center justify-center">
            <Icon size={18} color={colors.accent} strokeWidth={1.8} />
        </View>
    )
}

export default function AccountsScreen() {
    const router = useRouter()
    const [showAdd, setShowAdd] = useState(false)
    const [showScope, setShowScope] = useState(false)
    const { data: scope } = useScope()

    const { data: accounts, isLoading, refetch, isRefetching } = useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: async () => {
            const res = await apiClient.get('/accounts')
            return res.data.data
        },
        retry: 1,
    })

    const netWorth = computeNetWorth(accounts ?? [])

    // Each account goes in the first group that claims it
    const grouped = GROUPS.map((g) => ({ ...g, items: [] as Account[] }))
    for (const acct of accounts ?? []) {
        grouped.find((g) => g.test(acct))!.items.push(acct)
    }
    const sections = grouped.filter((g) => g.items.length > 0)
    const totalAssets = grouped.filter((g) => !g.debt).reduce((sum, g) => sum + g.items.reduce((s2, a) => s2 + counted(a, false), 0), 0)
    const totalOwed = grouped.filter((g) => g.debt).reduce((sum, g) => sum + g.items.reduce((s2, a) => s2 + counted(a, true), 0), 0)

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />
                }
            >
                {/* Header */}
                <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
                    <Text className="text-brand-text text-2xl font-bold">Accounts</Text>
                    <TouchableOpacity
                        className="flex-1 mx-3 flex-row items-center justify-end gap-x-1"
                        onPress={() => setShowScope(true)}
                        accessibilityRole="button"
                        accessibilityLabel="Choose which accounts to show"
                    >
                        <Text className="text-brand-muted text-sm" numberOfLines={1}>{scopeSummary(scope)}</Text>
                        <ChevronDown size={14} color={colors.muted} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="w-9 h-9 rounded-full bg-brand-surface border border-brand-border items-center justify-center"
                        onPress={() => setShowAdd(true)}
                    >
                        <Plus size={18} color={colors.accent} strokeWidth={2} />
                    </TouchableOpacity>
                </View>

                <View className="px-6 gap-y-5 pb-8 pt-4">
                    {/* Summary */}
                    <Card className="p-5">
                        <Text className="text-brand-muted text-xs uppercase tracking-widest mb-3">Net Worth</Text>
                        <AmountText amount={netWorth} size="lg" neutral className="text-brand-text" />
                        {!isLoading && (accounts?.length ?? 0) > 0 && (
                            <View className="flex-row justify-between mt-4 pt-4 border-t border-brand-border">
                                <View>
                                    <Text className="text-brand-muted text-xs mb-0.5">You have</Text>
                                    <Text className="text-brand-text text-base font-semibold">{money(totalAssets)}</Text>
                                </View>
                                <View className="items-end">
                                    <Text className="text-brand-muted text-xs mb-0.5">You owe</Text>
                                    <Text className="text-base font-semibold" style={{ color: totalOwed > 0 ? colors.negative : colors.text }}>
                                        {money(totalOwed)}
                                    </Text>
                                </View>
                            </View>
                        )}
                    </Card>

                    {isLoading && (
                        <View className="gap-y-2">
                            {[1, 2, 3].map((i) => <AccountRowSkeleton key={i} />)}
                        </View>
                    )}

                    {!isLoading && sections.map((g) => {
                        const total = g.items.reduce((sum, a) => sum + counted(a, g.debt), 0)
                        return (
                            <View key={g.key}>
                                <View className="flex-row items-baseline justify-between mb-3 px-1">
                                    <Text className="text-brand-muted text-xs font-medium uppercase tracking-widest">
                                        {g.title}
                                    </Text>
                                    <Text className="text-brand-muted text-xs font-mono">
                                        {g.debt ? `${money(total)} owed` : money(total)}
                                    </Text>
                                </View>
                                <View className="gap-y-2">
                                    {g.items.map((account) => (
                                        <AccountRow key={account.id} account={account} onPress={() => router.push(`/(app)/accounts/${account.id}`)} />
                                    ))}
                                </View>
                            </View>
                        )
                    })}

                    {!isLoading && (accounts?.length ?? 0) === 0 && (
                        <EmptyState />
                    )}
                </View>
            </ScrollView>

            <AddAccountSheet visible={showAdd} onClose={() => setShowAdd(false)} />
            <ScopeSheet visible={showScope} onClose={() => setShowScope(false)} />
        </SafeAreaView>
    )
}

function AccountRow({ account, onPress }: { account: Account; onPress: () => void }) {
    const payUrl = DEBT_TYPES.has(account.type) ? getPaymentUrl(account.institutionName) : null

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
            <Card className="flex-row items-center gap-x-3 p-4">
                <AccountIcon type={account.type} />
                <View className="flex-1">
                    <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>
                        {account.name}
                    </Text>
                    <Text className="text-brand-muted text-xs mt-0.5" numberOfLines={1}>
                        {formatAccountType(account.type)}
                        {account.isShared ? ` · Shared by ${account.ownerName?.split(' ')[0] ?? 'partner'}` : ''}
                    </Text>
                    {account.needsReconnect && (
                        <Text className="text-brand-negative text-xs mt-0.5" numberOfLines={1}>
                            Needs reconnection{account.reconnectItemId ? ' · tap to fix' : ''}
                        </Text>
                    )}
                </View>
                <View className="items-end gap-y-1">
                    <AmountText amount={account.balance} size="sm" neutral />
                    {payUrl && (
                        <TouchableOpacity
                            className="flex-row items-center gap-x-1 px-2 py-0.5 rounded-full bg-blue-500/15"
                            onPress={(e) => { e.stopPropagation?.(); Linking.openURL(payUrl) }}
                            activeOpacity={0.7}
                            hitSlop={8}
                        >
                            <Text className="text-blue-400 text-xs font-semibold">Pay Now</Text>
                            <ExternalLink size={10} color="#60A5FA" />
                        </TouchableOpacity>
                    )}
                </View>
                <ChevronRight size={14} color={colors.disabled} style={{ marginLeft: 4 }} />
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
                <Landmark size={24} color={colors.muted} strokeWidth={1.5} />
            </View>
            <Text className="text-brand-text font-semibold mb-1">No accounts yet</Text>
            <Text className="text-brand-muted text-sm text-center leading-relaxed px-8">
                Connect a bank account or add one manually to get started.
            </Text>
        </View>
    )
}
