import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, ChevronDown, Search, X, Sparkles, AlertTriangle, CreditCard } from 'lucide-react-native'
import { apiClient } from '@/lib/api-client'
import type { RewardsOverview } from '@/lib/types'
import { colors } from '@/lib/colors'
import { haptics } from '@/lib/haptics'
import { pctText, rewardLabel } from '@/lib/rewards'
import { Card } from '@/components/ui/Card'
import { CardRatesSheet } from '@/components/rewards/CardRatesSheet'
import { ProgressRing } from '@/components/charts/ProgressRing'
import { colorForIndex } from '@/components/charts/palette'

const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`

// Quick picks for the lookup, in the order people ask.
const QUICK_PICKS = ['DINING', 'GROCERIES', 'GAS', 'ONLINE_RETAIL', 'COSTCO', 'AMAZON', 'FLIGHTS', 'OTHER']

export default function RewardsScreen() {
    const router = useRouter()
    const [q, setQ] = useState('')
    const [openCard, setOpenCard] = useState<string | null>(null)
    const [showDebit, setShowDebit] = useState(false)

    const { data, isLoading, error, refetch, isRefetching } = useQuery<RewardsOverview>({
        queryKey: ['rewards'],
        queryFn: async () => (await apiClient.get('/rewards')).data.data,
        staleTime: 5 * 60 * 1000,
    })

    const query = q.trim().toLowerCase()
    const results = data && query
        ? data.lookup.filter(l => l.label.toLowerCase().includes(query) || l.key.toLowerCase().includes(query.replace(/\s+/g, '_'))).slice(0, 8)
        : []
    const quick = data ? QUICK_PICKS.map(k => data.lookup.find(l => l.key === k)).filter((l): l is NonNullable<typeof l> => !!l) : []
    const missed = data ? Math.max(0, data.optimalRewards - data.currentRewards) : 0
    // How much of the best-case rewards you're actually capturing
    const capture = data && data.optimalRewards > 0 ? Math.min(1, data.currentRewards / data.optimalRewards) : 1
    const captureColor = capture >= 0.9 ? colors.positive : '#F5AE39'
    const walletTotal = data?.wallet.reduce((sum, w) => sum + w.annualRewards, 0) ?? 0
    const feeByCard = new Map((data?.feeChecks ?? []).map(f => [f.cardId, f]))
    const partner = data?.partnerName ?? 'your partner'
    const cardLabel = (name: string, mine: boolean) => (mine ? name : `${name} (${partner}’s)`)

    // Checking/savings/other accounts whose debit card might pay rewards (opt-in).
    // Checking/savings/other accounts whose debit card might pay rewards (opt-in). Collapsed
    // by default: the explanation and list take a lot of room for something set up once.
    const DebitSection = () => !data || data.debitCandidates.length === 0 ? null : (
        <Card className="p-0 overflow-hidden">
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => { haptics.light(); setShowDebit(v => !v) }}
                className="flex-row items-center justify-between px-4 py-3.5"
            >
                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest">
                    Debit cards with rewards ({data.debitCandidates.length})
                </Text>
                <ChevronDown size={16} color={colors.muted} style={{ transform: [{ rotate: showDebit ? '180deg' : '0deg' }] }} />
            </TouchableOpacity>
            {showDebit && (
                <View className="border-t border-brand-border">
                    <Text className="text-brand-muted text-xs px-4 pt-3 pb-1 leading-relaxed">
                        Some debit cards pay real cash back (PayPal’s, for example). Turn rewards on for the account it spends from and it counts with your credit cards.
                    </Text>
                    {data.debitCandidates.map((c, i) => (
                        <TouchableOpacity
                            key={c.accountId}
                            activeOpacity={0.7}
                            onPress={() => { haptics.light(); setOpenCard(c.accountId) }}
                            className={`flex-row items-center px-4 py-3.5 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                        >
                            <View className="flex-1 pr-3">
                                <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>{c.accountName}</Text>
                                <Text className="text-brand-muted text-xs mt-0.5" numberOfLines={1}>{c.institutionName}</Text>
                            </View>
                            <ChevronRight size={14} color={colors.disabled} />
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </Card>
    )

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
            >
                <View className="flex-row items-center gap-x-2 px-6 pt-4 pb-2">
                    <TouchableOpacity onPress={() => router.back()} hitSlop={8} className="-ml-2">
                        <ChevronLeft size={24} color={colors.muted} />
                    </TouchableOpacity>
                    <Text className="text-brand-text text-2xl font-bold">Rewards</Text>
                </View>

                <View className="px-6 gap-y-5 pb-10 pt-3">
                    {isLoading ? (
                        <Card className="p-5 gap-y-3">
                            <View className="h-3 w-24 bg-brand-elevated rounded" />
                            <View className="h-9 w-40 bg-brand-elevated rounded-lg" />
                            <View className="h-3 w-48 bg-brand-elevated rounded" />
                        </Card>
                    ) : error || !data ? (
                        <View className="items-center py-16">
                            <Text className="text-brand-muted text-sm mb-3">Could not load rewards.</Text>
                            <TouchableOpacity onPress={() => refetch()} className="bg-brand-accent rounded-xl px-5 h-10 items-center justify-center">
                                <Text className="text-white font-semibold">Try again</Text>
                            </TouchableOpacity>
                        </View>
                    ) : data.wallet.length === 0 && data.debitCandidates.length === 0 ? (
                        <View className="items-center py-16">
                            <View className="w-14 h-14 rounded-2xl bg-brand-surface border border-brand-border items-center justify-center mb-4">
                                <CreditCard size={24} color={colors.muted} strokeWidth={1.5} />
                            </View>
                            <Text className="text-brand-text font-semibold mb-1">No credit cards yet</Text>
                            <Text className="text-brand-muted text-sm text-center leading-relaxed px-8 mb-5">
                                Link a credit card and Affida will show which card to use for each purchase.
                            </Text>
                            <TouchableOpacity onPress={() => router.push('/(app)/accounts' as any)} className="bg-brand-accent rounded-xl px-5 h-11 items-center justify-center">
                                <Text className="text-white font-semibold">Go to Accounts</Text>
                            </TouchableOpacity>
                        </View>
                    ) : data.wallet.length === 0 ? (
                        <>
                            <Text className="text-brand-muted text-sm leading-relaxed px-1">
                                No credit cards linked yet. If a debit card of yours pays rewards, turn it on below.
                            </Text>
                            <DebitSection />
                        </>
                    ) : (
                        <>
                            {/* Summary */}
                            {data.enoughData ? (
                                <Card className="p-5">
                                    <View className="flex-row items-center gap-x-5">
                                        <ProgressRing progress={capture} color={captureColor} size={118} strokeWidth={12}>
                                            <Text className="text-brand-text text-2xl font-bold">{Math.round(capture * 100)}%</Text>
                                            <Text className="text-brand-muted text-[10px] uppercase tracking-widest">captured</Text>
                                        </ProgressRing>
                                        <View className="flex-1 gap-y-3">
                                            <View>
                                                <Text className="text-brand-muted text-xs uppercase tracking-widest mb-1">Earning now</Text>
                                                <Text className="text-brand-text text-2xl font-bold">{usd(data.currentRewards)}<Text className="text-brand-muted text-sm font-normal">/yr</Text></Text>
                                            </View>
                                            <View>
                                                <Text className="text-brand-muted text-xs uppercase tracking-widest mb-1">Could earn</Text>
                                                <Text className="text-brand-positive text-xl font-bold">{usd(data.optimalRewards)}<Text className="text-brand-muted text-sm font-normal">/yr</Text></Text>
                                            </View>
                                        </View>
                                    </View>
                                    <Text className="text-brand-muted text-xs mt-3 leading-relaxed">
                                        {missed >= 5
                                            ? `+${usd(missed)}/yr by using the right card for each category. Based on ${data.monthsOfData >= 11.5 ? 'the last 12 months' : `${Math.round(data.monthsOfData)} months, scaled to a year`} of spending.`
                                            : 'You’re already using the right cards.'}
                                    </Text>
                                </Card>
                            ) : (
                                <Card className="p-4">
                                    <Text className="text-brand-muted text-sm leading-relaxed">
                                        We need at least two months of spending to estimate your rewards. The card lookup below works now.
                                    </Text>
                                </Card>
                            )}

                            {/* Interest warning */}
                            {data.carryingBalance && (
                                <View className="flex-row items-start gap-x-3 rounded-2xl p-4 bg-brand-negative/10 border border-brand-negative/20">
                                    <AlertTriangle size={16} color={colors.destructive} style={{ marginTop: 1 }} />
                                    <View className="flex-1 gap-y-1">
                                        <Text className="text-brand-negative text-sm font-semibold">
                                            {!data.interestVsRewards || data.interestVsRewards.interestEstimated
                                                ? 'You’re carrying a balance'
                                                : data.interestVsRewards.interestExceedsRewards ? 'Interest is costing more than rewards earn' : 'Interest is eating into your rewards'}
                                        </Text>
                                        {data.interestVsRewards && (data.interestVsRewards.interestPerYear > 0 || !data.interestVsRewards.interestEstimated) && (
                                            <Text className="text-brand-text text-xs leading-relaxed">
                                                {usd(data.interestVsRewards.interestPerYear)}/yr {data.interestVsRewards.interestEstimated ? 'estimated interest (none charged yet)' : 'interest charged'} vs {usd(data.interestVsRewards.rewardsPerYear)}/yr rewards
                                            </Text>
                                        )}
                                        <Text className="text-brand-muted text-xs leading-relaxed">
                                            You’re carrying a balance on {data.carriedCards.join(', ')}. New purchases there usually start accruing interest right away, so advice here skips {data.carriedCards.length === 1 ? 'it' : 'them'}.
                                        </Text>
                                    </View>
                                </View>
                            )}

                            {/* Which card? */}
                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-3 px-1">Which card should I use?</Text>
                                <Card className="p-4 gap-y-3">
                                    <View className="flex-row items-center bg-brand-elevated border border-brand-border rounded-xl px-3 h-11">
                                        <Search size={16} color={colors.muted} />
                                        <TextInput
                                            className="flex-1 ml-2 text-brand-text text-base"
                                            value={q}
                                            onChangeText={setQ}
                                            placeholder="Costco, gas, dining, flights…"
                                            placeholderTextColor={colors.muted}
                                            autoCorrect={false}
                                            returnKeyType="search"
                                        />
                                        {q.length > 0 && (
                                            <TouchableOpacity onPress={() => setQ('')} hitSlop={8}><X size={16} color={colors.muted} /></TouchableOpacity>
                                        )}
                                    </View>

                                    {!query ? (
                                        <View className="flex-row flex-wrap gap-2">
                                            {quick.map(l => {
                                                const any = l.tied && l.returnPct <= 1.5
                                                return (
                                                    <TouchableOpacity
                                                        key={l.key}
                                                        onPress={() => { haptics.light(); setQ(l.label) }}
                                                        activeOpacity={0.7}
                                                        className="rounded-xl bg-brand-elevated border border-brand-border p-3"
                                                        style={{ width: '48.5%' }}
                                                    >
                                                        <Text className="text-brand-muted text-xs" numberOfLines={1}>{l.label}</Text>
                                                        <Text className="text-brand-positive text-xl font-bold mt-0.5">{pctText(l.returnPct).replace(' back', '')}</Text>
                                                        <Text className="text-brand-text text-xs mt-0.5" numberOfLines={1}>
                                                            {any ? 'Any card' : l.accountName}
                                                        </Text>
                                                    </TouchableOpacity>
                                                )
                                            })}
                                        </View>
                                    ) : results.length === 0 ? (
                                        <Text className="text-brand-muted text-sm text-center py-3">No match. Try a category like Dining or a store like Costco.</Text>
                                    ) : (
                                        <View>
                                            {results.map((l, i) => {
                                                const any = l.tied && l.returnPct <= 1.5
                                                return (
                                                    <View key={l.key} className={`flex-row items-center py-3 ${i > 0 ? 'border-t border-brand-border' : ''}`}>
                                                        <View className="flex-1 pr-3">
                                                            <Text className="text-brand-text text-sm font-medium">{l.label}</Text>
                                                            <Text className="text-brand-muted text-xs mt-0.5">
                                                                <Text className="text-brand-positive font-semibold">{pctText(l.returnPct)}</Text>{l.capped ? ' (up to a limit)' : ''}
                                                            </Text>
                                                        </View>
                                                        <Text className="text-brand-text text-sm font-semibold text-right flex-shrink" numberOfLines={2}>
                                                            {any ? 'Any of your cards' : cardLabel(l.accountName, l.mine)}{l.debit ? ' (debit)' : ''}
                                                        </Text>
                                                    </View>
                                                )
                                            })}
                                        </View>
                                    )}
                                </Card>
                            </View>

                            {/* Your cards */}
                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-1 px-1">Your cards</Text>
                                <Text className="text-brand-muted text-xs mb-3 px-1 leading-relaxed">
                                    Make sure each card and its rates are right: every rewards estimate uses them.
                                </Text>
                                <Card className="p-0 overflow-hidden">
                                    {walletTotal > 0 && (
                                        <View className="px-4 pt-4 pb-2">
                                            <View className="flex-row h-2.5 rounded-full overflow-hidden bg-brand-elevated gap-x-0.5">
                                                {data.wallet.filter(w => w.annualRewards > 0).map((w) => (
                                                    <View
                                                        key={w.accountId}
                                                        style={{ flex: w.annualRewards, backgroundColor: colorForIndex(data.wallet.indexOf(w)) }}
                                                    />
                                                ))}
                                            </View>
                                            <Text className="text-brand-muted text-xs mt-2">Share of the rewards you earn, by card</Text>
                                        </View>
                                    )}
                                    {data.wallet.map((w, i) => {
                                        const fee = feeByCard.get(w.walletCardId)
                                        return (
                                            <TouchableOpacity
                                                key={w.accountId}
                                                activeOpacity={0.7}
                                                onPress={() => { haptics.light(); setOpenCard(w.accountId) }}
                                                className={`flex-row items-center px-4 py-3.5 ${i > 0 || walletTotal > 0 ? 'border-t border-brand-border' : ''}`}
                                            >
                                                <View className="w-2.5 h-9 rounded-full mr-3" style={{ backgroundColor: colorForIndex(i) }} />
                                                <View className="flex-1 pr-3 gap-y-0.5">
                                                    <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>{w.accountName}</Text>
                                                    <Text className="text-brand-muted text-xs" numberOfLines={2}>
                                                        {[
                                                            w.isDebit ? 'Debit' : null,
                                                            !w.mine ? `${partner}’s card` : null,
                                                            w.card && w.card.name !== w.accountName ? w.card.name : null,
                                                            w.card ? (w.customized ? 'some rates are yours' : null) : (w.customized ? 'your rates' : 'unknown card, counted as 1% back'),
                                                        ].filter(Boolean).join(' · ') || 'Published rates'}
                                                    </Text>
                                                    {w.carriesBalance && <Text className="text-brand-negative text-xs">Carries a balance: avoid new purchases</Text>}
                                                    {fee && !fee.worthIt && (
                                                        <Text className="text-brand-negative text-xs">
                                                            Earns {usd(w.annualRewards)}/yr, but only {usd(fee.marginalRewards)}/yr more than your other cards would, less than its {usd(fee.annualFee)} fee
                                                        </Text>
                                                    )}
                                                    {w.match === 'UNKNOWN' && !w.customized && w.canEdit && (
                                                        <Text className="text-brand-accent text-xs font-semibold">Tap to pick your card or add its rates</Text>
                                                    )}
                                                </View>
                                                <View className="items-end mr-1">
                                                    <Text className="text-brand-text text-sm font-semibold">~{usd(w.annualRewards)}<Text className="text-brand-muted text-xs font-normal">/yr</Text></Text>
                                                    <Text className="text-brand-muted text-xs mt-0.5">{usd(w.annualSpend)} spent</Text>
                                                </View>
                                                <ChevronRight size={14} color={colors.disabled} />
                                            </TouchableOpacity>
                                        )
                                    })}
                                </Card>
                            </View>

                            <DebitSection />

                            {/* New cards */}
                            {!data.ownCarryingBalance && data.suggestions.length > 0 && (
                                <View>
                                    <View className="flex-row items-center gap-x-2 mb-1 px-1">
                                        <Sparkles size={14} color={colors.positive} />
                                        <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest">Cards that fit your spending</Text>
                                    </View>
                                    <Text className="text-brand-muted text-xs mb-3 px-1 leading-relaxed">What adding each card would earn on top of your cards, after its annual fee.</Text>
                                    <View className="gap-y-2">
                                        {data.suggestions.slice(0, 3).map(s => (
                                            <Card key={s.card.id} className="p-4 gap-y-1.5">
                                                <View className="flex-row items-start justify-between">
                                                    <View className="flex-1 pr-3">
                                                        <Text className="text-brand-text text-sm font-semibold">{s.card.name}</Text>
                                                        <Text className="text-brand-muted text-xs mt-0.5">
                                                            {s.card.issuer} · {s.card.annualFee > 0 ? `${usd(s.card.annualFee)} annual fee` : 'No annual fee'}
                                                            {s.card.requirement ? ` · requires ${s.card.requirement}` : ''}
                                                        </Text>
                                                    </View>
                                                    <Text className="text-brand-positive text-sm font-bold">+{usd(s.netGain)}/yr</Text>
                                                </View>
                                                <Text className="text-brand-muted text-xs">
                                                    {s.breakdown.slice(0, 3).map(b => `${rewardLabel(b.merchant ?? b.category)} ${pctText(b.returnPct).replace(' back', '')}`).join(' · ')}
                                                </Text>
                                            </Card>
                                        ))}
                                    </View>
                                </View>
                            )}

                            <Text className="text-brand-muted text-xs leading-relaxed px-1">
                                Estimates use each card’s published earning rates (or the rates you set) and value points and miles at 1¢ each. Sign-up bonuses, statement credits and rotating 5% categories aren’t counted. Approval isn’t guaranteed and terms change, so check the issuer before applying. Not financial advice.
                            </Text>
                        </>
                    )}
                </View>
            </ScrollView>

            <CardRatesSheet accountId={openCard} onClose={() => setOpenCard(null)} />
        </SafeAreaView>
    )
}
