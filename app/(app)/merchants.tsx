import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { apiClient } from '@/lib/api-client'
import { Card } from '@/components/ui/Card'
import { colorForIndex } from '@/components/charts/palette'
import { compactUsd, toMonthKey } from '@/lib/format'
import { haptics } from '@/lib/haptics'
import { merchantStats, percentChange, searchMerchants } from '@/lib/merchant-history'
import type { MerchantHistory, MerchantSeries, MerchantTransaction } from '@/lib/types'
import { colors } from '@/lib/colors'

// Top Payees: where the money went, month by month. Opens on the stacked chart of the top payees; search a payee
// to see just it. Same numbers as the website (GET /api/mobile/merchants).

const TOP = 6
const OTHER = '#3F3F50'
const usd = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const monthShort = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
const monthLong = (m: string) => new Date(`${m}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const dayLabel = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

function pctText(pct: number | null, vs: string) {
    if (pct === null) return ''
    return `${pct >= 0 ? '↑' : '↓'} ${Math.abs(Math.round(pct))}% ${vs}`
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <View className="flex-1 min-w-[45%] bg-brand-surface border border-brand-border rounded-2xl p-3">
            <Text className="text-brand-muted text-xs">{label}</Text>
            <Text className="text-brand-text text-lg font-semibold mt-1">{value}</Text>
            <Text className="text-brand-muted text-[11px] mt-0.5 min-h-[14px]">{sub ?? ''}</Text>
        </View>
    )
}

export default function MerchantsScreen() {
    const router = useRouter()
    const params = useLocalSearchParams<{ search?: string }>()
    const endMonth = toMonthKey(new Date())

    const { data, isLoading, refetch, isRefetching } = useQuery<MerchantHistory>({
        queryKey: ['merchants', endMonth],
        queryFn: async () => (await apiClient.get('/merchants', { params: { endMonth } })).data.data,
    })

    const months = useMemo(() => data?.months ?? [], [data])
    const merchants = useMemo(() => data?.merchants ?? [], [data])
    const last = months.length - 1
    const [curIdx, setCurIdx] = useState<number | null>(null)
    const idx = curIdx ?? Math.max(last, 0)
    const [allMonths, setAllMonths] = useState(false)
    const [query, setQuery] = useState('')
    const [selKey, setSelKey] = useState<string | null>(null)
    const [rowLimit, setRowLimit] = useState(15)

    // Opened from a tapped merchant elsewhere in the app: pick it as soon as the data is here
    useEffect(() => {
        if (!params.search || merchants.length === 0) return
        const hit = searchMerchants(merchants, String(params.search))[0]
        if (hit) setSelKey(hit.key)
    }, [params.search, merchants])

    const top = useMemo(() => merchants.slice(0, TOP), [merchants])
    const selected: MerchantSeries | null = useMemo(() => merchants.find(m => m.key === selKey) ?? null, [merchants, selKey])
    const suggestions = useMemo(() => (query.trim() ? searchMerchants(merchants, query).slice(0, 6) : []), [merchants, query])
    const selColor = selected ? colorForIndex(Math.max(top.findIndex(t => t.key === selected.key), 0)) : colors.accent

    const [from, to] = allMonths ? [0, last] : [idx, idx]
    const prev = !allMonths && idx > 0 ? idx - 1 : null

    // Chart columns: one per month, stacked by top payees (or just the picked one)
    const columns = useMemo(() => months.map((m, i) => {
        if (selected) return { i, total: selected.amounts[i], parts: [{ v: Math.max(selected.amounts[i], 0), c: selColor }] }
        const parts = top.map((t, k) => ({ v: Math.max(t.amounts[i], 0), c: colorForIndex(k) }))
        const used = parts.reduce((s, p) => s + p.v, 0)
        const total = data?.monthTotals[i] ?? 0
        return { i, total, parts: [...parts, { v: Math.max(total - used, 0), c: OTHER }] }
    }), [months, selected, top, selColor, data])
    const chartMax = Math.max(1, ...columns.map(c => c.total))

    const totals = useMemo(() => {
        if (!data) return null
        const sum = (arr: number[], a: number, b: number) => { let s = 0; for (let i = a; i <= b; i++) s += arr[i] ?? 0; return s }
        const spent = sum(data.monthTotals, from, to)
        const visits = sum(data.monthVisits, from, to)
        return {
            spent, visits, avg: visits > 0 ? spent / visits : null,
            count: merchants.filter(m => merchantStats(m, from, to).spent > 0.005).length,
            prevSpent: prev === null ? null : data.monthTotals[prev],
            prevVisits: prev === null ? null : data.monthVisits[prev],
        }
    }, [data, merchants, from, to, prev])

    const rows = useMemo(() => merchants
        .map(m => ({ m, s: merchantStats(m, from, to) }))
        .filter(r => r.s.spent > 0.005)
        .sort((a, b) => b.s.spent - a.s.spent), [merchants, from, to])

    // The picked payee's own transactions
    const { data: txs } = useQuery<MerchantTransaction[]>({
        queryKey: ['merchant-transactions', selKey, endMonth],
        enabled: !!selKey,
        queryFn: async () => (await apiClient.get('/merchants/transactions', { params: { key: selKey, endMonth } })).data.data,
    })
    const windowStart = months[from] ? `${months[from]}-01` : ''
    const windowEnd = (() => {
        if (!months[to]) return ''
        const d = new Date(`${months[to]}-01T00:00:00Z`)
        d.setUTCMonth(d.getUTCMonth() + 1)
        return d.toISOString().slice(0, 10)
    })()
    const shownTxs = (txs ?? []).filter(t => t.date >= windowStart && t.date < windowEnd)

    const pick = (key: string | null) => { haptics.light(); setSelKey(key); setQuery('') }
    const selStats = selected ? merchantStats(selected, from, to) : null
    const selPrev = selected && prev !== null ? merchantStats(selected, prev, prev) : null
    const vs = prev !== null ? `vs ${monthShort(months[prev])}` : ''

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            <View className="px-6 pt-4 pb-2">
                <View className="flex-row items-center gap-x-2">
                    <TouchableOpacity onPress={() => router.back()} hitSlop={8} className="-ml-2">
                        <ChevronLeft size={24} color={colors.muted} />
                    </TouchableOpacity>
                    <Text className="text-brand-text text-2xl font-bold">Top Payees</Text>
                </View>
            </View>

            {isLoading ? (
                <View className="flex-1 items-center justify-center"><ActivityIndicator color={colors.accent} /></View>
            ) : merchants.length === 0 ? (
                <View className="flex-1 items-center justify-center px-6">
                    <Text className="text-brand-muted text-center">No spending found in the last 12 months.</Text>
                </View>
            ) : (
                <ScrollView
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48, gap: 16 }}
                    keyboardShouldPersistTaps="handled"
                    refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
                >
                    {/* Search: pick one payee to see just it */}
                    <View>
                        {selected ? (
                            <View className="flex-row items-center bg-brand-elevated border border-brand-border rounded-xl px-3 h-11 gap-x-2">
                                <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: selColor }} />
                                <Text className="text-brand-text font-medium flex-1" numberOfLines={1}>{selected.name}</Text>
                                <TouchableOpacity onPress={() => pick(null)} hitSlop={8} className="flex-row items-center gap-x-1">
                                    <X size={16} color={colors.muted} />
                                    <Text className="text-brand-muted text-xs">Top payees</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View className="flex-row items-center bg-brand-elevated border border-brand-border rounded-xl px-3 h-11 gap-x-2">
                                <Search size={16} color={colors.muted} />
                                <TextInput
                                    className="flex-1 text-brand-text text-base"
                                    value={query}
                                    onChangeText={(t) => { setQuery(t); setRowLimit(15) }}
                                    placeholder="Search your payees to see just one"
                                    placeholderTextColor={colors.muted}
                                    autoCorrect={false}
                                    autoCapitalize="none"
                                    returnKeyType="search"
                                    onSubmitEditing={() => suggestions[0] && pick(suggestions[0].key)}
                                />
                                {query ? (
                                    <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}><X size={16} color={colors.muted} /></TouchableOpacity>
                                ) : null}
                            </View>
                        )}
                        {!selected && query.trim() ? (
                            <View className="mt-2 bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
                                {suggestions.length === 0 ? (
                                    <Text className="text-brand-muted text-sm px-4 py-3">No payee matches “{query.trim()}”</Text>
                                ) : suggestions.map((m, i) => (
                                    <TouchableOpacity
                                        key={m.key}
                                        onPress={() => pick(m.key)}
                                        activeOpacity={0.7}
                                        className={`flex-row items-center justify-between px-4 py-3 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                                    >
                                        <Text className="text-brand-text text-sm flex-1 pr-3" numberOfLines={1}>{m.name}</Text>
                                        <Text className="text-brand-muted text-xs">{usd(m.total)} · {m.totalVisits} visit{m.totalVisits === 1 ? '' : 's'}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        ) : null}
                    </View>

                    {/* Chart */}
                    <Card className="p-4">
                        <Text className="text-brand-text font-semibold text-base mb-1">{selected ? selected.name : 'Where your money went'}</Text>
                        <Text className="text-brand-muted text-xs mb-3">{selected ? 'Spent by month. Tap a month.' : 'Month by month. Tap a month to see it below.'}</Text>
                        <View className="flex-row items-end justify-between" style={{ height: 150 }}>
                            {columns.map(c => (
                                <TouchableOpacity
                                    key={c.i}
                                    activeOpacity={0.7}
                                    onPress={() => { haptics.light(); setAllMonths(false); setCurIdx(c.i) }}
                                    className="flex-1 items-center justify-end h-full"
                                    style={{ opacity: !allMonths && c.i !== idx ? 0.55 : 1 }}
                                >
                                    <View style={{ width: 14, height: Math.max(2, (c.total / chartMax) * 150), borderRadius: 3, overflow: 'hidden', justifyContent: 'flex-end' }}>
                                        {c.parts.slice().reverse().map((p, k) => (
                                            <View key={k} style={{ height: c.total > 0 ? `${(p.v / c.total) * 100}%` : 0, backgroundColor: p.c }} />
                                        ))}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View className="flex-row justify-between mt-2">
                            {months.map((m, i) => (
                                <Text key={m} className={`flex-1 text-center text-[10px] ${i === idx && !allMonths ? 'text-brand-text font-semibold' : 'text-brand-muted'}`}>{monthShort(m)[0]}</Text>
                            ))}
                        </View>
                        {!selected && (
                            <View className="flex-row flex-wrap gap-x-3 gap-y-1.5 mt-3">
                                {top.map((t, k) => (
                                    <TouchableOpacity key={t.key} onPress={() => pick(t.key)} className="flex-row items-center gap-x-1.5" activeOpacity={0.7}>
                                        <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: colorForIndex(k) }} />
                                        <Text className="text-brand-muted text-xs" numberOfLines={1}>{t.name}</Text>
                                    </TouchableOpacity>
                                ))}
                                <View className="flex-row items-center gap-x-1.5">
                                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: OTHER }} />
                                    <Text className="text-brand-muted text-xs">Everyone else</Text>
                                </View>
                            </View>
                        )}
                    </Card>

                    {/* Period */}
                    <View className="flex-row items-center justify-between">
                        <Text className="text-brand-text font-semibold text-base">{allMonths ? `Last ${months.length} months` : monthLong(months[idx])}</Text>
                        <View className="flex-row items-center gap-x-2">
                            <TouchableOpacity onPress={() => { haptics.light(); setAllMonths(a => !a) }} className="px-3 py-1.5 rounded-lg border border-brand-border" activeOpacity={0.7}>
                                <Text className="text-brand-muted text-xs">{allMonths ? 'One month' : `All ${months.length} months`}</Text>
                            </TouchableOpacity>
                            {!allMonths && (
                                <>
                                    <TouchableOpacity disabled={idx === 0} onPress={() => { haptics.light(); setCurIdx(idx - 1) }} hitSlop={8} style={{ opacity: idx === 0 ? 0.3 : 1 }}><ChevronLeft size={20} color={colors.muted} /></TouchableOpacity>
                                    <TouchableOpacity disabled={idx === last} onPress={() => { haptics.light(); setCurIdx(idx + 1) }} hitSlop={8} style={{ opacity: idx === last ? 0.3 : 1 }}><ChevronRight size={20} color={colors.muted} /></TouchableOpacity>
                                </>
                            )}
                        </View>
                    </View>

                    <View className="flex-row flex-wrap gap-3">
                        {selected && selStats ? (
                            <>
                                <Tile label="Spent" value={usd(selStats.spent)} sub={selPrev ? pctText(percentChange(selStats.spent, selPrev.spent), vs) : undefined} />
                                <Tile label="Visits" value={String(selStats.visits)} sub={selPrev ? pctText(percentChange(selStats.visits, selPrev.visits), vs) : undefined} />
                                <Tile label="Average per visit" value={selStats.average === null ? '—' : usd(selStats.average)} />
                                <Tile label="Biggest purchase" value={selStats.largest > 0 ? usd(selStats.largest) : '—'} />
                            </>
                        ) : totals && (
                            <>
                                <Tile label="Total spent" value={usd(totals.spent)} sub={totals.prevSpent !== null ? pctText(percentChange(totals.spent, totals.prevSpent), vs) : undefined} />
                                <Tile label="Different payees" value={String(totals.count)} />
                                <Tile label="Visits" value={String(totals.visits)} sub={totals.prevVisits !== null ? pctText(percentChange(totals.visits, totals.prevVisits), vs) : undefined} />
                                <Tile label="Average per visit" value={totals.avg === null ? '—' : usd(totals.avg)} />
                            </>
                        )}
                    </View>

                    {/* Picked payee: its transactions */}
                    {selected && (
                        <Card className="p-4">
                            <View className="flex-row items-center justify-between mb-3">
                                <Text className="text-brand-text font-semibold text-base">Transactions</Text>
                                {selected.variants.length > 0 && <Text className="text-brand-muted text-[11px]">{selected.variants.length} spellings combined</Text>}
                            </View>
                            {!txs ? (
                                <ActivityIndicator color={colors.accent} />
                            ) : shownTxs.length === 0 ? (
                                <Text className="text-brand-muted text-sm">No purchases in this period.</Text>
                            ) : (
                                shownTxs.slice(0, 30).map((t, i) => (
                                    <View key={t.id} className={`flex-row items-center py-2.5 ${i > 0 ? 'border-t border-brand-border' : ''}`}>
                                        <View className="flex-1 pr-3">
                                            <Text className={`text-sm ${t.splitPart ? 'text-brand-muted' : 'text-brand-text'}`} numberOfLines={1}>
                                                {t.splitPart ? 'Split part' : t.description}{t.category ? ` · ${t.category}` : ''}
                                            </Text>
                                            <Text className="text-brand-muted text-xs">{dayLabel(t.date)}</Text>
                                        </View>
                                        <Text className={`text-sm font-medium ${t.amount < 0 ? 'text-brand-positive' : 'text-brand-text'}`}>
                                            {t.amount < 0 ? `+${usd(-t.amount)}` : usd(t.amount)}
                                        </Text>
                                    </View>
                                ))
                            )}
                        </Card>
                    )}

                    {/* Every payee */}
                    <Card className="p-4">
                        <Text className="text-brand-text font-semibold text-base mb-3">All payees</Text>
                        {rows.length === 0 ? (
                            <Text className="text-brand-muted text-sm">No spending in this period.</Text>
                        ) : rows.slice(0, rowLimit).map(({ m, s }, i) => {
                            const ci = top.findIndex(t => t.key === m.key)
                            return (
                                <TouchableOpacity
                                    key={m.key}
                                    onPress={() => pick(m.key)}
                                    activeOpacity={0.7}
                                    className={`flex-row items-center py-3 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                                >
                                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: ci >= 0 ? colorForIndex(ci) : OTHER, marginRight: 10 }} />
                                    <View className="flex-1 pr-3">
                                        <Text className="text-brand-text text-sm" numberOfLines={1}>{m.name}</Text>
                                        <Text className="text-brand-muted text-xs">{s.visits} visit{s.visits === 1 ? '' : 's'}{s.average !== null ? ` · ${usd(s.average)} avg` : ''}</Text>
                                    </View>
                                    <Text className="text-brand-text text-sm font-medium">{compactUsd(s.spent)}</Text>
                                </TouchableOpacity>
                            )
                        })}
                        {rows.length > rowLimit && (
                            <TouchableOpacity onPress={() => setRowLimit(n => n + 25)} className="pt-3" activeOpacity={0.7}>
                                <Text className="text-brand-muted text-sm underline">Show more ({rows.length - rowLimit} more)</Text>
                            </TouchableOpacity>
                        )}
                    </Card>
                </ScrollView>
            )}
        </SafeAreaView>
    )
}
