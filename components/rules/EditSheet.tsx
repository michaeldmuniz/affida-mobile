import { useState, useEffect } from 'react'
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, ChevronRight, Tag, Layers, CreditCard } from 'lucide-react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { CategoryPicker } from '@/components/transactions/CategoryPicker'
import { OptionPicker } from '@/components/OptionPicker'
import type { Rule, Category, Account } from '@/lib/types'
import { colors } from '@/lib/colors'

type AmountType = 'DEBIT' | 'CREDIT' | null

interface FormState {
    containsText: string
    amountMin: string
    amountMax: string
    amountType: AmountType
    accountType: string | null
    accountId: string | null
    categoryId: string
    categoryName: string
}

interface Props {
    rule: Rule | 'new' | null
    onClose: () => void
}

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

function SegmentedControl({ value, onChange, options }: {
    value: string | null
    onChange: (v: string | null) => void
    options: { label: string; value: string }[]
}) {
    return (
        <View className="flex-row bg-brand-surface border border-brand-border rounded-xl p-1 gap-x-1">
            {[{ label: 'Any', value: '' }, ...options].map(opt => {
                const active = opt.value === '' ? value === null : value === opt.value
                return (
                    <TouchableOpacity
                        key={opt.value}
                        className={`flex-1 py-2 rounded-lg items-center ${active ? 'bg-brand-accent' : ''}`}
                        onPress={() => onChange(opt.value === '' ? null : opt.value)}
                        activeOpacity={0.7}
                    >
                        <Text className={`text-xs font-medium ${active ? 'text-white' : 'text-brand-muted'}`}>
                            {opt.label}
                        </Text>
                    </TouchableOpacity>
                )
            })}
        </View>
    )
}

export function RuleEditSheet({ rule, onClose }: Props) {
    const queryClient = useQueryClient()
    const isNew = rule === 'new'
    const editing = rule !== null && rule !== 'new' ? rule : null

    const [form, setForm] = useState<FormState>({
        containsText: '',
        amountMin: '',
        amountMax: '',
        amountType: null,
        accountType: null,
        accountId: null,
        categoryId: '',
        categoryName: '',
    })
    const [showCategoryPicker, setShowCategoryPicker] = useState(false)
    const [showAccountTypePicker, setShowAccountTypePicker] = useState(false)
    const [showAccountPicker, setShowAccountPicker] = useState(false)

    useEffect(() => {
        if (editing) {
            setForm({
                containsText: editing.containsText ?? '',
                amountMin: editing.amountMin != null ? String(editing.amountMin) : '',
                amountMax: editing.amountMax != null ? String(editing.amountMax) : '',
                amountType: editing.amountType ?? null,
                accountType: editing.accountType ?? null,
                accountId: editing.accountId ?? null,
                categoryId: editing.categoryId,
                categoryName: editing.category.name,
            })
        } else if (isNew) {
            setForm({
                containsText: '', amountMin: '', amountMax: '', amountType: null,
                accountType: null, accountId: null, categoryId: '', categoryName: '',
            })
        }
    }, [rule])

    const { data: categories = [] } = useQuery<Category[]>({
        queryKey: ['categories'],
        queryFn: async () => (await apiClient.get('/categories')).data.data,
        staleTime: 5 * 60 * 1000,
        enabled: rule !== null,
    })

    const { data: accounts = [] } = useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: async () => (await apiClient.get('/accounts')).data.data,
        staleTime: 5 * 60 * 1000,
        enabled: rule !== null,
    })

    const accountOptions = accounts.map(a => ({
        label: `${a.name} — ${a.institutionName}`,
        value: a.id,
    }))

    const selectedAccountLabel = form.accountId
        ? (accountOptions.find(o => o.value === form.accountId)?.label ?? 'Unknown account')
        : null

    const buildPayload = () => ({
        containsText: form.containsText.trim() || null,
        amountMin: form.amountMin ? parseFloat(form.amountMin) : null,
        amountMax: form.amountMax ? parseFloat(form.amountMax) : null,
        amountType: form.amountType,
        accountType: form.accountType || null,
        accountId: form.accountId || null,
        categoryId: form.categoryId,
    })

    const { mutate: save, isPending } = useMutation({
        mutationFn: async () => {
            if (!form.categoryId) throw new Error('Please select a category.')
            const payload = buildPayload()
            const hasCondition = payload.containsText || payload.amountMin != null ||
                payload.amountMax != null || payload.amountType || payload.accountType || payload.accountId
            if (!hasCondition) throw new Error('Add at least one condition.')

            if (isNew) {
                await apiClient.post('/rules', payload)
            } else {
                await apiClient.patch(`/rules/${editing!.id}`, payload)
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['rules'] })
            onClose()
        },
        onError: (e: any) => Alert.alert('Error', e.message ?? 'Failed to save rule.'),
    })

    if (rule === null) return null

    return (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
            <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

                    {/* Header */}
                    <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                        <TouchableOpacity onPress={onClose} hitSlop={8} className="w-8">
                            <X size={20} color={colors.muted} />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-brand-text text-base font-semibold">
                            {isNew ? 'New Rule' : 'Edit Rule'}
                        </Text>
                        <TouchableOpacity onPress={() => save()} disabled={isPending} className="items-end" hitSlop={8}>
                            {isPending
                                ? <ActivityIndicator size="small" color={colors.accent} />
                                : <Text className="text-brand-accent font-semibold text-sm">Save</Text>
                            }
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                        <View className="px-4 pt-2 pb-8 gap-y-5">

                            {/* Info banner */}
                            <View className="bg-brand-accent/10 border border-brand-accent/20 rounded-xl px-4 py-3 mt-3">
                                <Text className="text-brand-accent text-xs leading-relaxed">
                                    When a transaction matches <Text className="font-semibold">all</Text> conditions below, it will automatically be assigned the selected category.
                                </Text>
                            </View>

                            {/* ── Conditions ──────────────────────────────── */}
                            <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest">Conditions</Text>

                            {/* Description contains */}
                            <View>
                                <Text className="text-brand-text text-sm font-medium mb-2">Description contains</Text>
                                <View className="bg-brand-surface border border-brand-border rounded-xl px-4 h-12 justify-center">
                                    <TextInput
                                        className="text-brand-text text-sm"
                                        value={form.containsText}
                                        onChangeText={v => setForm(f => ({ ...f, containsText: v }))}
                                        placeholder="e.g. Starbucks, Amazon..."
                                        placeholderTextColor={colors.muted}
                                        autoCorrect={false}
                                    />
                                </View>
                            </View>

                            {/* Transaction type */}
                            <View>
                                <Text className="text-brand-text text-sm font-medium mb-2">Transaction type</Text>
                                <SegmentedControl
                                    value={form.amountType}
                                    onChange={v => setForm(f => ({ ...f, amountType: v as AmountType }))}
                                    options={[{ label: 'Expense', value: 'DEBIT' }, { label: 'Income', value: 'CREDIT' }]}
                                />
                            </View>

                            {/* Amount range */}
                            <View>
                                <Text className="text-brand-text text-sm font-medium mb-2">Amount range</Text>
                                <View className="flex-row gap-x-3">
                                    <View className="flex-1 flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-3 h-12">
                                        <Text className="text-brand-muted text-sm mr-1">Min $</Text>
                                        <TextInput
                                            className="flex-1 text-brand-text text-sm"
                                            value={form.amountMin}
                                            onChangeText={v => setForm(f => ({ ...f, amountMin: v }))}
                                            placeholder="0"
                                            placeholderTextColor={colors.muted}
                                            keyboardType="decimal-pad"
                                        />
                                    </View>
                                    <View className="flex-1 flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-3 h-12">
                                        <Text className="text-brand-muted text-sm mr-1">Max $</Text>
                                        <TextInput
                                            className="flex-1 text-brand-text text-sm"
                                            value={form.amountMax}
                                            onChangeText={v => setForm(f => ({ ...f, amountMax: v }))}
                                            placeholder="Any"
                                            placeholderTextColor={colors.muted}
                                            keyboardType="decimal-pad"
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Account type */}
                            <View>
                                <Text className="text-brand-text text-sm font-medium mb-2">Account type</Text>
                                <TouchableOpacity
                                    className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 h-12"
                                    onPress={() => setShowAccountTypePicker(true)}
                                    activeOpacity={0.7}
                                >
                                    <Layers size={15} color={colors.muted} style={{ marginRight: 8 }} />
                                    <Text className={`flex-1 text-sm ${form.accountType ? 'text-brand-text' : 'text-brand-muted'}`}>
                                        {form.accountType ? ACCOUNT_TYPE_LABELS[form.accountType] : 'Any account type'}
                                    </Text>
                                    <ChevronRight size={16} color={colors.muted} />
                                </TouchableOpacity>
                            </View>

                            {/* Specific account */}
                            <View>
                                <Text className="text-brand-text text-sm font-medium mb-2">Specific account</Text>
                                <TouchableOpacity
                                    className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 h-12"
                                    onPress={() => setShowAccountPicker(true)}
                                    activeOpacity={0.7}
                                >
                                    <CreditCard size={15} color={colors.muted} style={{ marginRight: 8 }} />
                                    <Text className={`flex-1 text-sm ${form.accountId ? 'text-brand-text' : 'text-brand-muted'}`} numberOfLines={1}>
                                        {selectedAccountLabel ?? 'Any account'}
                                    </Text>
                                    <ChevronRight size={16} color={colors.muted} />
                                </TouchableOpacity>
                            </View>

                            {/* ── Action ──────────────────────────────────── */}
                            <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest pt-2">Action</Text>

                            {/* Assign category */}
                            <View>
                                <Text className="text-brand-text text-sm font-medium mb-2">Assign category</Text>
                                <TouchableOpacity
                                    className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 h-12"
                                    onPress={() => setShowCategoryPicker(true)}
                                    activeOpacity={0.7}
                                >
                                    <Tag size={15} color={colors.muted} style={{ marginRight: 8 }} />
                                    <Text className={`flex-1 text-sm ${form.categoryName ? 'text-brand-text' : 'text-brand-muted'}`}>
                                        {form.categoryName || 'Select a category...'}
                                    </Text>
                                    <ChevronRight size={16} color={colors.muted} />
                                </TouchableOpacity>
                            </View>

                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </SafeAreaView>

            {/* Pickers — inside Modal so they layer correctly on iOS */}
            <CategoryPicker
                visible={showCategoryPicker}
                categories={categories}
                selectedId={form.categoryId || null}
                onSelect={(id, name) => setForm(f => ({ ...f, categoryId: id ?? '', categoryName: name ?? '' }))}
                onClose={() => setShowCategoryPicker(false)}
            />
            <OptionPicker
                visible={showAccountTypePicker}
                title="Account Type"
                options={ACCOUNT_TYPE_OPTIONS}
                selectedValue={form.accountType}
                onSelect={v => setForm(f => ({ ...f, accountType: v }))}
                onClose={() => setShowAccountTypePicker(false)}
                noneLabel="Any account type"
            />
            <OptionPicker
                visible={showAccountPicker}
                title="Specific Account"
                options={accountOptions}
                selectedValue={form.accountId}
                onSelect={v => setForm(f => ({ ...f, accountId: v }))}
                onClose={() => setShowAccountPicker(false)}
                noneLabel="Any account"
            />
        </Modal>
    )
}
