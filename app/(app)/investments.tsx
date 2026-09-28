import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react-native'
import { apiClient } from '@/lib/api-client'
import { Card } from '@/components/ui/Card'
import { AmountText } from '@/components/ui/AmountText'
import { LineChart } from '@/components/charts/LineChart'
import { DonutChart } from '@/components/charts/DonutChart'
import { colorForIndex } from '@/components/charts/palette'
import { compactUsd, formatShortDate, signedPct } from '@/lib/format'
import { haptics } from '@/lib/haptics'
import type { Investments } from '@/lib/types'
import { colors } from '@/lib/colors'

/** ~5 evenly spaced month labels ("Oct", "Jan", …) for a date series. */
function monthLabels(dates: string[], count = 5): string[] {
    if (dates.length < 2) return []
    const out: string[] = []
    for (let i = 0; i < count; i++) {
        const d = dates[Math.round((i / (count - 1)) * (dates.length - 1))]
        out.push(new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short' }))
    }
    return out
}

export default function InvestmentsScreen() {
    const router = useRouter()
    const { data, isLoading, refetch, isRefetching } = useQuery<Investments>({
        queryKey: ['investments'],
        queryFn: async () => (await apiClient.get('/investments')).data.data,
        staleTime: 5 * 60 * 1000,
    })

    const slices = (data?.allocation ?? []).map((a, i) => ({ label: a.label, value: a.value, color: colorForIndex(i), pct: a.pct }))
    const maxDividend = Math.max(1, ...(data?.dividends ?? []).map(d => d.amount))

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
                    <Text className="text-brand-text text-2xl font-bold">Investments</Text>
                </View>

                <View className="px-6 gap-y-4 pb-10 pt-4">
                    {isLoading ? (
                        <Card className="p-5 gap-y-3">
                            <View className="h-3 w-24 bg-brand-elevated rounded" />
                            <View className="h-9 w-44 bg-brand-elevated rounded-lg" />
                            <View className="h-32 bg-brand-elevated/50 rounded-xl" />
                        </Card>
                    ) : !data?.hasInvestments ? (
                        <View className="items-center py-16">
                            <View className="w-14 h-14 rounded-2xl bg-brand-surface border border-brand-border items-center justify-center mb-4">
                                <TrendingUp size={24} color={colors.muted} strokeWidth={1.5} />
                            </View>
                            <Text className="text-brand-text font-semibold mb-1">No investment accounts</Text>
                            <Text className="text-brand-muted text-sm text-center leading-relaxed px-8 mb-5">
                                Link a brokerage or retirement account to see your portfolio here.
                            </Text>
                            <TouchableOpacity
                                onPress={() => { haptics.medium(); router.push('/(app)/accounts' as any) }}
                                className="bg-brand-accent rounded-xl px-5 h-11 items-center justify-center"
                            >
                                <Text className="text-white font-semibold">Go to Accounts</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            {/* Value */}
                            <Card className="p-5">
                                <Text className="text-brand-muted text-xs uppercase tracking-widest mb-2">Portfolio Value</Text>
                                <AmountText amount={data.totalValue} size="xl" neutral />
                                <View className="flex-row flex-wrap gap-x-4 gap-y-1 mt-2">
                                    {data.change30d && (
                                        <Text className={`text-xs font-medium ${data.change30d.amount >= 0 ? 'text-brand-positive' : 'text-brand-negative'}`}>
                                            {data.change30d.amount >= 0 ? '▲' : '▼'} {compactUsd(Math.abs(data.change30d.amount))} ({signedPct(data.change30d.pct)}) · 30 days
                                        </Text>
                                    )}
                                    {data.gain !== null && (
                                        <Text className="text-brand-muted text-xs">
                                            Total gain{' '}
                                            <Text className={data.gain >= 0 ? 'text-brand-positive' : 'text-brand-negative'}>
                                                {data.gain >= 0 ? '+' : '−'}{compactUsd(Math.abs(data.gain))}
                                                {data.gainPct !== null ? ` (${signedPct(data.gainPct)})` : ''}
                                            </Text>
                                        </Text>
                                    )}
                                </View>
                                {data.history.length >= 2 ? (
                                    <View className="mt-4">
                                        <LineChart
                                            points={data.history.map(p => p.value)}
                                            labels={monthLabels(data.history.map(p => p.date))}
                                            height={130}
                                        />
                                    </View>
                                ) : (
                                    <Text className="text-brand-muted text-xs mt-4">The value chart fills in as your accounts sync each day.</Text>
                                )}
                            </Card>

                            {/* Allocation */}
                            {slices.length > 0 && (
                                <Card className="p-5">
                                    <Text className="text-brand-text font-semibold text-base mb-4">Allocation</Text>
                                    <View className="flex-row items-center gap-x-5">
                                        <DonutChart data={slices} size={120} strokeWidth={16} />
                                        <View className="flex-1 gap-y-2">
                                            {slices.map(s => (
                                                <View key={s.label} className="flex-row items-center">
                                                    <View className="w-2.5 h-2.5 rounded-full mr-2" style={{ backgroundColor: s.color }} />
                                                    <Text className="text-brand-text text-sm flex-1" numberOfLines={1}>{s.label}</Text>
                                                    <Text className="text-brand-muted text-xs">{s.pct.toFixed(0)}%</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </View>
                                </Card>
                            )}

                            {/* Holdings */}
                            {data.holdings.length > 0 && (
                                <View>
                                    <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-3 px-1">Holdings</Text>
                                    <Card className="p-0 overflow-hidden">
                                        {data.holdings.map((h, i) => (
                                            <View key={`${h.ticker ?? h.name}-${i}`} className={`flex-row items-center px-4 py-3 ${i > 0 ? 'border-t border-brand-border' : ''}`}>
                                                <View className="flex-1 pr-3">
                                                    <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>{h.ticker ?? h.name}</Text>
                                                    <Text className="text-brand-muted text-xs mt-0.5" numberOfLines={1}>
                                                        {h.ticker ? `${h.name} · ` : ''}{h.weight.toFixed(1)}% of portfolio
                                                    </Text>
                                                </View>
                                                <View className="items-end">
                                                    <AmountText amount={h.value} size="sm" neutral />
                                                    {h.gain !== null && (
                                                        <Text className={`text-xs mt-0.5 ${h.gain >= 0 ? 'text-brand-positive' : 'text-brand-negative'}`}>
                                                            {h.gain >= 0 ? '+' : '−'}{compactUsd(Math.abs(h.gain))}{h.gainPct !== null ? ` · ${signedPct(h.gainPct)}` : ''}
                                                        </Text>
                                                    )}
                                                </View>
                                            </View>
                                        ))}
                                    </Card>
                                    {data.holdingsAsOf && (
                                        <Text className="text-brand-muted text-xs text-center mt-2">Holdings as of {formatShortDate(data.holdingsAsOf)}</Text>
                                    )}
                                </View>
                            )}

                            {/* Dividends */}
                            {data.dividends.length > 0 && (
                                <Card className="p-5">
                                    <View className="flex-row items-baseline justify-between mb-4">
                                        <Text className="text-brand-text font-semibold text-base">Dividends</Text>
                                        <Text className="text-brand-muted text-xs">
                                            <Text className="text-brand-positive font-semibold">{compactUsd(data.dividends12m)}</Text> past year
                                        </Text>
                                    </View>
                                    <View className="flex-row items-end gap-x-1.5 h-24">
                                        {data.dividends.map(d => (
                                            <View key={d.month} className="flex-1 items-center justify-end h-full">
                                                <View className="w-full rounded-t bg-brand-positive/80" style={{ height: `${Math.max(4, (d.amount / maxDividend) * 100)}%` }} />
                                            </View>
                                        ))}
                                    </View>
                                    <View className="flex-row gap-x-1.5 mt-1.5">
                                        {data.dividends.map(d => (
                                            <Text key={d.month} className="flex-1 text-center text-brand-muted text-[9px]">
                                                {new Date(`${d.month}-15T12:00:00`).toLocaleDateString('en-US', { month: 'narrow' })}
                                            </Text>
                                        ))}
                                    </View>
                                </Card>
                            )}

                            {/* Accounts */}
                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-3 px-1">Accounts</Text>
                                <Card className="p-0 overflow-hidden">
                                    {data.accounts.map((a, i) => (
                                        <TouchableOpacity
                                            key={a.id}
                                            onPress={() => { haptics.light(); router.push(`/(app)/accounts/${a.id}` as any) }}
                                            activeOpacity={0.7}
                                            className={`flex-row items-center px-4 py-3 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                                        >
                                            <View className="flex-1 pr-3">
                                                <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>{a.name}</Text>
                                                {a.institutionName && <Text className="text-brand-muted text-xs mt-0.5">{a.institutionName}</Text>}
                                            </View>
                                            <AmountText amount={a.balance} size="sm" neutral />
                                            <ChevronRight size={14} color={colors.disabled} style={{ marginLeft: 4 }} />
                                        </TouchableOpacity>
                                    ))}
                                </Card>
                            </View>
                        </>
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}
