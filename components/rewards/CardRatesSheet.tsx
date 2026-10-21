import { useState } from 'react'
import {
    Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Linking,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Pencil, Plus, RotateCcw, ExternalLink, ChevronDown } from 'lucide-react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { CardRewardsDetail, RewardKind } from '@/lib/types'
import { OptionPicker } from '@/components/OptionPicker'
import { Card } from '@/components/ui/Card'
import { colors } from '@/lib/colors'
import { haptics } from '@/lib/haptics'
import { KIND_LABEL, rateText } from '@/lib/rewards'

interface Props {
    /** The credit card account to show; null when closed. */
    accountId: string | null
    onClose: () => void
}

type EditRate = { key: string; rate: string; capAmount: string; capPeriod: 'MONTH' | 'QUARTER' | 'YEAR' }
const NEXT_PERIOD = { MONTH: 'QUARTER', QUARTER: 'YEAR', YEAR: 'MONTH' } as const
const PERIOD_NAME = { MONTH: 'month', QUARTER: 'quarter', YEAR: 'year' } as const

function errorMessage(e: any, fallback: string) {
    return e?.response?.data?.error ?? e?.message ?? fallback
}

/**
 * A card's rewards: which card it is, the published rates, and your own rates on top.
 * Mirrors the web CardRewardsEditor; edits feed every rewards estimate.
 */
export function CardRatesSheet({ accountId, onClose }: Props) {
    const queryClient = useQueryClient()
    const [editing, setEditing] = useState(false)
    const [kind, setKind] = useState<RewardKind>('CASHBACK')
    const [baseRate, setBaseRate] = useState('')
    const [rates, setRates] = useState<EditRate[]>([])
    const [picker, setPicker] = useState<'card' | 'add' | null>(null)

    const { data, isLoading, error } = useQuery<CardRewardsDetail>({
        queryKey: ['rewards', 'card', accountId],
        queryFn: async () => (await apiClient.get(`/rewards/cards/${accountId}`)).data.data,
        enabled: !!accountId,
    })

    const refresh = () => queryClient.invalidateQueries({ queryKey: ['rewards'] })

    const { mutate: save, isPending: saving } = useMutation({
        mutationFn: async () => {
            const base = Number(baseRate)
            const parsed = rates.map(r => {
                const amount = Number(r.capAmount)
                return { key: r.key, rate: Number(r.rate), cap: r.capAmount.trim() !== '' && amount > 0 ? { amount, period: r.capPeriod } : null }
            })
            if (!Number.isFinite(base) || base < 0 || parsed.some(r => !Number.isFinite(r.rate) || r.rate < 0))
                throw new Error('Rates must be numbers of 0 or more.')
            if (rates.some(r => r.capAmount.trim() !== '' && !(Number(r.capAmount) > 0)))
                throw new Error('A limit must be an amount above $0, or left empty.')
            await apiClient.put(`/rewards/cards/${accountId}`, { kind, baseRate: base, rates: parsed })
        },
        onSuccess: () => { haptics.success(); setEditing(false); refresh() },
        onError: (e: any) => { haptics.error(); Alert.alert('Could not save', errorMessage(e, 'Please try again.')) },
    })

    const { mutate: reset, isPending: resetting } = useMutation({
        mutationFn: async () => { await apiClient.delete(`/rewards/cards/${accountId}`) },
        onSuccess: () => { haptics.success(); refresh() },
        onError: (e: any) => { haptics.error(); Alert.alert('Could not reset', errorMessage(e, 'Please try again.')) },
    })

    const { mutate: setCard, isPending: settingCard } = useMutation({
        mutationFn: async (cardId: string | null) => { await apiClient.patch(`/rewards/cards/${accountId}`, { cardId }) },
        onSuccess: () => { haptics.success(); refresh() },
        onError: (e: any) => { haptics.error(); Alert.alert('Could not save', errorMessage(e, 'Please try again.')) },
    })

    const startEdit = () => {
        if (!data) return
        haptics.light()
        setKind(data.kind)
        setBaseRate(String(data.baseRate))
        setRates(data.lines.map(l => ({ key: l.key, rate: String(l.rate), capAmount: l.capAmount ? String(l.capAmount) : '', capPeriod: l.capPeriod ?? 'MONTH' })))
        setEditing(true)
    }

    const close = () => { setEditing(false); setPicker(null); onClose() }

    const confirmReset = () => {
        haptics.warning()
        Alert.alert('Use published rates?', `${data?.catalogCard?.name ?? 'This card'} goes back to its published rates. Your changes are removed.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Use published', style: 'destructive', onPress: () => reset() },
        ])
    }

    const confirmOff = () => {
        haptics.warning()
        Alert.alert('Turn off debit rewards?', 'This account stops counting in your rewards and the rates you entered are removed.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Turn off', style: 'destructive', onPress: () => setCard(null) },
        ])
    }

    if (!accountId) return null

    const unit = (editing ? kind : data?.kind) === 'CASHBACK' ? '%' : 'x'
    const used = new Set(rates.map(r => r.key))
    const labelFor = (key: string) => data?.keys.find(k => k.key === key)?.label ?? key
    const publishedFor = (key: string) => data?.lines.find(l => l.key === key)?.publishedRate ?? null
    const busy = saving || resetting || settingCard

    return (
        <Modal visible animationType="slide" presentationStyle="formSheet" onRequestClose={close}>
            <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={close} hitSlop={8} className="w-8"><X size={20} color={colors.muted} /></TouchableOpacity>
                        <Text className="flex-1 text-center text-brand-text text-base font-semibold" numberOfLines={1}>{data?.accountName ?? 'Card rewards'}</Text>
                        {editing ? (
                            <TouchableOpacity onPress={() => save()} disabled={saving} hitSlop={8} className="items-end">
                                {saving ? <ActivityIndicator size="small" color={colors.accent} /> : <Text className="text-brand-accent font-semibold text-sm">Save</Text>}
                            </TouchableOpacity>
                        ) : <View className="w-8" />}
                    </View>

                    {isLoading ? (
                        <View className="flex-1 items-center justify-center"><ActivityIndicator color={colors.accent} /></View>
                    ) : error || !data ? (
                        <View className="flex-1 items-center justify-center px-8"><Text className="text-brand-muted text-sm text-center">Could not load this card.</Text></View>
                    ) : (
                        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
                            <View className="px-4 pt-5 pb-10 gap-y-4">
                                {data.isDebit && !data.enabled ? (
                                    <Card className="p-4 gap-y-3">
                                        <Text className="text-brand-text text-base font-semibold">Debit card rewards are off</Text>
                                        <Text className="text-brand-muted text-sm leading-relaxed">
                                            Does the debit card on this account pay rewards? Turn it on and its purchases count with your credit cards.
                                        </Text>
                                        {data.canEdit ? (
                                            <TouchableOpacity onPress={() => { haptics.light(); setPicker('card') }} disabled={busy} className="h-11 rounded-xl bg-brand-accent items-center justify-center">
                                                <Text className="text-white font-semibold">Turn on debit rewards</Text>
                                            </TouchableOpacity>
                                        ) : <Text className="text-brand-muted text-xs">Only the owner or an editor can turn this on.</Text>}
                                    </Card>
                                ) : (<>
                                {/* Which card */}
                                <Card className="p-4 gap-y-2">
                                    <Text className="text-brand-text text-base font-semibold">
                                        {data.catalogCard ? data.catalogCard.name : 'Card not in our list'}
                                    </Text>
                                    <Text className="text-brand-muted text-xs">
                                        {data.catalogCard ? `${data.catalogCard.issuer} · ` : ''}
                                        {data.isDebit ? 'Debit card' : data.match === 'CONFIRMED' ? 'Confirmed by you'
                                            : data.match === 'AUTO' ? 'Detected from the account name'
                                            : data.customized ? 'Using your rates' : 'Counted as 1% back until you add its rates'}
                                    </Text>
                                    {data.canEdit && !editing && (
                                        <TouchableOpacity
                                            onPress={() => { haptics.light(); setPicker('card') }}
                                            disabled={busy}
                                            className="flex-row items-center self-start gap-x-1 mt-1"
                                        >
                                            <Text className="text-brand-accent text-sm font-semibold">
                                                {data.match === 'CONFIRMED' ? 'Change card' : data.match === 'AUTO' ? 'Not this card? Pick yours' : 'Which card is this?'}
                                            </Text>
                                            <ChevronDown size={14} color={colors.accent} />
                                        </TouchableOpacity>
                                    )}
                                    {data.notes ? <Text className="text-brand-muted text-xs leading-relaxed mt-1">{data.notes}</Text> : null}
                                </Card>

                                {!editing ? (
                                    <>
                                        {data.isDebit && data.lines.length === 0 && data.userPick && (
                                            <Text className="text-brand-muted text-xs leading-relaxed px-1">
                                                You choose the {data.userPick.rate}% category yourself. Add it under Edit rates and we’ll count it
                                                {data.userPick.cap ? ` up to $${data.userPick.cap.amount.toLocaleString('en-US')}/${PERIOD_NAME[data.userPick.cap.period]}` : ''}.
                                            </Text>
                                        )}
                                        <View>
                                            <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-3 px-1">Rates</Text>
                                            <Card className="p-0 overflow-hidden">
                                                {data.lines.map((l, i) => (
                                                    <View key={l.key} className={`flex-row items-center px-4 py-3 ${i > 0 ? 'border-t border-brand-border' : ''}`}>
                                                        <View className="flex-1 pr-3">
                                                            <Text className="text-brand-text text-sm">{l.label}</Text>
                                                            {l.cap && <Text className="text-brand-muted text-xs mt-0.5">{l.cap}</Text>}
                                                        </View>
                                                        <View className="items-end">
                                                            <Text className="text-brand-positive text-sm font-semibold">{rateText(data.kind, l.rate, l.returnPct)}</Text>
                                                            {l.custom && (
                                                                <Text className="text-brand-muted text-xs mt-0.5">
                                                                    Your rate{l.publishedRate !== null && l.publishedRate !== l.rate ? ` (published ${l.publishedRate}${data.kind === 'CASHBACK' ? '%' : 'x'})` : ''}
                                                                </Text>
                                                            )}
                                                        </View>
                                                    </View>
                                                ))}
                                                {data.choices.map(c => (
                                                    <View key={c.label} className="flex-row items-center px-4 py-3 border-t border-brand-border">
                                                        <View className="flex-1 pr-3">
                                                            <Text className="text-brand-text text-sm">{c.label}</Text>
                                                            <Text className="text-brand-muted text-xs mt-0.5">Pick {c.pick}: {c.options.join(' / ')}</Text>
                                                        </View>
                                                        <Text className="text-brand-positive text-sm font-semibold">{rateText(data.kind, c.rate, c.returnPct)}</Text>
                                                    </View>
                                                ))}
                                                <View className={`flex-row items-center px-4 py-3 ${data.lines.length + data.choices.length > 0 ? 'border-t border-brand-border' : ''}`}>
                                                    <Text className="flex-1 text-brand-text text-sm">Everything else</Text>
                                                    <View className="items-end">
                                                        <Text className="text-brand-text text-sm font-semibold">
                                                            {rateText(data.kind, data.baseRate, Math.round(data.baseRate * data.pointValueCents * 100) / 100)}
                                                        </Text>
                                                        {data.baseCustom && <Text className="text-brand-muted text-xs mt-0.5">Your rate</Text>}
                                                    </View>
                                                </View>
                                            </Card>
                                        </View>

                                        {data.canEdit && (
                                            <View className="gap-y-3">
                                                <TouchableOpacity onPress={startEdit} disabled={busy} className="h-11 rounded-xl bg-brand-accent flex-row items-center justify-center gap-x-2">
                                                    <Pencil size={15} color="#fff" />
                                                    <Text className="text-white font-semibold">{data.catalogCard || data.customized ? 'Edit rates' : 'Add this card’s rates'}</Text>
                                                </TouchableOpacity>
                                                {data.isDebit && (
                                                    <TouchableOpacity onPress={confirmOff} disabled={busy} className="h-11 rounded-xl border border-brand-border items-center justify-center">
                                                        <Text className="text-brand-muted font-semibold">Turn off rewards</Text>
                                                    </TouchableOpacity>
                                                )}
                                                {data.customized && data.catalogCard && !data.isDebit && (
                                                    <TouchableOpacity onPress={confirmReset} disabled={busy} className="h-11 rounded-xl border border-brand-border flex-row items-center justify-center gap-x-2">
                                                        {resetting ? <ActivityIndicator size="small" color={colors.muted} /> : <RotateCcw size={15} color={colors.text} />}
                                                        <Text className="text-brand-text font-semibold">Use published rates</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        )}
                                        {data.catalogCard?.sourceUrl ? (
                                            <TouchableOpacity onPress={() => Linking.openURL(data.catalogCard!.sourceUrl)} className="flex-row items-center justify-center gap-x-1">
                                                <Text className="text-brand-muted text-xs">
                                                    Published rates checked {new Date(`${data.catalogCard.verifiedAt}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })}
                                                </Text>
                                                <ExternalLink size={11} color={colors.muted} />
                                            </TouchableOpacity>
                                        ) : null}
                                    </>
                                ) : (
                                    <>
                                        {!data.catalogCard && (
                                            <View className="flex-row bg-brand-surface border border-brand-border rounded-xl p-1">
                                                {(['CASHBACK', 'POINTS', 'MILES'] as const).map(k => (
                                                    <TouchableOpacity key={k} onPress={() => { haptics.light(); setKind(k) }} className={`flex-1 h-9 rounded-lg items-center justify-center ${kind === k ? 'bg-brand-accent' : ''}`}>
                                                        <Text className={`text-sm font-semibold ${kind === k ? 'text-white' : 'text-brand-muted'}`}>{KIND_LABEL[k]}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                        <Text className="text-brand-muted text-xs leading-relaxed px-1">
                                            {kind === 'CASHBACK' ? 'Percent back per dollar.' : 'Points or miles per dollar.'}
                                            {data.catalogCard ? ' Change only what’s wrong; anything you leave as published stays published.' : ''}
                                        </Text>

                                        <Card className="p-0 overflow-hidden">
                                            {rates.map((r, i) => {
                                                const published = publishedFor(r.key)
                                                return (
                                                    <View key={r.key} className={`px-4 py-2.5 ${i > 0 ? 'border-t border-brand-border' : ''}`}>
                                                      <View className="flex-row items-center">
                                                        <View className="flex-1 pr-2">
                                                            <Text className="text-brand-text text-sm" numberOfLines={1}>{labelFor(r.key)}</Text>
                                                            {published !== null && Number(r.rate) !== published && (
                                                                <Text className="text-brand-muted text-xs mt-0.5">published {published}{unit}</Text>
                                                            )}
                                                        </View>
                                                        <TextInput
                                                            className="bg-brand-elevated border border-brand-border rounded-lg px-3 h-10 w-20 text-brand-text text-right"
                                                            value={r.rate}
                                                            onChangeText={(t) => setRates(prev => prev.map((x, j) => (j === i ? { ...x, rate: t } : x)))}
                                                            keyboardType="decimal-pad"
                                                        />
                                                        <Text className="text-brand-muted text-sm w-5 text-center">{unit}</Text>
                                                        <TouchableOpacity onPress={() => { haptics.light(); setRates(prev => prev.filter((_, j) => j !== i)) }} hitSlop={8} className="w-7 items-end">
                                                            <X size={16} color={colors.muted} />
                                                        </TouchableOpacity>
                                                      </View>
                                                      <View className="flex-row items-center gap-x-2 mt-2">
                                                        <Text className="text-brand-muted text-xs">Limit: first $</Text>
                                                        <TextInput
                                                            className="bg-brand-elevated border border-brand-border rounded-lg px-2 h-8 w-24 text-brand-text text-xs text-right"
                                                            value={r.capAmount}
                                                            placeholder="no limit"
                                                            placeholderTextColor={colors.muted}
                                                            onChangeText={(t) => setRates(prev => prev.map((x, j) => (j === i ? { ...x, capAmount: t } : x)))}
                                                            keyboardType="decimal-pad"
                                                        />
                                                        <Text className="text-brand-muted text-xs">per</Text>
                                                        <TouchableOpacity
                                                            onPress={() => { haptics.light(); setRates(prev => prev.map((x, j) => (j === i ? { ...x, capPeriod: NEXT_PERIOD[x.capPeriod] } : x))) }}
                                                            className="px-2.5 h-8 rounded-lg bg-brand-surface border border-brand-border items-center justify-center"
                                                        >
                                                            <Text className="text-brand-text text-xs font-semibold">{PERIOD_NAME[r.capPeriod]}</Text>
                                                        </TouchableOpacity>
                                                      </View>
                                                    </View>
                                                )
                                            })}
                                            <TouchableOpacity onPress={() => { haptics.light(); setPicker('add') }} className={`flex-row items-center gap-x-2 px-4 py-3 ${rates.length > 0 ? 'border-t border-brand-border' : ''}`}>
                                                <Plus size={15} color={colors.accent} />
                                                <Text className="text-brand-accent text-sm font-semibold">Add a category or store</Text>
                                            </TouchableOpacity>
                                            <View className="flex-row items-center px-4 py-2.5 border-t border-brand-border">
                                                <View className="flex-1 pr-2">
                                                    <Text className="text-brand-text text-sm">Everything else</Text>
                                                    {data.publishedBaseRate !== null && Number(baseRate) !== data.publishedBaseRate && (
                                                        <Text className="text-brand-muted text-xs mt-0.5">published {data.publishedBaseRate}{unit}</Text>
                                                    )}
                                                </View>
                                                <TextInput
                                                    className="bg-brand-elevated border border-brand-border rounded-lg px-3 h-10 w-20 text-brand-text text-right"
                                                    value={baseRate}
                                                    onChangeText={setBaseRate}
                                                    keyboardType="decimal-pad"
                                                />
                                                <Text className="text-brand-muted text-sm w-5 text-center">{unit}</Text>
                                                <View className="w-7" />
                                            </View>
                                        </Card>

                                        <TouchableOpacity onPress={() => setEditing(false)} disabled={saving} className="h-11 rounded-xl border border-brand-border items-center justify-center">
                                            <Text className="text-brand-muted font-semibold">Cancel</Text>
                                        </TouchableOpacity>
                                    </>
                                )}
                                </>)}
                            </View>
                        </ScrollView>
                    )}
                </KeyboardAvoidingView>

                {data && (
                    <>
                        <OptionPicker
                            visible={picker === 'card'}
                            title={data.isDebit ? 'Which debit card?' : 'Which card is this?'}
                            noneLabel={data.isDebit ? 'Cancel' : 'Detect automatically'}
                            selectedValue={data.match === 'CONFIRMED' ? data.catalogCard?.id ?? null : null}
                            options={[
                                { label: data.isDebit ? 'My debit card isn’t listed' : 'My card isn’t listed', value: 'OTHER' },
                                ...data.catalog.map(c => ({ label: `${c.name} · ${c.issuer}`, value: c.id })),
                            ]}
                            onSelect={(v) => { if (v || !data.isDebit) setCard(v) }}
                            onClose={() => setPicker(null)}
                        />
                        <OptionPicker
                            visible={picker === 'add'}
                            title="Add a category or store"
                            noneLabel="Cancel"
                            selectedValue=""
                            options={data.keys.filter(k => !used.has(k.key)).map(k => ({ label: k.label, value: k.key }))}
                            onSelect={(v) => {
                                if (!v) return
                                const pick = data.userPick
                                setRates(prev => [...prev, {
                                    key: v, rate: pick ? String(pick.rate) : baseRate || '1',
                                    capAmount: pick?.cap ? String(pick.cap.amount) : '', capPeriod: pick?.cap?.period ?? 'MONTH',
                                }])
                            }}
                            onClose={() => setPicker(null)}
                        />
                    </>
                )}
            </SafeAreaView>
        </Modal>
    )
}
