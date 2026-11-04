import { useState } from 'react'
import { Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Check } from 'lucide-react-native'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { colors } from '@/lib/colors'

/** Returned by PATCH /transactions/[id] the third time the same change is made (same bank category to the same new category). */
export interface CategoryOffer {
    correctionId: string
    newCategoryName: string
    times: number
    plaidCategory: string
    currentMappingName: string | null
    narrow: { text: string; pastCount: number } | null
    broad: { examples: string[]; otherStores: number; pastCount: number } | null
    pastCountBoth: number
}

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
    const [rule, setRule] = useState(false)
    const [mapping, setMapping] = useState(false)
    const [past, setPast] = useState(false)
    const [busy, setBusy] = useState(false)
    if (!offer) return null
    const { narrow, broad } = offer
    const pastCount = rule && mapping ? offer.pastCountBoth : rule ? narrow?.pastCount ?? 0 : mapping ? broad?.pastCount ?? 0 : 0

    const reset = () => { setRule(false); setMapping(false); setPast(false) }
    const send = async (choice: { rule: boolean; mapping: boolean; past: boolean }) => {
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
            reset()
            onDone()
        } catch {
            Alert.alert('Error', 'Could not save that. Please try again.')
        } finally { setBusy(false) }
    }

    const summary = !rule && !mapping
        ? 'Nothing will change until you pick one.'
        : `Saving will: ${[
            rule && narrow && `create a rule for "${narrow.text}"`,
            mapping && 'save the bank-category mapping',
            past && pastCount > 0 ? `move ${plural(pastCount, 'past transaction', 'past transactions')}` : 'leave everything already in your accounts as it is',
        ].filter(Boolean).join(', ')}.`

    return (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => send({ rule: false, mapping: false, past: false })}>
            <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                <ScrollView className="flex-1 px-4 pt-6" showsVerticalScrollIndicator={false}>
                    <Text className="text-brand-text text-lg font-semibold">Want these filed under {offer.newCategoryName} automatically?</Text>
                    <Text className="text-brand-muted text-sm mt-2 mb-4">
                        You have moved {offer.times} transactions your bank labels {offer.plaidCategory} to {offer.newCategoryName}
                        {offer.currentMappingName ? ` (they were going to ${offer.currentMappingName})` : ''}. You can make that stick in either way below, or both.
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
                            A bank-category mapping for {offer.plaidCategory}: any new transaction the bank labels this way goes to {offer.newCategoryName}
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
                    <TouchableOpacity onPress={() => send({ rule: false, mapping: false, past: false })} disabled={busy} className="flex-1 h-12 rounded-xl border border-brand-border items-center justify-center mr-2">
                        <Text className="text-brand-text font-semibold">Not now</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => send({ rule, mapping, past: past && pastCount > 0 })} disabled={busy || (!rule && !mapping)} className={`flex-1 h-12 rounded-xl items-center justify-center ${!rule && !mapping ? 'bg-brand-disabled' : 'bg-brand-accent'}`}>
                        {busy ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Save</Text>}
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    )
}
