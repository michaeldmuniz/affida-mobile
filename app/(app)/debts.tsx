import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ExternalLink, CreditCard } from 'lucide-react-native'
import { apiClient } from '@/lib/api-client'
import { Card } from '@/components/ui/Card'
import { getPaymentUrl } from '@/lib/payment-links'
import { amountOwed, debtAccounts } from '@/lib/account-types'
import { formatAccountType } from '@/lib/format'
import { haptics } from '@/lib/haptics'
import type { Account } from '@/lib/types'
import { colors } from '@/lib/colors'

const WARN = '#F5AE39'

function usd(n: number) {
    return `$${Math.round(n).toLocaleString('en-US')}`
}

/** Credit-card utilization colors: under 30% is healthy, 30–70% watch it, above that is high. */
function utilColor(pct: number) {
    if (pct >= 70) return colors.negative
    if (pct >= 30) return WARN
    return colors.positive
}

export default function DebtScreen() {
    const router = useRouter()
    const { data: accounts, isLoading, refetch, isRefetching } = useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: async () => (await apiClient.get('/accounts')).data.data,
        staleTime: 2 * 60 * 1000,
    })

    const debts = debtAccounts(accounts ?? []).sort((a, b) => amountOwed(b) - amountOwed(a))
    const total = debts.reduce((s, a) => s + amountOwed(a), 0)
    const cards = debts.filter((a) => a.type === 'CREDIT_CARD' || a.type === 'LINE_OF_CREDIT')
    const loans = debts.filter((a) => !(a.type === 'CREDIT_CARD' || a.type === 'LINE_OF_CREDIT'))
    const cardOwed = cards.reduce((s, a) => s + amountOwed(a), 0)
    const cardLimit = cards.reduce((s, a) => s + (a.creditLimit ?? 0), 0)
    const cardsWithLimit = cards.filter((a) => (a.creditLimit ?? 0) > 0)
    const limitOwed = cardsWithLimit.reduce((s, a) => s + amountOwed(a), 0)
    const limitTotal = cardsWithLimit.reduce((s, a) => s + (a.creditLimit ?? 0), 0)
    const overallUtil = limitTotal > 0 ? (limitOwed / limitTotal) * 100 : null

    const group = (title: string, items: Account[]) => items.length > 0 && (
        <View key={title}>
            <Text className="text-brand-muted text-xs font-medium uppercase tracking-widest mb-3 px-1">{title}</Text>
            <View className="gap-y-2">
                {items.map((a) => <DebtRow key={a.id} account={a} onPress={() => { haptics.light(); router.push(`/(app)/accounts/${a.id}` as any) }} />)}
            </View>
        </View>
    )

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
            >
                <View className="flex-row items-center gap-x-2 px-6 pt-4 pb-2">
                    <TouchableOpacity onPress={() => router.back()} hitSlop={8} className="-ml-2">
                        <ChevronLeft size={24} color={colors.muted} />
                    </TouchableOpacity>
                    <Text className="text-brand-text text-2xl font-bold">Debt</Text>
                </View>

                <View className="px-6 gap-y-5 pb-10 pt-4">
                    {isLoading ? (
                        <Card className="p-5 gap-y-3">
                            <View className="h-3 w-24 bg-brand-elevated rounded" />
                            <View className="h-9 w-44 bg-brand-elevated rounded-lg" />
                        </Card>
                    ) : debts.length === 0 ? (
                        <View className="items-center py-16">
                            <View className="w-14 h-14 rounded-2xl bg-brand-surface border border-brand-border items-center justify-center mb-4">
                                <CreditCard size={24} color={colors.muted} strokeWidth={1.5} />
                            </View>
                            <Text className="text-brand-text font-semibold mb-1">No debt tracked</Text>
                            <Text className="text-brand-muted text-sm text-center leading-relaxed px-8">
                                Credit cards and loans you connect will show up here.
                            </Text>
                        </View>
                    ) : (
                        <>
                            <Card className="p-5">
                                <Text className="text-brand-muted text-xs uppercase tracking-widest mb-1">Total owed</Text>
                                <Text className="text-3xl font-bold" style={{ color: colors.negative }}>{usd(total)}</Text>
                                <View className="flex-row justify-between mt-4 pt-4 border-t border-brand-border">
                                    <View>
                                        <Text className="text-brand-muted text-xs mb-0.5">Credit cards</Text>
                                        <Text className="text-brand-text text-base font-semibold">{usd(cardOwed)}</Text>
                                    </View>
                                    <View className="items-end">
                                        <Text className="text-brand-muted text-xs mb-0.5">Loans</Text>
                                        <Text className="text-brand-text text-base font-semibold">{usd(total - cardOwed)}</Text>
                                    </View>
                                </View>
                                {overallUtil !== null && (
                                    <View className="mt-4">
                                        <View className="flex-row justify-between mb-1.5">
                                            <Text className="text-brand-muted text-xs">Card limit used</Text>
                                            <Text className="text-xs font-semibold" style={{ color: utilColor(overallUtil) }}>
                                                {overallUtil.toFixed(0)}% of {usd(cardLimit)}
                                            </Text>
                                        </View>
                                        <View className="h-2 bg-brand-elevated rounded-full overflow-hidden">
                                            <View className="h-full rounded-full" style={{ width: `${Math.min(overallUtil, 100)}%`, backgroundColor: utilColor(overallUtil) }} />
                                        </View>
                                    </View>
                                )}
                            </Card>
                            {group('Credit Cards', cards)}
                            {group('Loans', loans)}
                        </>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

function DebtRow({ account, onPress }: { account: Account; onPress: () => void }) {
    const owed = amountOwed(account)
    const limit = account.creditLimit ?? 0
    const util = limit > 0 ? (owed / limit) * 100 : null
    const payUrl = getPaymentUrl(account.institutionName)

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
            <Card className="p-4">
                <View className="flex-row items-center justify-between">
                    <View className="flex-1 mr-3">
                        <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>{account.name}</Text>
                        <Text className="text-brand-muted text-xs mt-0.5" numberOfLines={1}>
                            {account.institutionName} · {formatAccountType(account.type)}
                        </Text>
                    </View>
                    <Text className="text-brand-text text-sm font-semibold font-mono">{usd(owed)}</Text>
                    <ChevronRight size={14} color={colors.disabled} style={{ marginLeft: 6 }} />
                </View>
                {util !== null && (
                    <View className="mt-3">
                        <View className="h-2 bg-brand-elevated rounded-full overflow-hidden">
                            <View className="h-full rounded-full" style={{ width: `${Math.min(util, 100)}%`, backgroundColor: utilColor(util) }} />
                        </View>
                        <Text className="text-brand-muted text-xs mt-1.5">
                            {util.toFixed(0)}% of {usd(limit)} limit
                        </Text>
                    </View>
                )}
                {payUrl && (
                    <TouchableOpacity
                        className="self-start flex-row items-center gap-x-1 px-2 py-0.5 rounded-full bg-blue-500/15 mt-3"
                        onPress={(e) => { e.stopPropagation?.(); Linking.openURL(payUrl) }}
                        activeOpacity={0.7}
                        hitSlop={8}
                    >
                        <Text className="text-blue-400 text-xs font-semibold">Pay Now</Text>
                        <ExternalLink size={10} color="#60A5FA" />
                    </TouchableOpacity>
                )}
            </Card>
        </TouchableOpacity>
    )
}
