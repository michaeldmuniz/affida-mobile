import { useState, useEffect } from 'react'
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Search, Plus, ChevronDown } from 'lucide-react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { AmountText } from '@/components/ui/AmountText'
import { haptics } from '@/lib/haptics'
import { colors } from '@/lib/colors'
import { OptionPicker } from '@/components/OptionPicker'
import { CategoryPicker } from '@/components/transactions/CategoryPicker'
import { useAccountCategories } from '@/hooks/useAccountCategories'
import type { Receipt, Account, Category } from '@/lib/types'

interface Candidate {
    id: string
    description: string
    merchantName: string | null
    amount: number
    date: string
    pending: boolean
    accountName: string
    categoryName: string | null
    suggested: boolean
}

interface Props {
    receipt: Receipt | null
    onClose: () => void
}

export function LinkTransactionSheet({ receipt, onClose }: Props) {
    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')

    // Debounced so typing doesn't fire a request per keystroke
    const [term, setTerm] = useState('')
    useEffect(() => {
        const t = setTimeout(() => setTerm(search.trim()), 300)
        return () => clearTimeout(t)
    }, [search])

    // Ranked by the server: amount (tip included), date, merchant. Searching drops the date window.
    const { data: filtered = [], isLoading } = useQuery<Candidate[]>({
        queryKey: ['receipt-candidates', receipt?.id, term],
        queryFn: async () => {
            const res = await apiClient.get(`/receipts/${receipt!.id}/candidates`, { params: term ? { search: term } : {} })
            return res.data.data as Candidate[]
        },
        enabled: !!receipt,
        staleTime: 30 * 1000,
    })

    const [creating, setCreating] = useState(false)
    const [account, setAccount] = useState<Account | null>(null)
    const [category, setCategory] = useState<Category | null>(null)
    const [showAccountPicker, setShowAccountPicker] = useState(false)
    const [showCategoryPicker, setShowCategoryPicker] = useState(false)

    const { data: accounts } = useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: async () => (await apiClient.get('/accounts')).data.data,
        enabled: !!receipt && creating,
    })
    const { categories, ownerName: categoryOwner, createCategory } = useAccountCategories(account?.id, !!receipt && creating)
    const manualAccounts = accounts?.filter((a) => !a.plaidLinked) ?? []

    const { mutate: createFromReceipt, isPending: isCreating } = useMutation({
        mutationFn: async () => {
            await apiClient.post(`/receipts/${receipt!.id}/transaction`, {
                accountId: account!.id,
                categoryId: category?.id ?? null,
            })
        },
        onSuccess: () => {
            haptics.success()
            queryClient.invalidateQueries({ queryKey: ['receipts'] })
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
            handleClose()
        },
        onError: (e: any) => {
            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to create the transaction. Please try again.')
        },
    })

    const { mutate: link, isPending } = useMutation({
        mutationFn: async (transactionId: string) => {
            await apiClient.patch(`/receipts/${receipt!.id}`, { transactionId })
        },
        onSuccess: () => {
            haptics.success()
            queryClient.invalidateQueries({ queryKey: ['receipts'] })
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            onClose()
        },
        onError: () => {
            Alert.alert('Error', 'Failed to link receipt. Please try again.')
        },
    })

    const handleClose = () => {
        setSearch('')
        setCreating(false)
        setAccount(null)
        setCategory(null)
        onClose()
    }

    if (!receipt) return null

    const receiptLabel = [
        receipt.merchantName ?? 'Unknown',
        receipt.date
            ? new Date(receipt.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : null,
        receipt.total != null ? `$${receipt.total.toFixed(2)}` : null,
    ].filter(Boolean).join(' · ')

    return (
        <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
            <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                {/* Header */}
                <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={handleClose} hitSlop={8} className="w-8">
                        <X size={20} color={colors.muted} />
                    </TouchableOpacity>
                    <Text className="flex-1 text-center text-brand-text text-base font-semibold">
                        Link to Transaction
                    </Text>
                    <View className="w-8" />
                </View>

                {/* Receipt context + search */}
                <View className="px-4 pt-3 pb-2 border-b border-brand-border gap-y-2.5">
                    <Text className="text-brand-muted text-xs" numberOfLines={1}>
                        Receipt: {receiptLabel}
                    </Text>
                    <View className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-3.5 h-11 gap-x-2">
                        <Search size={16} color={colors.muted} strokeWidth={1.8} />
                        <TextInput
                            className="flex-1 text-brand-text text-sm"
                            placeholder="Search transactions..."
                            placeholderTextColor={colors.muted}
                            value={search}
                            onChangeText={setSearch}
                            autoCorrect={false}
                        />
                    </View>
                    <Text className="text-brand-muted text-xs">
                        {term ? 'Searching all dates' : 'Best matches first (amount, date and merchant). Search to look further back.'}
                    </Text>
                    {receipt.total != null && receipt.total > 0 && (
                        <TouchableOpacity
                            accessibilityRole="button"
                            className="flex-row items-center justify-center gap-x-1.5 h-10 rounded-xl border border-brand-border bg-brand-surface"
                            onPress={() => { haptics.light(); setCreating(true) }}
                            activeOpacity={0.7}
                        >
                            <Plus size={14} color={colors.accent} strokeWidth={2.5} />
                            <Text className="text-brand-accent text-sm font-semibold">Create transaction from receipt</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {creating ? (
                    <View className="px-4 py-4 gap-y-3">
                        <Text className="text-brand-text text-sm">
                            Adds a ${receipt.total?.toFixed(2)} expense for {receipt.merchantName ?? 'this receipt'} on{' '}
                            {receipt.date ? new Date(receipt.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'today'}{' '}
                            to an account you track by hand, and links the receipt to it.
                        </Text>
                        <TouchableOpacity
                            accessibilityRole="button"
                            className="flex-row items-center justify-between bg-brand-surface border border-brand-border rounded-xl px-4 h-12"
                            onPress={() => { haptics.light(); setShowAccountPicker(true) }}
                        >
                            <Text className={account ? 'text-brand-text text-sm' : 'text-brand-muted text-sm'}>
                                {account?.name ?? 'Choose account'}
                            </Text>
                            <ChevronDown size={16} color={colors.muted} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            accessibilityRole="button"
                            className="flex-row items-center justify-between bg-brand-surface border border-brand-border rounded-xl px-4 h-12"
                            onPress={() => { haptics.light(); setShowCategoryPicker(true) }}
                        >
                            <Text className={category ? 'text-brand-text text-sm' : 'text-brand-muted text-sm'}>
                                {category?.name ?? 'Category (picked automatically if blank)'}
                            </Text>
                            <ChevronDown size={16} color={colors.muted} />
                        </TouchableOpacity>
                        {accounts && manualAccounts.length === 0 && (
                            <Text className="text-brand-muted text-xs">
                                You have no manual accounts. Add one under Accounts first.
                            </Text>
                        )}
                        <TouchableOpacity
                            accessibilityRole="button"
                            className={`h-12 rounded-xl items-center justify-center ${account && !isCreating ? 'bg-brand-accent' : 'bg-brand-elevated'}`}
                            disabled={!account || isCreating}
                            onPress={() => { haptics.medium(); createFromReceipt() }}
                        >
                            {isCreating
                                ? <ActivityIndicator color="#fff" />
                                : <Text className={`text-sm font-semibold ${account ? 'text-white' : 'text-brand-muted'}`}>Create &amp; link</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity accessibilityRole="button" className="h-10 items-center justify-center" onPress={() => setCreating(false)} disabled={isCreating}>
                            <Text className="text-brand-muted text-sm">Back to matches</Text>
                        </TouchableOpacity>

                        <OptionPicker
                            visible={showAccountPicker}
                            title="Choose Account"
                            noneLabel="Cancel"
                            options={manualAccounts.map((a) => ({ label: a.name, value: a.id }))}
                            selectedValue={account?.id ?? null}
                            onSelect={(value) => {
                                setAccount(manualAccounts.find((a) => a.id === value) ?? null); setCategory(null)
                                setShowAccountPicker(false)
                            }}
                            onClose={() => setShowAccountPicker(false)}
                        />
                        <CategoryPicker
                            visible={showCategoryPicker}
                            categories={categories}
                            ownerName={categoryOwner}
                            onCreate={createCategory}
                            selectedId={category?.id ?? null}
                            onSelect={(id) => {
                                setCategory(id ? categories.find((c) => c.id === id) ?? null : null)
                                setShowCategoryPicker(false)
                            }}
                            onClose={() => setShowCategoryPicker(false)}
                        />
                    </View>
                ) : (
                <ScrollView className="flex-1" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                    <View className="px-4 py-3 gap-y-2 pb-8">
                        {isLoading ? (
                            <View className="py-12 items-center">
                                <ActivityIndicator color={colors.accent} />
                            </View>
                        ) : filtered.length === 0 ? (
                            <View className="py-12 items-center gap-y-2">
                                <Text className="text-brand-muted text-sm">No transactions found</Text>
                                {search.length === 0 && (
                                    <Text className="text-brand-muted text-xs text-center px-8">
                                        Try pulling to refresh on the Transactions screen to sync the latest data, then come back.
                                    </Text>
                                )}
                            </View>
                        ) : (
                            filtered.map((tx) => (
                                <TouchableOpacity
                                    key={tx.id}
                                    className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 py-3.5"
                                    onPress={() => { haptics.light(); link(tx.id) }}
                                    disabled={isPending}
                                    activeOpacity={0.7}
                                >
                                    <View className="flex-1 pr-3">
                                        <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>
                                            {tx.merchantName ?? tx.description}
                                        </Text>
                                        {tx.suggested && (
                                            <Text className="text-brand-accent text-[10px] font-semibold uppercase tracking-wide mt-0.5">
                                                Likely match
                                            </Text>
                                        )}
                                        <Text className="text-brand-muted text-xs mt-0.5">
                                            {new Date(tx.date.slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', {
                                                month: 'short', day: 'numeric',
                                            })} · {tx.categoryName ?? 'Uncategorized'} · {tx.accountName}
                                        </Text>
                                    </View>
                                    {isPending
                                        ? <ActivityIndicator size="small" color={colors.accent} />
                                        : <AmountText amount={tx.amount} size="sm" showSign />
                                    }
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                </ScrollView>
                )}
            </SafeAreaView>
        </Modal>
    )
}
