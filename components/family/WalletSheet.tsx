import { useState } from 'react'
import {
    Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Pencil, Plus, Minus } from 'lucide-react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Child, ChildDetail, WalletEntry, WalletKind } from '@/lib/types'
import { colors } from '@/lib/colors'
import { haptics } from '@/lib/haptics'
import { AmountText } from '@/components/ui/AmountText'
import { KidAvatar } from './KidAvatar'

const ADD_KINDS: { value: WalletKind; label: string }[] = [
    { value: 'ALLOWANCE', label: 'Allowance' },
    { value: 'GIFT', label: 'Gift' },
    { value: 'EARNED', label: 'Earned' },
]
const REMOVE_KINDS: { value: WalletKind; label: string }[] = [
    { value: 'SPENT', label: 'Spent' },
    { value: 'CASHED_OUT', label: 'Cashed out' },
]
const KIND_LABELS: Record<WalletKind, string> = {
    ALLOWANCE: 'Allowance', GIFT: 'Gift', EARNED: 'Earned', SPENT: 'Spent', CASHED_OUT: 'Cashed out', ADJUSTMENT: 'Adjustment',
}

interface Props {
    childId: string | null
    onClose: () => void
    onEdit: (child: Child) => void
}

export function WalletSheet({ childId, onClose, onEdit }: Props) {
    const queryClient = useQueryClient()
    const [mode, setMode] = useState<'add' | 'remove' | null>(null)
    const [kind, setKind] = useState<WalletKind>('ALLOWANCE')
    const [amount, setAmount] = useState('')
    const [note, setNote] = useState('')

    const { data, isLoading } = useQuery<ChildDetail>({
        queryKey: ['family', childId],
        queryFn: async () => (await apiClient.get(`/family/children/${childId}`)).data.data,
        enabled: !!childId,
    })

    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['family'] })
    }

    const { mutate: addEntry, isPending } = useMutation({
        mutationFn: async () => {
            const value = parseFloat(amount)
            if (!Number.isFinite(value) || value <= 0) throw new Error('invalid')
            await apiClient.post(`/family/children/${childId}/entries`, { amount: value, kind, note: note.trim() || null })
        },
        onSuccess: () => {
            haptics.success()
            setMode(null)
            refresh()
        },
        onError: (e: any) => {
            haptics.error()
            Alert.alert('Error', e?.message === 'invalid' ? 'Enter an amount greater than 0.' : e?.response?.data?.error ?? 'Failed to save.')
        },
    })

    const startEntry = (m: 'add' | 'remove') => {
        haptics.light()
        setMode(m)
        setKind(m === 'add' ? 'ALLOWANCE' : 'SPENT')
        setAmount('')
        setNote('')
    }

    const confirmDelete = (entry: WalletEntry) => {
        haptics.warning()
        Alert.alert('Delete entry?', `${entry.note || KIND_LABELS[entry.kind]} · ${entry.amount >= 0 ? '+' : '−'}$${Math.abs(entry.amount).toFixed(2)}`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await apiClient.delete(`/family/entries/${entry.id}`)
                        refresh()
                    } catch (e: any) {
                        Alert.alert('Error', e?.response?.data?.error ?? 'Failed to delete.')
                    }
                },
            },
        ])
    }

    const handleClose = () => {
        setMode(null)
        onClose()
    }

    if (!childId) return null
    const child = data?.child
    const kinds = mode === 'remove' ? REMOVE_KINDS : ADD_KINDS

    return (
        <Modal visible animationType="slide" presentationStyle="formSheet" onRequestClose={handleClose}>
            <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                        <TouchableOpacity onPress={handleClose} hitSlop={8} className="w-8">
                            <X size={20} color={colors.muted} />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-brand-text text-base font-semibold" numberOfLines={1}>
                            {child?.name ?? ''}
                        </Text>
                        <TouchableOpacity onPress={() => child && onEdit(child)} disabled={!child} hitSlop={8} className="w-8 items-end">
                            <Pencil size={17} color={colors.muted} />
                        </TouchableOpacity>
                    </View>

                    {isLoading || !child ? (
                        <View className="flex-1 items-center justify-center">
                            <ActivityIndicator color={colors.accent} />
                        </View>
                    ) : (
                        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
                            <View className="px-4 pt-6 pb-10 gap-y-5">
                            <View className="items-center gap-y-2">
                                <KidAvatar name={child.name} color={child.color} size={56} />
                                <AmountText amount={child.balance} size="xl" neutral />
                                <Text className="text-brand-muted text-xs uppercase tracking-widest">In wallet</Text>
                            </View>

                            {mode ? (
                                <View className="bg-brand-surface border border-brand-border rounded-2xl p-4 gap-y-3">
                                    <Text className="text-brand-text font-semibold">{mode === 'add' ? 'Add money' : 'Take out money'}</Text>
                                    <View className="flex-row flex-wrap gap-2">
                                        {kinds.map((k) => (
                                            <TouchableOpacity
                                                key={k.value}
                                                onPress={() => { haptics.light(); setKind(k.value) }}
                                                className={`px-3 py-1.5 rounded-full border ${kind === k.value ? 'bg-brand-accent border-brand-accent' : 'border-brand-border'}`}
                                            >
                                                <Text className={`text-sm font-medium ${kind === k.value ? 'text-white' : 'text-brand-muted'}`}>{k.label}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    <TextInput
                                        className="bg-brand-elevated border border-brand-border rounded-xl px-4 h-12 text-brand-text text-lg"
                                        value={amount}
                                        onChangeText={setAmount}
                                        placeholder="$0.00"
                                        placeholderTextColor={colors.muted}
                                        keyboardType="decimal-pad"
                                        autoFocus
                                    />
                                    <TextInput
                                        className="bg-brand-elevated border border-brand-border rounded-xl px-4 h-11 text-brand-text text-sm"
                                        value={note}
                                        onChangeText={setNote}
                                        placeholder="Note (optional)"
                                        placeholderTextColor={colors.muted}
                                        maxLength={200}
                                    />
                                    <View className="flex-row gap-x-3">
                                        <TouchableOpacity onPress={() => setMode(null)} className="flex-1 h-11 rounded-xl border border-brand-border items-center justify-center">
                                            <Text className="text-brand-muted font-medium">Cancel</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => addEntry()} disabled={isPending} className="flex-1 h-11 rounded-xl bg-brand-accent items-center justify-center">
                                            {isPending ? <ActivityIndicator color="#fff" /> : <Text className="text-white font-semibold">Save</Text>}
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                <View className="flex-row gap-x-3">
                                    <TouchableOpacity onPress={() => startEntry('add')} className="flex-1 h-12 rounded-xl bg-brand-accent flex-row items-center justify-center gap-x-2">
                                        <Plus size={16} color="#fff" strokeWidth={2.2} />
                                        <Text className="text-white font-semibold">Add money</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => startEntry('remove')}
                                        disabled={child.balance <= 0}
                                        className={`flex-1 h-12 rounded-xl border border-brand-border flex-row items-center justify-center gap-x-2 ${child.balance <= 0 ? 'opacity-40' : ''}`}
                                    >
                                        <Minus size={16} color={colors.text} strokeWidth={2.2} />
                                        <Text className="text-brand-text font-semibold">Take out</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2 px-1">History</Text>
                                {data.entries.length === 0 ? (
                                    <Text className="text-brand-muted text-sm text-center py-8">No activity yet.</Text>
                                ) : (
                                    <View className="bg-brand-surface border border-brand-border rounded-2xl overflow-hidden">
                                        {data.entries.map((e, i) => (
                                            <TouchableOpacity
                                                key={e.id}
                                                onLongPress={() => confirmDelete(e)}
                                                delayLongPress={350}
                                                activeOpacity={0.7}
                                                className={`flex-row items-center px-4 py-3 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                                            >
                                                <View className="flex-1">
                                                    <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>{e.note || KIND_LABELS[e.kind]}</Text>
                                                    <Text className="text-brand-muted text-xs mt-0.5">
                                                        {KIND_LABELS[e.kind]} · {new Date(e.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                        {e.createdByName ? ` · ${e.createdByName.split(' ')[0]}` : ''}
                                                    </Text>
                                                </View>
                                                <AmountText amount={e.amount} size="sm" showSign />
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                                {data.entries.length > 0 && (
                                    <Text className="text-brand-muted text-xs text-center mt-2">Press and hold an entry to delete it.</Text>
                                )}
                            </View>
                            </View>
                        </ScrollView>
                    )}
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    )
}
