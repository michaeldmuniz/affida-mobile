import { useEffect, useState } from 'react'
import { Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, TextInput } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Check, ChevronLeft } from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { colors } from '@/lib/colors'

/** Returned by PATCH /transactions/[id] the third time the same change is made (same bank category to the same new category). */
export interface CategoryOffer {
    correctionId: string
    newCategoryName: string
    times: number
    /** How many times this store was moved to the new category, and how many times this bank category was */
    merchantTimes?: number
    bankTimes?: number
    /** '' for a typed or imported entry (no bank category) */
    plaidCategory: string
    currentMappingName: string | null
    narrow: { text: string; pastCount: number } | null
    broad: { examples: string[]; otherStores: number; pastCount: number } | null
    pastCountBoth: number
}

interface PreviewItem { id: string; date: string; label: string; amount: number; account: string; category: string | null }
const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const dayLabel = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** "FOOD_AND_DRINK_RESTAURANTS" as plain words, like the website */
const plainBankLabel = (k: string) => { const w = k.toLowerCase().split('_').filter(Boolean).join(' '); return w.charAt(0).toUpperCase() + w.slice(1) }

function Option({ checked, onPress, tag, title, children, disabled }: { checked: boolean; onPress: () => void; tag?: string; title: string; children: React.ReactNode; disabled?: boolean }) {
    return (
        <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked, disabled }}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
            className={`flex-row rounded-xl border p-3 mb-2 ${checked ? 'border-brand-accent bg-brand-elevated' : 'border-brand-border bg-brand-surface'} ${disabled ? 'opacity-50' : ''}`}
        >
            <View className={`w-5 h-5 rounded border mr-3 mt-0.5 items-center justify-center ${checked ? 'bg-brand-accent border-brand-accent' : 'border-brand-muted'}`}>
                {checked && <Check size={13} color="#fff" />}
            </View>
            <View className="flex-1">
                <View className="flex-row items-center flex-wrap">
                    <Text className="text-brand-text text-sm font-semibold mr-2">{title}</Text>
                    {tag && <Text className="text-brand-muted text-[10px] font-semibold uppercase tracking-widest">{tag}</Text>}
                </View>
                <Text className="text-brand-muted text-sm mt-1">{children}</Text>
            </View>
        </TouchableOpacity>
    )
}

/**
 * "Want these filed under X automatically?": a rule for the store (narrow), a mapping for the bank's category (broad), usable
 * together, and an extra to also move the past transactions they cover. Same wording and rules as the website's dialog;
 * only new transactions change unless "past" is ticked. Settings pages named here live on the website.
 */
export function CategoryOfferSheet({ offer, onDone }: { offer: CategoryOffer | null; onDone: () => void }) {
    const queryClient = useQueryClient()
    const [step, setStep] = useState<'choose' | 'review'>('choose')
    // The suggested answer is ticked (the store's rule, and moving what it covers); the broad mapping is the person's call
    const [rule, setRule] = useState(false)
    const [mapping, setMapping] = useState(false)
    const [past, setPast] = useState(false)
    const [busy, setBusy] = useState(false)
    const [ruleText, setRuleText] = useState('')
    const [preview, setPreview] = useState<{ total: number; items: PreviewItem[] } | null>(null)
    const [loadingPreview, setLoadingPreview] = useState(false)
    const [excluded, setExcluded] = useState<Set<string>>(new Set())

    // Each new offer starts from its own defaults
    const correctionId = offer?.correctionId
    useEffect(() => {
        if (!offer) return
        setStep('choose')
        setRule(!!offer.narrow)
        setMapping(false)
        setPast((offer.narrow?.pastCount ?? 0) > 0)
        setRuleText(offer.narrow?.text ?? '')
        setPreview(null)
        setExcluded(new Set())
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [correctionId])

    const textOk = ruleText.trim().length > 0 && ruleText.trim().length <= 80

    // The review's list of past transactions follows the ticked ways and the rule's text (a short wait while typing)
    useEffect(() => {
        if (step !== 'review' || !correctionId) return
        if (!(rule && textOk) && !mapping) { setPreview({ total: 0, items: [] }); return }
        let stale = false
        setLoadingPreview(true)
        const timer = setTimeout(() => {
            apiClient.post('/category-offer', { correctionId, preview: true, rule: rule && textOk, mapping, ruleText: ruleText.trim() })
                .then(res => { if (!stale) setPreview({ total: res.data?.data?.total ?? 0, items: res.data?.data?.items ?? [] }) })
                .catch(() => { if (!stale) setPreview({ total: 0, items: [] }) })
                .finally(() => { if (!stale) setLoadingPreview(false) })
        }, 350)
        return () => { stale = true; clearTimeout(timer) }
    }, [step, correctionId, rule, mapping, ruleText, textOk])

    if (!offer) return null
    const { narrow, broad } = offer
    const pastCount = rule && mapping ? offer.pastCountBoth : rule ? narrow?.pastCount ?? 0 : mapping ? broad?.pastCount ?? 0 : 0
    const shown = preview?.items ?? []
    const stillMoving = past ? (preview?.total ?? 0) - shown.filter(i => excluded.has(i.id)).length : 0
    const nothingToApply = !(rule && textOk) && !mapping

    const send = async (choice: { rule: boolean; mapping: boolean; past: boolean; ruleText?: string; excludeIds?: string[] }) => {
        setBusy(true)
        try {
            const res = await apiClient.post('/category-offer', { correctionId: offer.correctionId, ...choice })
            const moved: number = res.data?.data?.moved ?? 0
            if (choice.rule || choice.mapping) {
                queryClient.invalidateQueries({ queryKey: ['transactions'] })
                queryClient.invalidateQueries({ queryKey: ['dashboard'] })
                queryClient.invalidateQueries({ queryKey: ['rules'] })
                const made = [choice.rule && 'a rule', choice.mapping && 'a bank-category mapping'].filter(Boolean).join(' and ')
                Alert.alert(
                    `Saved: ${made}`,
                    moved > 0 ? `${plural(moved, 'past transaction', 'past transactions')} moved to ${offer.newCategoryName}.` : 'Only new transactions are affected. Nothing already in your accounts changed.',
                    moved > 0
                        ? [
                            { text: 'Undo the moves', style: 'destructive', onPress: () => {
                                apiClient.post('/category-offer', { correctionId: offer.correctionId, undo: true })
                                    .then(() => { queryClient.invalidateQueries({ queryKey: ['transactions'] }); queryClient.invalidateQueries({ queryKey: ['dashboard'] }) })
                                    .catch(() => Alert.alert('Error', 'Could not undo the moves.'))
                            } },
                            { text: 'Keep', style: 'cancel' },
                        ]
                        : [{ text: 'OK' }],
                )
            }
            onDone()
        } catch {
            Alert.alert('Error', 'Could not save that. Please try again.')
        } finally { setBusy(false) }
    }
    const notNow = () => send({ rule: false, mapping: false, past: false })
    const applyAll = () => send({ rule, mapping, past: past && pastCount > 0 })
    const applyReviewed = () => send({
        rule: rule && textOk,
        mapping,
        past: past && stillMoving > 0,
        ...(rule && textOk && { ruleText: ruleText.trim() }),
        excludeIds: [...excluded],
    })
    const toggleOne = (id: string) => setExcluded(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })

    const summary = !rule && !mapping
        ? 'Nothing will change until you pick one.'
        : `Apply all will: ${[
            rule && narrow && `create a rule for "${narrow.text}"`,
            mapping && 'save the bank-category mapping',
            past && pastCount > 0 ? `move ${plural(pastCount, 'past transaction', 'past transactions')}` : 'leave everything already in your accounts as it is',
        ].filter(Boolean).join(', ')}.`

    if (step === 'review') {
        return (
            <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setStep('choose')}>
                <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                    <ScrollView className="flex-1 px-4 pt-6" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                        <Text className="text-brand-text text-lg font-semibold">Review changes</Text>
                        <Text className="text-brand-muted text-sm mt-2 mb-4">Everything below goes to {offer.newCategoryName}. Adjust the rule, and untick any past transaction you want left where it is.</Text>

                        {narrow && (
                            <View className={`rounded-xl border border-brand-border bg-brand-surface p-3 mb-2 ${rule ? '' : 'opacity-60'}`}>
                                <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: rule }} onPress={() => setRule(v => !v)} activeOpacity={0.7} className="flex-row items-center">
                                    <View className={`w-5 h-5 rounded border mr-3 items-center justify-center ${rule ? 'bg-brand-accent border-brand-accent' : 'border-brand-muted'}`}>{rule && <Check size={13} color="#fff" />}</View>
                                    <Text className="text-brand-text text-sm font-semibold">Rule for one store</Text>
                                </TouchableOpacity>
                                <Text className="text-brand-muted text-xs mt-2 mb-1.5">New transactions with this in the name go to {offer.newCategoryName}:</Text>
                                <View className="bg-brand-elevated border border-brand-border rounded-lg px-3 h-11 justify-center">
                                    <TextInput className="text-brand-text text-base" value={ruleText} onChangeText={setRuleText} maxLength={80} editable={rule} autoCorrect={false} autoCapitalize="none" placeholderTextColor={colors.muted} />
                                </View>
                                {rule && !textOk && <Text className="text-brand-negative text-xs mt-1">Type the text the rule should look for.</Text>}
                                <Text className="text-brand-muted text-xs mt-1.5">Shorter catches more, longer catches fewer. The list below updates as you type.</Text>
                            </View>
                        )}
                        {broad && (
                            <Option checked={mapping} onPress={() => setMapping(v => !v)} title="Bank-category mapping">
                                Everything your bank calls "{plainBankLabel(offer.plaidCategory)}" goes to {offer.newCategoryName}
                                {broad.examples.length > 0 ? `, including ${broad.examples.join(', ')}${broad.otherStores > 0 ? ` and ${plural(broad.otherStores, 'other store', 'other stores')}` : ''}` : ''}.
                            </Option>
                        )}

                        <View className="rounded-xl border border-brand-border bg-brand-surface p-3 mb-2">
                            <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: past }} disabled={nothingToApply} onPress={() => setPast(v => !v)} activeOpacity={0.7} className={`flex-row items-center ${nothingToApply ? 'opacity-50' : ''}`}>
                                <View className={`w-5 h-5 rounded border mr-3 items-center justify-center ${past ? 'bg-brand-accent border-brand-accent' : 'border-brand-muted'}`}>{past && <Check size={13} color="#fff" />}</View>
                                <Text className="text-brand-text text-sm font-semibold flex-1">Also change past transactions</Text>
                            </TouchableOpacity>
                            {past && shown.length > 0 && (
                                <View className="flex-row items-center justify-between mt-2">
                                    <Text className="text-brand-muted text-xs">{stillMoving} of {preview?.total ?? 0} will move</Text>
                                    <View className="flex-row">
                                        <TouchableOpacity onPress={() => setExcluded(new Set())} hitSlop={8}><Text className="text-brand-muted text-xs underline mr-3">Select all</Text></TouchableOpacity>
                                        <TouchableOpacity onPress={() => setExcluded(new Set(shown.map(i => i.id)))} hitSlop={8}><Text className="text-brand-muted text-xs underline">Select none</Text></TouchableOpacity>
                                    </View>
                                </View>
                            )}
                            {!past ? (
                                <Text className="text-brand-muted text-xs mt-2">Only new transactions will be affected. Everything already in your accounts stays as it is.</Text>
                            ) : loadingPreview && !preview ? (
                                <ActivityIndicator color={colors.accent} style={{ marginTop: 12 }} />
                            ) : shown.length === 0 ? (
                                <Text className="text-brand-muted text-sm mt-2">{nothingToApply ? 'Tick the rule or the mapping above to see what it would move.' : 'No past transactions match. Ones you filed yourself are always left alone.'}</Text>
                            ) : (
                                <View className="mt-2" style={{ opacity: loadingPreview ? 0.6 : 1 }}>
                                    {shown.map((t, i) => {
                                        const on = !excluded.has(t.id)
                                        return (
                                            <TouchableOpacity key={t.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggleOne(t.id)} activeOpacity={0.7}
                                                className={`flex-row items-center py-2.5 ${i > 0 ? 'border-t border-brand-border' : ''}`}>
                                                <View className={`w-5 h-5 rounded border mr-3 items-center justify-center ${on ? 'bg-brand-accent border-brand-accent' : 'border-brand-muted'}`}>{on && <Check size={13} color="#fff" />}</View>
                                                <View className="flex-1 pr-2">
                                                    <Text className={`text-sm ${on ? 'text-brand-text' : 'text-brand-muted'}`} numberOfLines={1}>{t.label}</Text>
                                                    <Text className="text-brand-muted text-xs" numberOfLines={1}>{dayLabel(t.date)} · {t.account}</Text>
                                                    <Text className="text-brand-muted text-xs" numberOfLines={1}>{t.category ?? 'Uncategorized'} → <Text style={on ? undefined : { textDecorationLine: 'line-through' }}>{offer.newCategoryName}</Text></Text>
                                                </View>
                                                <Text className={`text-sm ${on ? 'text-brand-text' : 'text-brand-muted'}`}>{money(t.amount)}</Text>
                                            </TouchableOpacity>
                                        )
                                    })}
                                    {(preview?.total ?? 0) > shown.length && (
                                        <Text className="text-brand-muted text-xs mt-2">Showing the newest {shown.length} of {preview?.total}. The rest move too; turn off "Also change past transactions" to leave them all.</Text>
                                    )}
                                </View>
                            )}
                        </View>
                        <View className="h-6" />
                    </ScrollView>
                    <View className="flex-row px-4 pb-3 pt-2 border-t border-brand-border">
                        <TouchableOpacity onPress={() => setStep('choose')} disabled={busy} className="h-12 px-3 rounded-xl border border-brand-border items-center justify-center mr-2 flex-row">
                            <ChevronLeft size={18} color={colors.muted} /><Text className="text-brand-text font-semibold">Back</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={applyReviewed} disabled={busy || nothingToApply} className={`flex-1 h-12 rounded-xl items-center justify-center ${nothingToApply ? 'bg-brand-disabled' : 'bg-brand-accent'}`}>
                            {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Apply changes</Text>}
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>
        )
    }

    return (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={notNow}>
            <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                <ScrollView className="flex-1 px-4 pt-6" showsVerticalScrollIndicator={false}>
                    <Text className="text-brand-text text-lg font-semibold">Want these filed under {offer.newCategoryName} automatically?</Text>
                    <Text className="text-brand-muted text-sm mt-2 mb-4">
                        {narrow ? `You have moved ${offer.merchantTimes ?? offer.times} "${narrow.text}" transactions to ${offer.newCategoryName}. ` : ''}
                        {broad ? `${narrow ? 'You have also moved ' : 'You have moved '}${offer.bankTimes ?? offer.times} transactions your bank labels ${plainBankLabel(offer.plaidCategory)} to ${offer.newCategoryName}${offer.currentMappingName ? ` (they were going to ${offer.currentMappingName})` : ''}. ` : ''}
                        You can make that stick {narrow && broad ? 'in either way below, or both' : 'below'}.
                    </Text>

                    {narrow && (
                        <Option checked={rule} onPress={() => setRule(v => !v)} tag="One store" title={`Only for "${narrow.text}"`}>
                            A rule: new transactions with "{narrow.text}" in the name go to {offer.newCategoryName}.
                            {narrow.pastCount > 0 ? ` ${plural(narrow.pastCount, 'past transaction matches', 'past transactions match')}.` : ''}
                            {' '}Lives in Settings, Rules on the website.
                        </Option>
                    )}
                    {broad && (
                        <Option checked={mapping} onPress={() => setMapping(v => !v)} tag="Every store" title={`Everything your bank calls "${plainBankLabel(offer.plaidCategory)}"`}>
                            A bank-category mapping for {plainBankLabel(offer.plaidCategory)}: any new transaction the bank labels this way goes to {offer.newCategoryName}
                            {broad.examples.length > 0 ? `, including ${broad.examples.join(', ')}${broad.otherStores > 0 ? ` and ${plural(broad.otherStores, 'other store', 'other stores')}` : ''}` : ''}.
                            {' '}Lives in Settings, Category Mapping on the website.
                        </Option>
                    )}
                    {(rule || mapping) && (
                        <Option checked={past && pastCount > 0} disabled={pastCount === 0} onPress={() => setPast(v => !v)} title="Also change past transactions">
                            {pastCount > 0
                                ? `Moves the ${plural(pastCount, 'transaction', 'transactions')} already in your accounts that your choice covers to ${offer.newCategoryName}. Ones you filed yourself are left alone, and you can undo it right after.`
                                : 'There are no past transactions your choice would move.'}
                        </Option>
                    )}

                    <View className="bg-brand-surface rounded-xl p-3 mt-2">
                        <Text className="text-brand-text text-sm">{summary}</Text>
                    </View>
                    <Text className="text-brand-muted text-xs mt-3 mb-6">We ask after you make the same change 3 times. "Not now" closes this; it comes back only after 3 more.</Text>
                </ScrollView>
                <View className="flex-row px-4 pb-3 pt-2 border-t border-brand-border">
                    <TouchableOpacity onPress={notNow} disabled={busy} className="flex-1 h-12 rounded-xl border border-brand-border items-center justify-center mr-2">
                        <Text className="text-brand-text font-semibold">Not now</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setStep('review')} disabled={busy || (!rule && !mapping)} className="flex-1 h-12 rounded-xl border border-brand-border items-center justify-center mr-2" style={{ opacity: !rule && !mapping ? 0.4 : 1 }}>
                        <Text className="text-brand-text font-semibold text-sm" numberOfLines={1} adjustsFontSizeToFit>Review changes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={applyAll} disabled={busy || (!rule && !mapping)} className={`flex-1 h-12 rounded-xl items-center justify-center ${!rule && !mapping ? 'bg-brand-disabled' : 'bg-brand-accent'}`}>
                        {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Apply all</Text>}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    )
}
