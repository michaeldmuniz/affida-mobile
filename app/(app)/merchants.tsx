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
    const [selKeys, setSelKeys] = useState<string[]>([])
    const [rowLimit, setRowLimit] = useState(15)

    // Opened from a tapped merchant elsewhere in the app: pick it as soon as the data is here
    useEffect(() => {
        if (!params.search || merchants.length === 0) return
        const hit = searchMerchants(merchants, String(params.search))[0]
        if (hit) setSelKeys([hit.key])
    }, [params.search, merchants])

    const top = useMemo(() => merchants.slice(0, TOP), [merchants])
    // Payees picked to look at (one or several), in the order they were added
    const picked: MerchantSeries[] = useMemo(() => selKeys.map(k => merchants.find(m => m.key === k)).filter((m): m is MerchantSeries => !!m), [merchants, selKeys])
    const hasPicks = picked.length > 0
    const selected: MerchantSeries | null = picked.length === 1 ? picked[0] : null
    const pickColor = (key: string) => colorForIndex(Math.max(picked.findIndex(m => m.key === key), 0))
    const suggestions = useMemo(() => (query.trim() ? searchMerchants(merchants, query).filter(m => !selKeys.includes(m.key)).slice(0, 6) : []), [merchants, query, selKeys])

    const [from, to] = allMonths ? [0, last] : [idx, idx]
    const prev = !allMonths && idx > 0 ? idx - 1 : null

    // Chart columns: one per month, stacked by top payees (or just the picked one)
    const columns = useMemo(() => months.map((m, i) => {
        if (hasPicks) {
            const parts = picked.map(p => ({ v: Math.max(p.amounts[i], 0), c: pickColor(p.key) }))
            return { i, total: parts.reduce((t, p) => t + p.v, 0), parts }
        }
        const parts = top.map((t, k) => ({ v: Math.max(t.amounts[i], 0), c: colorForIndex(k) }))
        const used = parts.reduce((s, p) => s + p.v, 0)
        const total = data?.monthTotals[i] ?? 0
        return { i, total, parts: [...parts, { v: Math.max(total - used, 0), c: OTHER }] }
    }), [months, hasPicks, picked, top, data])
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
        queryKey: ['merchant-transactions', selected?.key, endMonth],
        enabled: !!selected,
        queryFn: async () => (await apiClient.get('/merchants/transactions', { params: { key: selected?.key, endMonth } })).data.data,
    })
    const windowStart = months[from] ? `${months[from]}-01` : ''
    const windowEnd = (() => {
        if (!months[to]) return ''
        const d = new Date(`${months[to]}-01T00:00:00Z`)
        d.setUTCMonth(d.getUTCMonth() + 1)
        return d.toISOString().slice(0, 10)
    })()
    const shownTxs = (txs ?? []).filter(t => t.date >= windowStart && t.date < windowEnd)

    const toggle = (key: string) => { haptics.light(); setSelKeys(k => k.includes(key) ? k.filter(x => x !== key) : [...k, key]); setQuery('') }
    const clear = () => { haptics.light(); setSelKeys([]); setQuery('') }
    // The picked payees added together (for one payee, just its own numbers)
    const combine = (a: number, b: number) => {
        let spent = 0; let visits = 0; let largest = 0
        for (const p of picked) { const st = merchantStats(p, a, b); spent += st.spent; visits += st.visits; largest = Math.max(largest, st.largest) }
        return { spent, visits, largest, average: visits > 0 ? spent / visits : null }
    }
    const selStats = hasPicks ? combine(from, to) : null
    const selPrev = hasPicks && prev !== null ? combine(prev, prev) : null
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
                    {/* Search: pick one payee, or several, to see just them */}
                    <View>
                        {hasPicks && (
                            <View className="flex-row flex-wrap items-center gap-2 mb-2">
                                {picked.map(p => (
                                    <TouchableOpacity key={p.key} onPress={() => toggle(p.key)} activeOpacity={0.7} className="flex-row items-center bg-brand-elevated border border-brand-border rounded-full pl-3 pr-2 py-1.5 gap-x-1.5">
                                        <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: pickColor(p.key) }} />
                                        <Text className="text-brand-text text-sm" numberOfLines={1} style={{ maxWidth: 160 }}>{p.name}</Text>
                                        <X size={14} color={colors.muted} />
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity onPress={clear} hitSlop={8}><Text className="text-brand-muted text-xs underline">Top payees</Text></TouchableOpacity>
                            </View>
                        )}
                        <View className="flex-row items-center bg-brand-elevated border border-brand-border rounded-xl px-3 h-11 gap-x-2">
                            <Search size={16} color={colors.muted} />
                            <TextInput
                                className="flex-1 text-brand-text text-base"
                                value={query}
                                onChangeText={(t) => { setQuery(t); setRowLimit(15) }}
                                placeholder={hasPicks ? 'Add another payee to compare' : 'Search your payees to see one, or several'}
                                placeholderTextColor={colors.muted}
                                autoCorrect={false}
                                autoCapitalize="none"
                                returnKeyType="search"
                                onSubmitEditing={() => suggestions[0] && toggle(suggestions[0].key)}
                            />
                            {query ? (
                                <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}><X size={16} color={colors.muted} /></TouchableOpacity>
                            ) : null}
                        </View>
                        {query.trim() ? (
                            <View className="mt-2 bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
                                {suggestions.length === 0 ? (
                                    <Text className="text-brand-muted text-sm px-4 py-3">{searchMerchants(merchants, query).length > 0 ? 'Already added' : `No payee matches “${query.trim()}”`}</Text>
                                ) : suggestions.map((m, i) => (
                                    <TouchableOpacity
                                        key={m.key}
                                        onPress={() => toggle(m.key)}
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
                        <Text className="text-brand-text font-semibold text-base mb-1">{hasPicks ? (selected ? selected.name : `${picked.length} payees`) : 'Where your money went'}</Text>
                        <Text className="text-brand-muted text-xs mb-3">{hasPicks ? 'Spent by month. Tap a month.' : 'Month by month. Tap a month to see it below.'}</Text>
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
                        {!hasPicks && (
                            <View className="flex-row flex-wrap gap-x-3 gap-y-1.5 mt-3">
                                {top.map((t, k) => (
                                    <TouchableOpacity key={t.key} onPress={() => toggle(t.key)} className="flex-row items-center gap-x-1.5" activeOpacity={0.7}>
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
                        {hasPicks && selStats ? (
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

                    {/* Several picked: side by side */}
                    {picked.length > 1 && (
                        <Card className="p-4">
                            <Text className="text-brand-text font-semibold text-base mb-1">Compared</Text>
                            <Text className="text-brand-muted text-xs mb-3">Tap a name below to remove it, or pick one to see its transactions.</Text>
                            {picked.map((p, i) => {
                                const st = merchantStats(p, from, to)
                                return (
                                    <View key={p.key} className={`flex-row items-center py-2.5 ${i > 0 ? 'border-t border-brand-border' : ''}`}>
                                        <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: pickColor(p.key), marginRight: 10 }} />
                                        <View className="flex-1 pr-3">
                                            <Text className="text-brand-text text-sm" numberOfLines={1}>{p.name}</Text>
                                            <Text className="text-brand-muted text-xs">{st.visits} visit{st.visits === 1 ? '' : 's'}{st.average !== null ? ` · ${usd(st.average)} avg` : ''}</Text>
                                        </View>
                                        <Text className="text-brand-text text-sm font-medium mr-3">{usd(st.spent)}</Text>
                                        <TouchableOpacity onPress={() => { haptics.light(); setSelKeys([p.key]) }} hitSlop={8}><Text className="text-brand-accent text-xs">Details</Text></TouchableOpacity>
                                    </View>
                                )
                            })}
                            {selStats && (
                                <View className="flex-row items-center justify-between pt-2.5 border-t border-brand-border">
                                    <Text className="text-brand-text text-sm font-semibold">Together</Text>
                                    <Text className="text-brand-text text-sm font-semibold">{usd(selStats.spent)}</Text>
                                </View>
                            )}
                        </Card>
                    )}

                    {/* One picked payee: its transactions */}
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
                                    onPress={() => toggle(m.key)}
                                    activeOpacity={0.7}
                                    className={`flex-row items-center py-3 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                                >
                                    <View style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: selKeys.includes(m.key) ? pickColor(m.key) : (!hasPicks && ci >= 0 ? colorForIndex(ci) : OTHER), marginRight: 10 }} />
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
