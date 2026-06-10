import { useState } from 'react'
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Check, CreditCard } from 'lucide-react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Account } from '@/lib/types'

interface Props {
    visible: boolean
    onClose: () => void
}

function parseDeadline(raw: string): string | null {
    if (!raw.trim()) return null
    // Accept MM/DD/YYYY or YYYY-MM-DD
    const parts = raw.includes('/') ? raw.split('/') : raw.split('-')
    if (parts.length !== 3) return null
    let year: string, month: string, day: string
    if (raw.includes('-')) {
        [year, month, day] = parts
    } else {
        [month, day, year] = parts
    }
    const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
}

export function GoalCreateSheet({ visible, onClose }: Props) {
    const queryClient = useQueryClient()

    const [name, setName] = useState('')
    const [targetAmount, setTargetAmount] = useState('')
    const [deadline, setDeadline] = useState('')
    const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])
    const [initialAmount, setInitialAmount] = useState('')

    const { data: accounts = [] } = useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: async () => (await apiClient.get('/accounts')).data.data,
        staleTime: 5 * 60 * 1000,
        enabled: visible,
    })

    const reset = () => {
        setName('')
        setTargetAmount('')
        setDeadline('')
        setSelectedAccountIds([])
        setInitialAmount('')
    }

    const handleClose = () => {
        reset()
        onClose()
    }

    const toggleAccount = (id: string) => {
        setSelectedAccountIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const { mutate: save, isPending } = useMutation({
        mutationFn: async () => {
            if (!name.trim()) throw new Error('Please enter a goal name.')
            const target = parseFloat(targetAmount)
            if (isNaN(target) || target <= 0) throw new Error('Please enter a valid target amount.')

            const deadlineIso = parseDeadline(deadline)
            if (deadline.trim() && !deadlineIso) throw new Error('Invalid date. Use MM/DD/YYYY.')

            const payload: Record<string, unknown> = {
                name: name.trim(),
                targetAmount: target,
                accountIds: selectedAccountIds,
            }
            if (deadlineIso) payload.deadline = deadlineIso
            if (selectedAccountIds.length === 0 && initialAmount.trim()) {
                const initial = parseFloat(initialAmount)
                if (!isNaN(initial)) payload.currentAmount = initial
            }

            await apiClient.post('/goals', payload)
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['goals'] })
            handleClose()
        },
        onError: (e: any) => Alert.alert('Error', e.message ?? 'Failed to create goal.'),
    })

    const noAccountsLinked = selectedAccountIds.length === 0

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
            <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

                    {/* Header */}
                    <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                        <TouchableOpacity onPress={handleClose} hitSlop={8} className="w-8">
                            <X size={20} color="#6B7280" />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-brand-text text-base font-semibold">New Goal</Text>
                        <TouchableOpacity onPress={() => save()} disabled={isPending} className="items-end" hitSlop={8}>
                            {isPending
                                ? <ActivityIndicator size="small" color="#5B7BF8" />
                                : <Text className="text-brand-accent font-semibold text-sm">Create</Text>
                            }
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        <View className="px-4 pt-5 pb-8 gap-y-5">

                            {/* Goal Name */}
                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">Goal Name</Text>
                                <View className="bg-brand-surface border border-brand-border rounded-xl px-4 h-12 justify-center">
                                    <TextInput
                                        className="text-brand-text text-base"
                                        value={name}
                                        onChangeText={setName}
                                        placeholder="e.g. Emergency Fund"
                                        placeholderTextColor="#6B7280"
                                        autoCorrect={false}
                                        autoFocus
                                    />
                                </View>
                            </View>

                            {/* Target Amount */}
                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">Target Amount</Text>
                                <View className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 h-12">
                                    <Text className="text-brand-muted text-base mr-1">$</Text>
                                    <TextInput
                                        className="flex-1 text-brand-text text-base"
                                        value={targetAmount}
                                        onChangeText={setTargetAmount}
                                        placeholder="5,000"
                                        placeholderTextColor="#6B7280"
                                        keyboardType="decimal-pad"
                                        selectTextOnFocus
                                    />
                                </View>
                            </View>

                            {/* Deadline */}
                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">
                                    Deadline <Text className="normal-case font-normal">(optional)</Text>
                                </Text>
                                <View className="bg-brand-surface border border-brand-border rounded-xl px-4 h-12 justify-center">
                                    <TextInput
                                        className="text-brand-text text-base"
                                        value={deadline}
                                        onChangeText={setDeadline}
                                        placeholder="MM/DD/YYYY"
                                        placeholderTextColor="#6B7280"
                                        keyboardType="numbers-and-punctuation"
                                    />
                                </View>
                            </View>

                            {/* Link Accounts */}
                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-1">
                                    Link Accounts
                                </Text>
                                <Text className="text-brand-muted text-xs mb-3 leading-relaxed">
                                    Linked account balances will automatically count toward this goal.
                                </Text>
                                {accounts.length === 0 ? (
                                    <View className="bg-brand-surface border border-brand-border rounded-xl px-4 py-4">
                                        <Text className="text-brand-muted text-sm text-center">No accounts found.</Text>
                                    </View>
                                ) : (
                                    <View className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
                                        {accounts.map((acc, i) => {
                                            const checked = selectedAccountIds.includes(acc.id)
                                            return (
                                                <TouchableOpacity
                                                    key={acc.id}
                                                    className={`flex-row items-center px-4 py-3.5 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                                                    onPress={() => toggleAccount(acc.id)}
                                                    activeOpacity={0.7}
                                                >
                                                    <View className={`w-5 h-5 rounded-md border items-center justify-center mr-3 ${checked ? 'bg-brand-accent border-brand-accent' : 'border-brand-muted'}`}>
                                                        {checked && <Check size={12} color="#fff" strokeWidth={2.5} />}
                                                    </View>
                                                    <View className="flex-1">
                                                        <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>{acc.name}</Text>
                                                        <Text className="text-brand-muted text-xs mt-0.5">{acc.institutionName}</Text>
                                                    </View>
                                                    <Text className="text-brand-muted text-sm font-mono ml-2">
                                                        ${acc.balance.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                                    </Text>
                                                </TouchableOpacity>
                                            )
                                        })}
                                    </View>
                                )}
                            </View>

                            {/* Current Amount (manual, only when no accounts linked) */}
                            {noAccountsLinked && (
                                <View>
                                    <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">
                                        Current Amount <Text className="normal-case font-normal">(optional)</Text>
                                    </Text>
                                    <View className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 h-12">
                                        <Text className="text-brand-muted text-base mr-1">$</Text>
                                        <TextInput
                                            className="flex-1 text-brand-text text-base"
                                            value={initialAmount}
                                            onChangeText={setInitialAmount}
                                            placeholder="0"
                                            placeholderTextColor="#6B7280"
                                            keyboardType="decimal-pad"
                                            selectTextOnFocus
                                        />
                                    </View>
                                    <Text className="text-brand-muted text-xs mt-1.5 px-1">
                                        How much have you already saved toward this goal?
                                    </Text>
                                </View>
                            )}

                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    )
}
