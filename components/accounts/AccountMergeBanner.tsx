import { useState } from 'react'
import { Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { ModalSafeArea } from '@/components/ModalSafeArea'
import { Copy, X } from 'lucide-react-native'
import { useAccountMerge, type MergeSuggestion } from '@/hooks/useAccountMerge'
import { colors } from '@/lib/colors'

const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const serverError = (e: unknown) => ((e as { response?: { data?: { error?: string } } })?.response?.data?.error) ?? 'Please try again in a moment.'
const keyOf = (s: MergeSuggestion) => `${s.manual.id}:${s.synced.id}`

/**
 * Accounts the person typed that the bank also made a copy of (a bank connected from the Add button): "Home Fund" and the
 * bank's "Home Fund". Shown only when there are such pairs. Nothing changes until the person taps Merge and confirms.
 * Mirrors the website's banner (components/accounts/AccountMergeBanner).
 */
export function AccountMergeBanner() {
    const { suggestions, merge, separate } = useAccountMerge()
    const [open, setOpen] = useState(false)
    const [confirming, setConfirming] = useState<string | null>(null)
    if (suggestions.length === 0) return null

    const n = suggestions.length
    const busy = merge.isPending || separate.isPending
    const doMerge = (s: MergeSuggestion) => merge.mutate(s, {
        onSuccess: (r) => { setConfirming(null); Alert.alert(`Merged into “${s.manual.name}”`, `${r.paired} entries matched to the bank’s, ${r.moved} bank entries added${r.keptSeparate ? `, ${r.keptSeparate} left as their own entries because they have receipts or links` : ''}.`) },
        onError: (e) => Alert.alert('Nothing was changed', serverError(e)),
    })
    const doSeparate = (s: MergeSuggestion) => separate.mutate(s, { onError: (e) => Alert.alert('Could not save that', serverError(e)) })

    return (
        <>
            <TouchableOpacity
                onPress={() => setOpen(true)}
                className="flex-row items-center gap-x-3 rounded-xl border border-amber-400/50 bg-amber-400/10 p-4"
                accessibilityRole="button"
                accessibilityLabel="Review accounts that may be in your list twice"
            >
                <Copy size={18} color="#f5ae39" />
                <View className="flex-1">
                    <Text className="text-brand-text text-sm font-semibold">{n === 1 ? 'An account may be in your list twice' : `${n} accounts may be in your list twice`}</Text>
                    <Text className="text-brand-muted text-xs mt-0.5">The bank made its own copy next to {n === 1 ? 'one you typed' : 'ones you typed'}. Review and merge them.</Text>
                </View>
            </TouchableOpacity>

            <Modal visible={open} animationType="slide" onRequestClose={() => { setOpen(false); setConfirming(null) }}>
                <ModalSafeArea className="flex-1 bg-brand-bg">
                    <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
                        <Text className="text-brand-text text-lg font-semibold">Possible duplicate accounts</Text>
                        <TouchableOpacity onPress={() => { setOpen(false); setConfirming(null) }} hitSlop={10} accessibilityLabel="Close"><X size={20} color={colors.muted} /></TouchableOpacity>
                    </View>
                    <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 8, gap: 12 }}>
                        <Text className="text-brand-muted text-xs">
                            Each pair looks like the same account: one you typed and the bank’s own copy. Merging keeps your account (its name and history) and makes it the bank-synced one. Nothing changes until you confirm.
                        </Text>
                        {suggestions.map((s) => (
                            <View key={keyOf(s)} className="rounded-xl border border-brand-border bg-brand-surface p-4 gap-y-3">
                                <View className="flex-row gap-x-4">
                                    <View className="flex-1">
                                        <Text className="text-brand-muted text-xs">You typed</Text>
                                        <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>{s.manual.name}</Text>
                                        <Text className="text-brand-muted text-xs">{money(s.manual.balance)}{s.manual.owed ? ' owed' : ''} · {s.manual.entries} entries</Text>
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-brand-muted text-xs">Bank’s copy</Text>
                                        <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>{s.synced.name}{s.synced.mask ? ` ••${s.synced.mask}` : ''}</Text>
                                        <Text className="text-brand-muted text-xs">{money(s.synced.balance)}{s.synced.owed ? ' owed' : ''} · {s.synced.entries} entries</Text>
                                    </View>
                                </View>
                                <Text className="text-brand-muted text-xs">Why they look the same: {s.reasons.join('; ')}.</Text>
                                {confirming === keyOf(s) ? (
                                    <View className="gap-y-2 rounded-lg bg-brand-elevated p-3">
                                        <Text className="text-brand-text text-xs font-semibold">Merging will:</Text>
                                        {s.effects.map((e) => <Text key={e} className="text-brand-muted text-xs">• {e}</Text>)}
                                        <View className="flex-row gap-x-3 mt-1">
                                            <TouchableOpacity disabled={busy} onPress={() => doMerge(s)} className="rounded-lg bg-brand-accent px-4 py-2" accessibilityRole="button">
                                                {merge.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-white text-xs font-semibold">Yes, merge them</Text>}
                                            </TouchableOpacity>
                                            <TouchableOpacity disabled={busy} onPress={() => setConfirming(null)} className="px-3 py-2" accessibilityRole="button"><Text className="text-brand-muted text-xs">Cancel</Text></TouchableOpacity>
                                        </View>
                                    </View>
                                ) : (
                                    <View className="flex-row gap-x-3">
                                        <TouchableOpacity disabled={busy} onPress={() => setConfirming(keyOf(s))} className="rounded-lg bg-brand-accent px-4 py-2" accessibilityRole="button"><Text className="text-white text-xs font-semibold">Merge</Text></TouchableOpacity>
                                        <TouchableOpacity disabled={busy} onPress={() => doSeparate(s)} className="px-3 py-2" accessibilityRole="button"><Text className="text-brand-muted text-xs">These are separate</Text></TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        ))}
                    </ScrollView>
                </ModalSafeArea>
            </Modal>
        </>
    )
}
