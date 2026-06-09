import { useState } from 'react'
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, ChevronRight } from 'lucide-react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { CategoryPicker } from './CategoryPicker'
import { OptionPicker } from '@/components/OptionPicker'
import { haptics } from '@/lib/haptics'
import type { Account, Category } from '@/lib/types'

interface Props {
    visible: boolean
    onClose: () => void
}

export function TransactionAddSheet({ visible, onClose }: Props) {
    const queryClient = useQueryClient()
    const [type, setType] = useState<'expense' | 'income'>('expense')
    const [amount, setAmount] = useState('')
    const [description, setDescription] = useState('')
    const [account, setAccount] = useState<Account | null>(null)
    const [category, setCategory] = useState<Category | null>(null)
    const [notes, setNotes] = useState('')
    const [showAccountPicker, setShowAccountPicker] = useState(false)
    const [showCategoryPicker, setShowCategoryPicker] = useState(false)

    const { data: accounts } = useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: async () => (await apiClient.get('/accounts')).data.data,
        enabled: visible,
    })

    const { data: categories } = useQuery<Category[]>({
        queryKey: ['categories'],
        queryFn: async () => (await apiClient.get('/categories')).data.data,
        enabled: visible,
        staleTime: 10 * 60 * 1000,
    })

    const manualAccounts = accounts?.filter((a) => !a.plaidLinked) ?? []

    const reset = () => {
        setType('expense')
        setAmount('')
        setDescription('')
        setAccount(null)
        setCategory(null)
        setNotes('')
    }

    const close = () => {
        reset()
        onClose()
    }

    const { mutate: save, isPending } = useMutation({
        mutationFn: async () => {
            const parsed = parseFloat(amount)
            if (isNaN(parsed) || parsed <= 0) throw new Error('AMOUNT')
            if (!description.trim()) throw new Error('DESCRIPTION')
            if (!account) throw new Error('ACCOUNT')

            await apiClient.post('/transactions', {
                accountId: account.id,
                amount: type === 'expense' ? -parsed : parsed,
                date: new Date().toISOString(),
                description: description.trim(),
                categoryId: category?.id ?? null,
                notes: notes.trim() || undefined,
            })
        },
        onSuccess: () => {
            haptics.success()
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            close()
        },
        onError: (e: any) => {
            haptics.error()
            if (e.message === 'AMOUNT') Alert.alert('Invalid amount', 'Enter an amount greater than zero.')
            else if (e.message === 'DESCRIPTION') Alert.alert('Missing description', 'Describe this transaction.')
            else if (e.message === 'ACCOUNT') Alert.alert('Missing account', 'Choose an account.')
            else Alert.alert('Error', 'Failed to add transaction. Please try again.')
        },
    })

    if (!visible) return null

    return (
        <Modal visible animationType="slide" presentationStyle="formSheet" onRequestClose={close}>
            <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                <KeyboardAvoidingView
                    className="flex-1"
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    {/* Header */}
                    <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                        <TouchableOpacity onPress={close} hitSlop={8} className="w-8">
                            <X size={20} color="#6B7280" />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-brand-text text-base font-semibold">
                            New Transaction
                        </Text>
                        <TouchableOpacity
                            onPress={() => save()}
                            disabled={isPending}
                            className="items-end"
                            hitSlop={8}
                        >
                            {isPending
                                ? <ActivityIndicator size="small" color="#5B7BF8" />
                                : <Text className="text-brand-accent font-semibold text-sm">Add</Text>
                            }
                        </TouchableOpacity>
                    </View>

                    {manualAccounts.length === 0 ? (
                        <View className="flex-1 items-center justify-center px-10">
                            <Text className="text-brand-text font-semibold text-base mb-2 text-center">
                                No manual accounts
                            </Text>
                            <Text className="text-brand-muted text-sm text-center leading-relaxed">
                                Manual transactions can only be added to manually-tracked accounts.
                                Bank-linked accounts update automatically. Add a manual account from the Accounts screen first.
                            </Text>
                        </View>
                    ) : (
                        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
                            <View className="px-4 pt-6 gap-y-5 pb-10">
                                {/* Type toggle */}
                                <View className="flex-row bg-brand-surface border border-brand-border rounded-xl p-1">
                                    {(['expense', 'income'] as const).map((t) => (
                                        <TouchableOpacity
                                            key={t}
                                            onPress={() => { haptics.light(); setType(t) }}
                                            className={`flex-1 py-2.5 rounded-lg items-center ${type === t ? 'bg-brand-accent' : ''}`}
                                            activeOpacity={0.8}
                                        >
                                            <Text className={`text-sm font-semibold ${type === t ? 'text-white' : 'text-brand-muted'}`}>
                                                {t === 'expense' ? 'Expense' : 'Income'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                {/* Amount */}
                                <View>
                                    <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">
                                        Amount
                                    </Text>
                                    <View className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 h-14">
                                        <Text className="text-brand-muted text-xl mr-1">$</Text>
                                        <TextInput
                                            className="flex-1 text-brand-text text-xl font-semibold"
                                            placeholder="0.00"
                                            placeholderTextColor="#6B7280"
                                            value={amount}
                                            onChangeText={setAmount}
                                            keyboardType="decimal-pad"
                                            autoFocus
                                        />
                                    </View>
                                </View>

                                {/* Description */}
                                <View>
                                    <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">
                                        Description
                                    </Text>
                                    <TextInput
                                        className="bg-brand-surface border border-brand-border rounded-xl px-4 h-14 text-brand-text text-base"
                                        placeholder="e.g. Coffee with Sam"
                                        placeholderTextColor="#6B7280"
                                        value={description}
                                        onChangeText={setDescription}
                                    />
                                </View>

                                {/* Account */}
                                <View>
                                    <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">
                                        Account
                                    </Text>
                                    <TouchableOpacity
                                        className="flex-row items-center justify-between bg-brand-surface border border-brand-border rounded-xl px-4 h-14"
                                        onPress={() => { haptics.light(); setShowAccountPicker(true) }}
                                        activeOpacity={0.7}
                                    >
                                        <Text className={account ? 'text-brand-text text-base' : 'text-brand-muted text-base'}>
                                            {account?.name ?? 'Choose account'}
                                        </Text>
                                        <ChevronRight size={16} color="#6B7280" />
                                    </TouchableOpacity>
                                </View>

                                {/* Category */}
                                <View>
                                    <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">
                                        Category (optional)
                                    </Text>
                                    <TouchableOpacity
                                        className="flex-row items-center justify-between bg-brand-surface border border-brand-border rounded-xl px-4 h-14"
                                        onPress={() => { haptics.light(); setShowCategoryPicker(true) }}
                                        activeOpacity={0.7}
                                    >
                                        <Text className={category ? 'text-brand-text text-base' : 'text-brand-muted text-base'}>
                                            {category?.name ?? 'Uncategorized'}
                                        </Text>
                                        <ChevronRight size={16} color="#6B7280" />
                                    </TouchableOpacity>
                                </View>

                                {/* Notes */}
                                <View>
                                    <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">
                                        Notes (optional)
                                    </Text>
                                    <TextInput
                                        className="bg-brand-surface border border-brand-border rounded-xl px-4 py-3.5 text-brand-text text-base min-h-[60px]"
                                        placeholder="Add a note…"
                                        placeholderTextColor="#6B7280"
                                        value={notes}
                                        onChangeText={setNotes}
                                        multiline
                                        textAlignVertical="top"
                                    />
                                </View>
                            </View>
                        </ScrollView>
                    )}

                    <OptionPicker
                        visible={showAccountPicker}
                        title="Choose Account"
                        options={manualAccounts.map((a) => ({ label: a.name, value: a.id }))}
                        selectedValue={account?.id ?? null}
                        onSelect={(value) => {
                            const acc = manualAccounts.find((a) => a.id === value)
                            setAccount(acc ?? null)
                            setShowAccountPicker(false)
                        }}
                        onClose={() => setShowAccountPicker(false)}
                    />

                    <CategoryPicker
                        visible={showCategoryPicker}
                        categories={categories ?? []}
                        selectedId={category?.id ?? null}
                        onSelect={(id) => {
                            setCategory(id ? categories?.find((c) => c.id === id) ?? null : null)
                            setShowCategoryPicker(false)
                        }}
                        onClose={() => setShowCategoryPicker(false)}
                    />
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    )
}
