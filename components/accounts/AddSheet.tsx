import { useState } from 'react'
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Switch,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, ChevronRight, Layers, Building2, PenLine } from 'lucide-react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { OptionPicker } from '@/components/OptionPicker'
import { DEBT_TYPES } from '@/lib/account-types'
import { PlaidLinkButton } from './PlaidLinkButton'

const ACCOUNT_TYPE_OPTIONS = [
    { label: 'Checking', value: 'CHECKING' },
    { label: 'Savings', value: 'SAVINGS' },
    { label: 'Credit Card', value: 'CREDIT_CARD' },
    { label: 'Line of Credit', value: 'LINE_OF_CREDIT' },
    { label: 'Investment', value: 'INVESTMENT' },
    { label: 'Mortgage', value: 'MORTGAGE' },
    { label: 'Auto Loan', value: 'AUTO_LOAN' },
    { label: 'Student Loan', value: 'STUDENT_LOAN' },
    { label: 'Personal Loan', value: 'PERSONAL_LOAN' },
    { label: 'Loan', value: 'LOAN' },
    { label: 'Other', value: 'OTHER' },
]

const ACCOUNT_TYPE_LABELS: Record<string, string> = Object.fromEntries(
    ACCOUNT_TYPE_OPTIONS.map(o => [o.value, o.label])
)

interface Props {
    visible: boolean
    onClose: () => void
}

export function AddAccountSheet({ visible, onClose }: Props) {
    const queryClient = useQueryClient()
    const [mode, setMode] = useState<'choose' | 'manual'>('choose')
    const [name, setName] = useState('')
    const [type, setType] = useState<string | null>(null)
    const [balance, setBalance] = useState('')
    const [excludeFromNetWorth, setExcludeFromNetWorth] = useState(false)
    const [showTypePicker, setShowTypePicker] = useState(false)

    const isDebt = type ? DEBT_TYPES.has(type) : false

    const reset = () => {
        setMode('choose')
        setName('')
        setType(null)
        setBalance('')
        setExcludeFromNetWorth(false)
    }

    const { mutate: save, isPending } = useMutation({
        mutationFn: async () => {
            if (!name.trim()) throw new Error('Please enter an account name.')
            if (!type) throw new Error('Please select an account type.')
            const rawBalance = parseFloat(balance)
            if (isNaN(rawBalance)) throw new Error('Please enter a valid balance.')
            const finalBalance = isDebt ? -Math.abs(rawBalance) : rawBalance
            await apiClient.post('/accounts', {
                name: name.trim(),
                type,
                balance: finalBalance,
                excludeFromNetWorth,
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            reset()
            onClose()
        },
        onError: (e: any) => Alert.alert('Error', e.message ?? 'Failed to create account.'),
    })

    const handleClose = () => {
        reset()
        onClose()
    }

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
            <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

                    {/* Header */}
                    <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                        <TouchableOpacity onPress={mode === 'manual' ? () => setMode('choose') : handleClose} hitSlop={8} className="w-8">
                            <X size={20} color="#6B7280" />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-brand-text text-base font-semibold">
                            {mode === 'manual' ? 'Add Manually' : 'Add Account'}
                        </Text>
                        {mode === 'manual' ? (
                            <TouchableOpacity onPress={() => save()} disabled={isPending} className="items-end" hitSlop={8}>
                                {isPending
                                    ? <ActivityIndicator size="small" color="#5B7BF8" />
                                    : <Text className="text-brand-accent font-semibold text-sm">Save</Text>
                                }
                            </TouchableOpacity>
                        ) : (
                            <View className="w-8" />
                        )}
                    </View>

                    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        {mode === 'choose' ? (
                            <View className="px-4 pt-6 pb-8 gap-y-4">
                                <Text className="text-brand-muted text-sm text-center leading-relaxed mb-2">
                                    Connect your bank automatically or add an account manually.
                                </Text>

                                {/* Connect Bank (Plaid) */}
                                <PlaidLinkButton onSuccess={() => { reset(); onClose() }} />

                                {/* Divider */}
                                <View className="flex-row items-center gap-x-3">
                                    <View className="flex-1 h-px bg-brand-border" />
                                    <Text className="text-brand-muted text-xs">or</Text>
                                    <View className="flex-1 h-px bg-brand-border" />
                                </View>

                                {/* Manual */}
                                <TouchableOpacity
                                    className="h-14 rounded-2xl bg-brand-surface border border-brand-border items-center justify-center flex-row gap-x-2"
                                    onPress={() => setMode('manual')}
                                    activeOpacity={0.7}
                                >
                                    <PenLine size={16} color="#6B7280" />
                                    <Text className="text-brand-muted font-medium text-base">Add manually</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                        <View className="px-4 pt-5 pb-8 gap-y-5">

                            {/* Account name */}
                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">Account Name</Text>
                                <View className="bg-brand-surface border border-brand-border rounded-xl px-4 h-12 justify-center">
                                    <TextInput
                                        className="text-brand-text text-base"
                                        value={name}
                                        onChangeText={setName}
                                        placeholder="e.g. Chase Checking"
                                        placeholderTextColor="#6B7280"
                                        autoCorrect={false}
                                    />
                                </View>
                            </View>

                            {/* Account type */}
                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">Account Type</Text>
                                <TouchableOpacity
                                    className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 h-12"
                                    onPress={() => setShowTypePicker(true)}
                                    activeOpacity={0.7}
                                >
                                    <Layers size={15} color="#6B7280" style={{ marginRight: 8 }} />
                                    <Text className={`flex-1 text-base ${type ? 'text-brand-text' : 'text-brand-muted'}`}>
                                        {type ? ACCOUNT_TYPE_LABELS[type] : 'Select type...'}
                                    </Text>
                                    <ChevronRight size={16} color="#6B7280" />
                                </TouchableOpacity>
                            </View>

                            {/* Balance */}
                            <View>
                                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">
                                    {isDebt ? 'Amount Owed' : 'Current Balance'}
                                </Text>
                                <View className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 h-12">
                                    <Text className="text-brand-muted text-base mr-1">$</Text>
                                    <TextInput
                                        className="flex-1 text-brand-text text-base"
                                        value={balance}
                                        onChangeText={setBalance}
                                        placeholder="0.00"
                                        placeholderTextColor="#6B7280"
                                        keyboardType="decimal-pad"
                                        selectTextOnFocus
                                    />
                                </View>
                                {isDebt && (
                                    <Text className="text-brand-muted text-xs mt-1.5 px-1">
                                        Enter the amount you owe — it will be recorded as a liability.
                                    </Text>
                                )}
                            </View>

                            {/* Exclude from net worth */}
                            <View className="flex-row items-center justify-between bg-brand-surface border border-brand-border rounded-xl px-4 h-14">
                                <View className="flex-1 pr-3">
                                    <Text className="text-brand-text text-sm font-medium">Exclude from net worth</Text>
                                    <Text className="text-brand-muted text-xs mt-0.5">Balance won't count toward your total</Text>
                                </View>
                                <Switch
                                    value={excludeFromNetWorth}
                                    onValueChange={setExcludeFromNetWorth}
                                    trackColor={{ false: '#2A2A38', true: '#5B7BF8' }}
                                    thumbColor="#fff"
                                />
                            </View>

                        </View>
                        )}
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>

            <OptionPicker
                visible={showTypePicker}
                title="Account Type"
                options={ACCOUNT_TYPE_OPTIONS}
                selectedValue={type}
                onSelect={v => setType(v)}
                onClose={() => setShowTypePicker(false)}
                noneLabel="Select type..."
            />
        </Modal>
    )
}
