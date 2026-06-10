import { useState, useEffect } from 'react'
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Switch, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X } from 'lucide-react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { haptics } from '@/lib/haptics'
import type { Account } from '@/lib/types'

interface Props {
    visible: boolean
    account: Account
    onClose: () => void
    /** Called after a successful delete so the caller can navigate away */
    onDeleted: () => void
}

export function AccountEditSheet({ visible, account, onClose, onDeleted }: Props) {
    const queryClient = useQueryClient()
    const [name, setName] = useState(account.name)
    const [balance, setBalance] = useState(String(account.balance))
    const [excludeFromNetWorth, setExcludeFromNetWorth] = useState(account.excludeFromNetWorth)

    useEffect(() => {
        if (visible) {
            setName(account.name)
            setBalance(String(account.balance))
            setExcludeFromNetWorth(account.excludeFromNetWorth)
        }
    }, [visible, account])

    const isManual = !account.plaidLinked

    const { mutate: save, isPending } = useMutation({
        mutationFn: async () => {
            if (!name.trim()) throw new Error('NAME')
            const payload: Record<string, unknown> = {
                name: name.trim(),
                excludeFromNetWorth,
            }
            if (isManual) {
                const parsed = parseFloat(balance)
                if (isNaN(parsed)) throw new Error('BALANCE')
                if (parsed !== account.balance) payload.balance = parsed
            }
            await apiClient.patch(`/accounts/${account.id}`, payload)
        },
        onSuccess: () => {
            haptics.success()
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            onClose()
        },
        onError: (e: any) => {
            haptics.error()
            if (e.message === 'NAME') Alert.alert('Missing name', 'Give the account a name.')
            else if (e.message === 'BALANCE') Alert.alert('Invalid balance', 'Enter a valid balance.')
            else Alert.alert('Error', 'Failed to save account. Please try again.')
        },
    })

    const handleDelete = () => {
        haptics.warning()
        Alert.alert(
            'Delete Account',
            `Delete "${account.name}" and all of its transactions? This cannot be undone.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete', style: 'destructive', onPress: async () => {
                        try {
                            await apiClient.delete(`/accounts/${account.id}`)
                            onClose()
                            onDeleted()
                        } catch {
                            Alert.alert('Error', 'Failed to delete account.')
                        }
                    },
                },
            ]
        )
    }

    if (!visible) return null

    return (
        <Modal visible animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
            <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                <KeyboardAvoidingView
                    className="flex-1"
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    {/* Header */}
                    <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                        <TouchableOpacity onPress={onClose} hitSlop={8} className="w-8">
                            <X size={20} color="#6B7280" />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-brand-text text-base font-semibold">
                            Edit Account
                        </Text>
                        <TouchableOpacity
                            onPress={() => save()}
                            disabled={isPending}
                            className="items-end"
                            hitSlop={8}
                        >
                            {isPending
                                ? <ActivityIndicator size="small" color="#5B7BF8" />
                                : <Text className="text-brand-accent font-semibold text-sm">Save</Text>
                            }
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
                        <View className="px-4 pt-6 gap-y-5 pb-10">
                            {/* Name */}
                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">
                                    Account Name
                                </Text>
                                <TextInput
                                    className="bg-brand-surface border border-brand-border rounded-xl px-4 h-14 text-brand-text text-base"
                                    value={name}
                                    onChangeText={setName}
                                />
                            </View>

                            {/* Balance — manual accounts only */}
                            {isManual ? (
                                <View>
                                    <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">
                                        Current Balance
                                    </Text>
                                    <View className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 h-14">
                                        <Text className="text-brand-muted text-xl mr-1">$</Text>
                                        <TextInput
                                            className="flex-1 text-brand-text text-xl font-semibold"
                                            value={balance}
                                            onChangeText={setBalance}
                                            keyboardType="numbers-and-punctuation"
                                        />
                                    </View>
                                    <Text className="text-brand-muted text-xs mt-2 px-1">
                                        Updating the balance records a snapshot for net worth history.
                                    </Text>
                                </View>
                            ) : (
                                <Text className="text-brand-muted text-xs leading-relaxed px-1">
                                    Balance updates automatically from {account.institutionName}.
                                </Text>
                            )}

                            {/* Exclude from net worth */}
                            <View className="flex-row items-center justify-between bg-brand-surface border border-brand-border rounded-xl px-4 h-14">
                                <View className="flex-1 pr-3">
                                    <Text className="text-brand-text text-sm font-medium">Hide from net worth</Text>
                                    <Text className="text-brand-muted text-xs mt-0.5">Exclude this account from totals</Text>
                                </View>
                                <Switch
                                    value={excludeFromNetWorth}
                                    onValueChange={(v) => { haptics.light(); setExcludeFromNetWorth(v) }}
                                    trackColor={{ false: '#2A2A38', true: '#5B7BF8' }}
                                    thumbColor="#fff"
                                />
                            </View>

                            {/* Delete — manual accounts only */}
                            {isManual && (
                                <TouchableOpacity
                                    className="h-12 rounded-xl border border-brand-negative/30 items-center justify-center mt-2"
                                    onPress={handleDelete}
                                    activeOpacity={0.7}
                                >
                                    <Text className="text-brand-negative text-sm font-medium">Delete Account</Text>
                                </TouchableOpacity>
                            )}
                            {!isManual && (
                                <Text className="text-brand-muted text-xs leading-relaxed px-1">
                                    To disconnect this bank connection, use the web app so the link is fully removed.
                                </Text>
                            )}
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    )
}
