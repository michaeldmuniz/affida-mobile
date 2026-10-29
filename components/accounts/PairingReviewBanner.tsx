import { useState } from 'react'
import { Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Info, X } from 'lucide-react-native'
import { usePairingReview, type ReviewItem } from '@/hooks/usePairingReview'
import { colors } from '@/lib/colors'

const day = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(n).toFixed(2)}`
const serverError = (e: unknown) => ((e as { response?: { data?: { error?: string } } })?.response?.data?.error) ?? 'Please try again in a moment.'

/**
 * After a manual account is connected to a bank: bank charges that may already be in the list as entries the person
 * typed (a purchase entered in three parts, a tip left out), and a record of what was combined automatically.
 * Nothing changes until the person taps Merge and confirms. Nothing is shown when there is nothing to review and
 * nothing new to read. Mirrors the website's banner (components/accounts/PairingReviewBanner).
 */
export function PairingReviewBanner() {
    const { review, merge, undo, separate, markSeen } = usePairingReview()
    const [open, setOpen] = useState(false)
    const [confirming, setConfirming] = useState<string | null>(null)
    const [confirmingUndo, setConfirmingUndo] = useState<string | null>(null)
    if (!review || (review.items.length === 0 && review.unseen === 0)) return null

    const n = review.items.length
    const busy = merge.isPending || separate.isPending || undo.isPending
    const close = () => { setOpen(false); setConfirming(null); setConfirmingUndo(null); if (review.unseen > 0) markSeen.mutate() }
    const doMerge = (item: ReviewItem) => merge.mutate(item, {
        onSuccess: (r) => { setConfirming(null); Alert.alert('Merged', r.summary) },
        onError: (e) => Alert.alert('Nothing was changed', serverError(e)),
    })
    const doUndo = (logId: string) => undo.mutate(logId, {
        onSuccess: () => { setConfirmingUndo(null); Alert.alert('Undone', 'The bank’s charge is back as its own entry and your entries are as they were.') },
        onError: (e) => Alert.alert('Nothing was changed', serverError(e)),
    })
    const doSeparate = (item: ReviewItem) => separate.mutate(item.bankId, {
        onError: (e) => Alert.alert('Could not save that', serverError(e)),
    })

    return (
        <>
            <TouchableOpacity
                onPress={() => setOpen(true)}
                className="flex-row items-center gap-x-3 rounded-xl border border-sky-400/50 bg-sky-400/10 p-4"
                accessibilityRole="button"
                accessibilityLabel={n > 0 ? 'Review possible duplicates' : 'See what changed when your bank connected'}
            >
                <Info size={18} color="#38a3d8" />
                <View className="flex-1">
                    <Text className="text-brand-text text-sm font-semibold">{n > 0 ? 'Possible duplicates' : 'What changed when your bank connected'}</Text>
                    <Text className="text-brand-muted text-xs mt-0.5">
                        {n > 0
                            ? `${n} bank charge${n === 1 ? '' : 's'} may already be in your list as ${n === 1 ? 'an entry' : 'entries'} you typed, so the purchase could be counted twice.`
                            : 'Some of your entries were matched or combined with the bank’s. See exactly what changed.'}
                    </Text>
                </View>
            </TouchableOpacity>

            <Modal visible={open} animationType="slide" onRequestClose={close}>
                <SafeAreaView className="flex-1 bg-brand-bg">
                    <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
                        <Text className="text-brand-text text-xl font-bold">{n > 0 ? 'Possible duplicates' : 'What changed'}</Text>
                        <TouchableOpacity onPress={close} disabled={busy} accessibilityRole="button" accessibilityLabel="Close">
                            <X size={22} color={colors.muted} />
                        </TouchableOpacity>
                    </View>
                    <Text className="text-brand-muted text-sm px-6 pb-3">
                        Nothing below changes until you tap Merge and confirm. Your amounts and categories are never rewritten.
                    </Text>
                    <ScrollView className="flex-1 px-6">
                        {review.items.map((item) => (
                            <View key={item.bankId} className="rounded-xl border border-brand-border bg-brand-surface p-4 mb-3">
                                <Text className="text-brand-muted text-xs">{item.accountName}</Text>
                                <Text className="text-brand-text text-sm font-semibold mt-0.5">
                                    Bank charge · {day(item.bank.day)} · {item.bank.description} · {money(item.bank.amount)}
                                </Text>
                                <Text className="text-brand-muted text-xs font-medium mt-2">You also entered</Text>
                                {item.rows.map((r) => (
                                    <View key={r.id} className="flex-row justify-between gap-x-3 mt-0.5">
                                        <Text className="text-brand-text text-sm flex-1" numberOfLines={1}>{day(r.day)} · {r.description}{r.categoryName ? ` · ${r.categoryName}` : ''}</Text>
                                        <Text className="text-brand-text text-sm">{money(r.amount)}</Text>
                                    </View>
                                ))}
                                {item.rows.map((r) => r.parts ? (
                                    <Text key={`${r.id}-parts`} className="text-brand-muted text-xs mt-0.5 pl-3">split into {r.parts.length} parts: {r.parts.map((p) => `${p.description} ${money(p.amount)}`).join(' · ')}</Text>
                                ) : null)}
                                <Text className="text-brand-text text-sm mt-2"><Text className="font-semibold">Why we think so: </Text>{item.reason}</Text>
                                {item.canMerge
                                    ? <Text className="text-brand-muted text-sm mt-1"><Text className="font-semibold">If you merge: </Text>{item.willDo}</Text>
                                    : <Text className="text-amber-500 text-sm mt-1">{item.cannotMerge} If they are the same purchase, edit or delete one yourself in Transactions.</Text>}
                                <View className="flex-row flex-wrap gap-2 mt-3">
                                    {item.canMerge && confirming !== item.bankId && (
                                        <TouchableOpacity onPress={() => setConfirming(item.bankId)} disabled={busy} className="rounded-lg bg-brand-accent px-4 py-2.5" accessibilityRole="button">
                                            <Text className="text-white text-sm font-semibold">Merge</Text>
                                        </TouchableOpacity>
                                    )}
                                    {item.canMerge && confirming === item.bankId && (
                                        <>
                                            <TouchableOpacity onPress={() => doMerge(item)} disabled={busy} className="rounded-lg bg-brand-accent px-4 py-2.5" accessibilityRole="button">
                                                {merge.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-sm font-semibold">Yes, merge these</Text>}
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => setConfirming(null)} disabled={busy} className="rounded-lg px-4 py-2.5" accessibilityRole="button">
                                                <Text className="text-brand-muted text-sm font-semibold">Cancel</Text>
                                            </TouchableOpacity>
                                        </>
                                    )}
                                    <TouchableOpacity onPress={() => doSeparate(item)} disabled={busy} className="rounded-lg border border-brand-border px-4 py-2.5" accessibilityRole="button">
                                        <Text className="text-brand-text text-sm font-semibold">These are separate purchases</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                        {review.more > 0 && <Text className="text-brand-muted text-xs mb-3">{review.more} more will appear as you work through these.</Text>}

                        {review.log.length > 0 && (
                            <View className="mb-6">
                                <Text className="text-brand-text text-sm font-semibold mb-2">What was done for you</Text>
                                {review.log.map((l) => (
                                    <View key={l.id} className="rounded-lg bg-brand-surface px-3 py-2 mb-2">
                                        <Text className="text-brand-muted text-xs">{new Date(l.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{l.seen ? '' : ' · new'}{l.undone ? ' · undone' : ''}</Text>
                                        <Text className="text-brand-text text-sm">{l.summary}</Text>
                                        {l.undoable && confirmingUndo !== l.id && (
                                            <TouchableOpacity onPress={() => setConfirmingUndo(l.id)} disabled={busy} className="rounded-lg border border-brand-border px-3 py-2 mt-2 self-start" accessibilityRole="button">
                                                <Text className="text-brand-text text-sm font-semibold">Undo this merge</Text>
                                            </TouchableOpacity>
                                        )}
                                        {l.undoable && confirmingUndo === l.id && (
                                            <View className="mt-2">
                                                <Text className="text-brand-muted text-xs">The bank’s charge comes back as its own entry and your entries go back to how they were. Anything you edited since stays as you edited it.</Text>
                                                <View className="flex-row gap-2 mt-2">
                                                    <TouchableOpacity onPress={() => doUndo(l.id)} disabled={busy} className="rounded-lg bg-brand-accent px-3 py-2" accessibilityRole="button">
                                                        {undo.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-sm font-semibold">Yes, undo</Text>}
                                                    </TouchableOpacity>
                                                    <TouchableOpacity onPress={() => setConfirmingUndo(null)} disabled={busy} className="rounded-lg px-3 py-2" accessibilityRole="button">
                                                        <Text className="text-brand-muted text-sm font-semibold">Cancel</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                ))}
                            </View>
                        )}
                    </ScrollView>
                    <View className="px-6 pb-4 pt-2">
                        <TouchableOpacity onPress={close} disabled={busy} className="rounded-xl py-4 items-center border border-brand-border" accessibilityRole="button">
                            <Text className="text-brand-text text-base font-semibold">{review.unseen > 0 ? 'Got it' : 'Close'}</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>
        </>
    )
}
