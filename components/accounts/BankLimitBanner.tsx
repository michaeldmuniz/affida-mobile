import { useState } from 'react'
import { Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { AlertTriangle, X, Check } from 'lucide-react-native'
import { useBankLimit } from '@/hooks/useBankLimit'
import { colors } from '@/lib/colors'

const fmt = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })

/**
 * Shown to someone on Lite with more banks connected than Lite includes (they moved down from Pro): choose which to
 * keep before the deadline. Nothing for everyone else. Mirrors the website's banner (components/billing/BankLimitBanner).
 * Upgrading to Pro happens on the website: there is no billing in the app.
 */
export function BankLimitBanner() {
    const { limit, keep } = useBankLimit()
    const [open, setOpen] = useState(false)
    const [picked, setPicked] = useState<Set<string>>(new Set())
    if (!limit) return null

    const toggle = (id: string) => setPicked((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else if (next.size < limit.limit) next.add(id)
        return next
    })
    const confirm = () => keep.mutate([...picked], {
        onSuccess: (r) => {
            setOpen(false)
            Alert.alert(`Kept ${r.kept} bank${r.kept === 1 ? '' : 's'}`, `${r.disconnected} disconnected. Their accounts and history are still here; upgrade to Pro on the website to reconnect them.`)
        },
        onError: () => Alert.alert('Could not update your banks', 'Please try again in a moment.'),
    })

    return (
        <>
            <TouchableOpacity
                onPress={() => { setPicked(new Set(limit.keepByDefault)); setOpen(true) }}
                className="flex-row items-center gap-x-3 rounded-xl border border-amber-400/50 bg-amber-400/10 p-4"
                accessibilityRole="button"
                accessibilityLabel="Choose which banks to keep"
            >
                <AlertTriangle size={18} color="#d89b00" />
                <View className="flex-1">
                    <Text className="text-brand-text text-sm font-semibold">Choose which banks to keep</Text>
                    <Text className="text-brand-muted text-xs mt-0.5">
                        Lite includes {limit.limit} banks and you have {limit.banks.length} connected.
                        {limit.graceEndsAt ? ` Choose by ${fmt(limit.graceEndsAt)}; the rest are disconnected.` : ' The rest will be disconnected.'}
                    </Text>
                </View>
            </TouchableOpacity>

            <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
                <SafeAreaView className="flex-1 bg-brand-bg">
                    <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
                        <Text className="text-brand-text text-xl font-bold">Keep up to {limit.limit} banks</Text>
                        <TouchableOpacity onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close">
                            <X size={22} color={colors.muted} />
                        </TouchableOpacity>
                    </View>
                    <Text className="text-brand-muted text-sm px-6 pb-3">
                        The others are disconnected from Plaid, but their accounts and history stay in Affida. Reconnect them any time on Pro.
                    </Text>
                    <ScrollView className="flex-1 px-6">
                        {limit.banks.map((b) => {
                            const checked = picked.has(b.id)
                            const disabled = !checked && picked.size >= limit.limit
                            return (
                                <TouchableOpacity
                                    key={b.id}
                                    onPress={() => toggle(b.id)}
                                    disabled={disabled}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{ checked, disabled }}
                                    className={`flex-row items-center gap-x-3 rounded-xl border p-4 mb-2 ${checked ? 'border-brand-accent bg-brand-accent/10' : 'border-brand-border bg-brand-surface'} ${disabled ? 'opacity-50' : ''}`}
                                >
                                    <View className={`w-5 h-5 rounded-md border items-center justify-center ${checked ? 'bg-brand-accent border-brand-accent' : 'border-brand-border'}`}>
                                        {checked && <Check size={14} color="#fff" strokeWidth={3} />}
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-brand-text text-base font-medium">{b.institutionName ?? 'Bank'}</Text>
                                        <Text className="text-brand-muted text-xs">{b.accounts} account{b.accounts === 1 ? '' : 's'} · connected {fmt(b.linkedAt)}</Text>
                                    </View>
                                </TouchableOpacity>
                            )
                        })}
                    </ScrollView>
                    <View className="px-6 pb-4 pt-2">
                        <TouchableOpacity
                            onPress={confirm}
                            disabled={keep.isPending || picked.size === 0}
                            className={`rounded-xl py-4 items-center ${keep.isPending || picked.size === 0 ? 'bg-brand-accent/40' : 'bg-brand-accent'}`}
                            accessibilityRole="button"
                        >
                            {keep.isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-base font-semibold">Keep {picked.size} bank{picked.size === 1 ? '' : 's'}</Text>}
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>
        </>
    )
}
