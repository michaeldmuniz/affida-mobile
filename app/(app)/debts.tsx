import { View, Text, ScrollView, RefreshControl, TouchableOpacity, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ExternalLink, CreditCard, Landmark } from 'lucide-react-native'
import { apiClient } from '@/lib/api-client'
import { Card } from '@/components/ui/Card'
import { DonutChart } from '@/components/charts/DonutChart'
import { colorForIndex } from '@/components/charts/palette'
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

/** Credit-card utilization: under 30% is healthy, 30–70% watch it, above that is high. */
function utilColor(pct: number) {
    if (pct >= 70) return colors.negative
    if (pct >= 30) return WARN
    return colors.positive
}

function utilLabel(pct: number) {
    if (pct >= 70) return 'High'
    if (pct >= 30) return 'Moderate'
    return 'Healthy'
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
    // One color per account, shared by the hero bar and that account's tile below it
    const colorOf = new Map(debts.map((a, i) => [a.id, colorForIndex(i)]))
    const isCard = (a: Account) => a.type === 'CREDIT_CARD' || a.type === 'LINE_OF_CREDIT'
    const cards = debts.filter(isCard)
    const loans = debts.filter((a) => !isCard(a))

    const withLimit = cards.filter((a) => (a.creditLimit ?? 0) > 0)
    const limitOwed = withLimit.reduce((s, a) => s + amountOwed(a), 0)
    const limitTotal = withLimit.reduce((s, a) => s + (a.creditLimit ?? 0), 0)
    const overallUtil = limitTotal > 0 ? (limitOwed / limitTotal) * 100 : null
    const biggest = debts[0]

    const open = (a: Account) => { haptics.light(); router.push(`/(app)/accounts/${a.id}` as any) }

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

                <View className="px-6 gap-y-5 pb-10 pt-3">
                    {isLoading ? (
                        <Card className="p-5 gap-y-3">
                            <View className="h-3 w-24 bg-brand-elevated rounded" />
                            <View className="h-10 w-44 bg-brand-elevated rounded-lg" />
                            <View className="h-4 bg-brand-elevated rounded-full" />
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
                            {/* Hero: where the money you owe is sitting */}
                            <View className="rounded-3xl p-5" style={{ backgroundColor: 'rgba(248,113,113,0.08)', borderWidth: 1, borderColor: 'rgba(248,113,113,0.2)' }}>
                                <Text className="text-xs uppercase tracking-widest mb-1" style={{ color: colors.negative }}>You owe</Text>
                                <Text className="text-brand-text font-bold" style={{ fontSize: 40, lineHeight: 46 }}>{usd(total)}</Text>
                                <Text className="text-brand-muted text-xs mt-1">
                                    across {debts.length} account{debts.length === 1 ? '' : 's'}
                                </Text>
                                <View className="flex-row h-4 rounded-full overflow-hidden mt-5 gap-x-0.5">
                                    {debts.filter((a) => amountOwed(a) > 0).map((a) => (
                                        <View key={a.id} style={{ flex: amountOwed(a), backgroundColor: colorOf.get(a.id) }} />
                                    ))}
                                </View>
                                <View className="flex-row flex-wrap gap-x-4 gap-y-1.5 mt-3">
                                    {debts.slice(0, 5).map((a) => (
                                        <View key={a.id} className="flex-row items-center gap-x-1.5">
                                            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: colorOf.get(a.id) }} />
                                            <Text className="text-brand-muted text-xs" numberOfLines={1}>
                                                {a.name} {total > 0 ? Math.round((amountOwed(a) / total) * 100) : 0}%
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>

                            {/* Two quick reads */}
                            <View className="flex-row gap-x-3">
                                <Card className="flex-1 p-4 items-center">
                                    <Text className="text-brand-muted text-xs uppercase tracking-widest mb-3">Card limit used</Text>
                                    {overallUtil !== null ? (
                                        <>
                                            <DonutChart
                                                size={92}
                                                strokeWidth={11}
                                                data={[
                                                    { label: 'used', value: Math.min(overallUtil, 100), color: utilColor(overallUtil) },
                                                    { label: 'free', value: Math.max(0, 100 - overallUtil), color: colors.elevated },
                                                ]}
                                            >
                                                <Text className="text-brand-text text-lg font-bold">{overallUtil.toFixed(0)}%</Text>
                                            </DonutChart>
                                            <Text className="text-xs font-semibold mt-3" style={{ color: utilColor(overallUtil) }}>{utilLabel(overallUtil)}</Text>
                                        </>
                                    ) : (
                                        <Text className="text-brand-muted text-xs text-center leading-relaxed mt-2">
                                            Open a card and tap Set limit to see this.
                                        </Text>
                                    )}
                                </Card>
                                <Card className="flex-1 p-4 justify-between">
                                    <Text className="text-brand-muted text-xs uppercase tracking-widest">Biggest balance</Text>
                                    <View>
                                        <View className="w-2 h-2 rounded-full mb-2" style={{ backgroundColor: colorOf.get(biggest.id) }} />
                                        <Text className="text-brand-text text-2xl font-bold">{usd(amountOwed(biggest))}</Text>
                                        <Text className="text-brand-muted text-xs mt-1" numberOfLines={2}>{biggest.name}</Text>
                                    </View>
                                </Card>
                            </View>

                            {/* Credit cards as card tiles */}
                            {cards.length > 0 && (
                                <View>
                                    <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-3 px-1">Credit cards</Text>
                                    <View className="gap-y-3">
                                        {cards.map((a) => <CardTile key={a.id} account={a} color={colorOf.get(a.id)!} onPress={() => open(a)} />)}
                                    </View>
                                </View>
                            )}

                            {/* Loans with their share of the total */}
                            {loans.length > 0 && (
                                <View>
                                    <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-3 px-1">Loans</Text>
                                    <Card className="p-0 overflow-hidden">
                                        {loans.map((a, i) => {
                                            const owed = amountOwed(a)
                                            const share = total > 0 ? (owed / total) * 100 : 0
                                            const payUrl = getPaymentUrl(a.institutionName)
                                            return (
                                                <TouchableOpacity
                                                    key={a.id}
                                                    activeOpacity={0.7}
                                                    onPress={() => open(a)}
                                                    className={`flex-row items-center px-4 py-4 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                                                >
                                                    <View className="w-10 h-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: `${colorOf.get(a.id)}26` }}>
                                                        <Landmark size={18} color={colorOf.get(a.id)} strokeWidth={1.8} />
                                                    </View>
                                                    <View className="flex-1 pr-3">
                                                        <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>{a.name}</Text>
                                                        <Text className="text-brand-muted text-xs mt-0.5" numberOfLines={1}>
                                                            {formatAccountType(a.type)} · {share.toFixed(0)}% of your debt
                                                        </Text>
                                                        {payUrl && (
                                                            <TouchableOpacity
                                                                className="self-start flex-row items-center gap-x-1 mt-2"
                                                                onPress={(e) => { e.stopPropagation?.(); Linking.openURL(payUrl) }}
                                                                hitSlop={8}
                                                            >
                                                                <Text className="text-xs font-semibold" style={{ color: colors.accent }}>Make a payment</Text>
                                                                <ExternalLink size={10} color={colors.accent} />
                                                            </TouchableOpacity>
                                                        )}
                                                    </View>
                                                    <Text className="text-brand-text text-base font-semibold">{usd(owed)}</Text>
                                                    <ChevronRight size={14} color={colors.disabled} style={{ marginLeft: 6 }} />
                                                </TouchableOpacity>
                                            )
                                        })}
                                    </Card>
                                </View>
                            )}
                        </>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

/** A credit card drawn like a card: colored edge, balance, utilization gauge and a pay button. */
function CardTile({ account, color, onPress }: { account: Account; color: string; onPress: () => void }) {
    const owed = amountOwed(account)
    const limit = account.creditLimit ?? 0
    const util = limit > 0 ? (owed / limit) * 100 : null
    const available = limit > 0 ? Math.max(0, limit - owed) : null
    const payUrl = getPaymentUrl(account.institutionName)

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
            <View className="rounded-2xl overflow-hidden bg-brand-surface border border-brand-border">
                <View style={{ height: 6, backgroundColor: color }} />
                <View className="p-4">
                    <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-3">
                            <Text className="text-brand-text text-base font-semibold" numberOfLines={1}>{account.name}</Text>
                            <Text className="text-brand-muted text-xs mt-0.5" numberOfLines={1}>{account.institutionName}</Text>
                        </View>
                        <CreditCard size={20} color={color} strokeWidth={1.8} />
                    </View>

                    <View className="flex-row items-center justify-between mt-4">
                        <View>
                            <Text className="text-brand-muted text-xs uppercase tracking-widest mb-1">Balance</Text>
                            <Text className="text-brand-text text-3xl font-bold">{usd(owed)}</Text>
                            {available !== null ? (
                                <Text className="text-brand-muted text-xs mt-1">{usd(available)} available of {usd(limit)}</Text>
                            ) : (
                                <Text className="text-xs mt-1" style={{ color: colors.accent }}>Tap to set a credit limit</Text>
                            )}
                        </View>
                        {util !== null && (
                            <DonutChart
                                size={68}
                                strokeWidth={8}
                                data={[
                                    { label: 'used', value: Math.min(util, 100), color: utilColor(util) },
                                    { label: 'free', value: Math.max(0, 100 - util), color: colors.elevated },
                                ]}
                            >
                                <Text className="text-brand-text text-xs font-bold">{util.toFixed(0)}%</Text>
                            </DonutChart>
                        )}
                    </View>

                    {payUrl && (
                        <TouchableOpacity
                            className="flex-row items-center justify-center gap-x-1.5 h-10 rounded-xl mt-4"
                            style={{ backgroundColor: `${colors.accent}26` }}
                            onPress={(e) => { e.stopPropagation?.(); Linking.openURL(payUrl) }}
                            activeOpacity={0.7}
                        >
                            <Text className="text-sm font-semibold" style={{ color: colors.accent }}>Pay now</Text>
                            <ExternalLink size={12} color={colors.accent} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    )
}
