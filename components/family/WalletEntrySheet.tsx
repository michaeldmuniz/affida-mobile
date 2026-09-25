import { useState, useEffect } from 'react'
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { WalletKind } from '@/lib/types'
import { colors } from '@/lib/colors'
import { haptics } from '@/lib/haptics'

const ADD_KINDS: { value: WalletKind; label: string }[] = [
    { value: 'ALLOWANCE', label: 'Allowance' },
    { value: 'GIFT', label: 'Gift' },
    { value: 'EARNED', label: 'Earned' },
]
const REMOVE_KINDS: { value: WalletKind; label: string }[] = [
    { value: 'SPENT', label: 'Spent' },
    { value: 'CASHED_OUT', label: 'Cashed out' },
]

interface Props {
    childId: string
    childName: string
    /** 'add' or 'remove' to open, null when closed. */
    mode: 'add' | 'remove' | null
    onClose: () => void
}

export function WalletEntrySheet({ childId, childName, mode, onClose }: Props) {
    const queryClient = useQueryClient()
    const [kind, setKind] = useState<WalletKind>('ALLOWANCE')
    const [amount, setAmount] = useState('')
    const [note, setNote] = useState('')

    useEffect(() => {
        if (!mode) return
        setKind(mode === 'add' ? 'ALLOWANCE' : 'SPENT')
        setAmount('')
        setNote('')
    }, [mode])

    const { mutate: save, isPending } = useMutation({
        mutationFn: async () => {
            const value = parseFloat(amount)
            if (!Number.isFinite(value) || value <= 0) throw new Error('invalid')
            await apiClient.post(`/family/children/${childId}/entries`, { amount: value, kind, note: note.trim() || null })
        },
        onSuccess: () => {
            haptics.success()
            queryClient.invalidateQueries({ queryKey: ['family'] })
            onClose()
        },
        onError: (e: any) => {
            haptics.error()
            Alert.alert('Error', e?.message === 'invalid' ? 'Enter an amount greater than 0.' : e?.response?.data?.error ?? 'Failed to save.')
        },
    })

    if (!mode) return null
    const kinds = mode === 'remove' ? REMOVE_KINDS : ADD_KINDS

    return (
        <Modal visible animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
            <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                        <TouchableOpacity onPress={onClose} hitSlop={8} className="w-8">
                            <X size={20} color={colors.muted} />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-brand-text text-base font-semibold" numberOfLines={1}>
                            {mode === 'add' ? `Add to ${childName}'s wallet` : `Take out of ${childName}'s wallet`}
                        </Text>
                        <TouchableOpacity onPress={() => save()} disabled={isPending} hitSlop={8} className="items-end">
                            {isPending
                                ? <ActivityIndicator size="small" color={colors.accent} />
                                : <Text className="text-brand-accent font-semibold text-sm">Save</Text>
                            }
                        </TouchableOpacity>
                    </View>

                    <View className="px-4 pt-6 gap-y-5">
                        <View className="flex-row flex-wrap gap-2">
                            {kinds.map((k) => (
                                <TouchableOpacity
                                    key={k.value}
                                    onPress={() => { haptics.light(); setKind(k.value) }}
                                    className={`px-4 py-2 rounded-full border ${kind === k.value ? 'bg-brand-accent border-brand-accent' : 'border-brand-border'}`}
                                >
                                    <Text className={`text-sm font-medium ${kind === k.value ? 'text-white' : 'text-brand-muted'}`}>{k.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <View>
                            <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">Amount</Text>
                            <TextInput
                                className="bg-brand-surface border border-brand-border rounded-xl px-4 h-14 text-brand-text text-2xl"
                                value={amount}
                                onChangeText={setAmount}
                                placeholder="$0.00"
                                placeholderTextColor={colors.muted}
                                keyboardType="decimal-pad"
                                autoFocus
                            />
                        </View>
                        <View>
                            <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">Note (optional)</Text>
                            <TextInput
                                className="bg-brand-surface border border-brand-border rounded-xl px-4 h-12 text-brand-text text-base"
                                value={note}
                                onChangeText={setNote}
                                placeholder={mode === 'add' ? 'e.g. Birthday money' : 'e.g. Lego set'}
                                placeholderTextColor={colors.muted}
                                maxLength={200}
                            />
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    )
}
