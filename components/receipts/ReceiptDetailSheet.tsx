import { useState, useEffect } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, CheckCircle, Clock, AlertCircle, ChevronRight } from 'lucide-react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { CategoryPicker } from '@/components/transactions/CategoryPicker'
import { AmountText } from '@/components/ui/AmountText'
import { haptics } from '@/lib/haptics'
import { colors } from '@/lib/colors'
import type { Receipt } from '@/lib/types'
import type { Category } from '@/lib/types'

interface Props {
    receipt: Receipt | null
    onClose: () => void
}

export function ReceiptDetailSheet({ receipt, onClose }: Props) {
    const queryClient = useQueryClient()
    type EditItem = { description: string; amountText: string; categoryId: string | null; categoryName: string | null }
    const toEdit = (r: Receipt): EditItem[] =>
        r.lineItems.map((i) => ({ description: i.description, amountText: String(i.amount), categoryId: i.categoryId, categoryName: i.categoryName }))

    // `base` is what the server last confirmed; the fields below are the edits on top of it
    const [base, setBase] = useState<Receipt | null>(receipt)
    const [items, setItems] = useState<EditItem[]>([])
    const [totalText, setTotalText] = useState('')
    const [taxMode, setTaxMode] = useState<'spread' | 'separate'>('spread')
    const [pickingIndex, setPickingIndex] = useState<number | null>(null)
    const [saveMessage, setSaveMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)

    useEffect(() => {
        if (!receipt) return
        setBase(receipt)
        setItems(toEdit(receipt))
        setTotalText(receipt.total != null ? String(receipt.total) : '')
        setTaxMode(receipt.taxMode ?? 'spread')
        setSaveMessage(null)
    }, [receipt?.id])

    const editable = receipt?.canEdit !== false

    const { data: categories = [] } = useQuery<Category[]>({
        queryKey: ['categories'],
        queryFn: async () => (await apiClient.get('/categories')).data.data,
        staleTime: 5 * 60 * 1000,
        enabled: !!receipt,
    })

    const parsedItems = items.map((i) => ({ description: i.description, amount: Number(i.amountText), categoryId: i.categoryId }))
    const itemsValid = items.every((i) => i.description.trim() !== '' && i.amountText.trim() !== '' && Number.isFinite(Number(i.amountText)))
    const totalValid = totalText.trim() !== '' && Number.isFinite(Number(totalText)) && Number(totalText) > 0

    const dirty = !!base && (
        taxMode !== (base.taxMode ?? 'spread') ||
        Number(totalText) !== (base.total ?? NaN) ||
        items.length !== base.lineItems.length ||
        items.some((it, i) => {
            const orig = base.lineItems[i]
            return it.description !== orig.description || Number(it.amountText) !== orig.amount || (it.categoryId ?? null) !== (orig.categoryId ?? null)
        })
    )

    // What the transaction will be split into, asked of the server so the app and the website always agree
    const previewKey = JSON.stringify([parsedItems, taxMode])
    const [debouncedKey, setDebouncedKey] = useState(previewKey)
    useEffect(() => {
        const t = setTimeout(() => setDebouncedKey(previewKey), 400)
        return () => clearTimeout(t)
    }, [previewKey])
    type Preview = { linked: boolean; splits: { categoryName: string | null; amount: number; isTaxLine: boolean }[] | null }
    const { data: preview } = useQuery<Preview>({
        queryKey: ['receipt-preview', receipt?.id, debouncedKey],
        queryFn: async () => (await apiClient.post(`/receipts/${receipt!.id}/preview`, { lineItems: parsedItems, taxMode })).data.data,
        enabled: !!receipt && receipt.status === 'matched' && itemsValid && editable,
    })

    const { mutate: saveChanges, isPending: isSaving } = useMutation({
        mutationFn: async () => {
            const res = await apiClient.patch(`/receipts/${receipt!.id}`, { lineItems: parsedItems, total: Number(totalText), taxMode })
            return res.data.data as Receipt
        },
        onSuccess: (updated) => {
            haptics.success()
            setBase(updated)
            setItems(toEdit(updated))
            setTotalText(updated.total != null ? String(updated.total) : '')
            setTaxMode(updated.taxMode ?? taxMode)
            setSaveMessage({ kind: 'ok', text: updated.splitApplied ? 'Saved. The split follows your changes.' : 'Saved.' })
            queryClient.invalidateQueries({ queryKey: ['receipts'] })
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
        },
        // Shown inline: a native Alert while this sheet is presenting can crash on iOS
        onError: (err: any) => setSaveMessage({ kind: 'error', text: err?.response?.data?.error ?? 'Could not save the receipt. Please try again.' }),
    })

    const { mutate: applySplit, isPending: isSplitting } = useMutation({
        mutationFn: async () => {
            await apiClient.post(`/receipts/${receipt!.id}/split`)
        },
        onSuccess: () => {
            haptics.success()
            queryClient.invalidateQueries({ queryKey: ['receipts'] })
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            onClose()
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to split transaction'
            Alert.alert('Error', msg)
        },
    })

    const { mutate: unlink, isPending: isUnlinking } = useMutation({
        mutationFn: async () => {
            await apiClient.patch(`/receipts/${receipt!.id}`, { unlink: true })
        },
        onSuccess: () => {
            haptics.success()
            queryClient.invalidateQueries({ queryKey: ['receipts'] })
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
        },
        onError: (err: any) => {
            const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to unlink transaction'
            Alert.alert('Error', msg)
        },
    })

    const handleApplySplit = () => {
        haptics.light()
        Alert.alert(
            'Split Transaction',
            'This will split the matched transaction into one entry per category from this receipt. This cannot be undone from here.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Split', onPress: () => applySplit() },
            ]
        )
    }

    const handleUnlink = () => {
        haptics.light()
        Alert.alert(
            'Unlink Transaction',
            'This receipt will be unlinked and returned to pending, so it can be matched to a different transaction.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Unlink', style: 'destructive', onPress: () => unlink() },
            ]
        )
    }

    if (!receipt) return null

    const handleCategorySelect = (index: number, categoryId: string | null, categoryName: string | null) => {
        setItems((prev) => prev.map((item, i) => (i === index ? { ...item, categoryId, categoryName } : item)))
        setPickingIndex(null)
    }

    const updateItem = (index: number, patch: Partial<EditItem>) =>
        setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)))

    const currentItems = items

    return (
        <Modal
                visible={!!receipt}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={onClose}
            >
                <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                    {/* Header */}
                    <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8} className="w-8">
                            <X size={20} color={colors.muted} />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-brand-text text-base font-semibold">
                            Receipt Details
                        </Text>
                        <View className="w-8" />
                    </View>

                    <ScrollView className="flex-1" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
                        <View className="px-6 py-5 gap-y-4">
                            {receipt.imageUrl && (
                                <Image
                                    source={{ uri: receipt.imageUrl }}
                                    style={{ width: '100%', height: 360, borderRadius: 16, backgroundColor: '#111' }}
                                    resizeMode="contain"
                                />
                            )}

                            {/* Status banner */}
                            {receipt.status === 'matched' ? (
                                <View className="flex-row items-center gap-x-3 bg-brand-positive/10 border border-brand-positive/25 rounded-2xl px-4 py-3.5">
                                    <CheckCircle size={20} color={colors.positive} />
                                    <View className="flex-1">
                                        <Text className="text-brand-positive font-semibold text-sm">Matched</Text>
                                        <Text className="text-brand-positive/80 text-xs mt-0.5">
                                            Linked to {receipt.matchedTransaction?.merchantName ?? receipt.matchedTransaction?.description ?? 'a transaction'}
                                        </Text>
                                    </View>
                                    {!receipt.splitApplied && (
                                        <TouchableOpacity
                                            onPress={handleUnlink}
                                            disabled={isUnlinking}
                                            hitSlop={8}
                                        >
                                            <Text className="text-brand-positive/80 text-xs font-medium underline">
                                                {isUnlinking ? 'Unlinking…' : 'Unlink'}
                                            </Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            ) : receipt.status === 'pending' ? (
                                <View className="flex-row items-center gap-x-3 bg-brand-accent/10 border border-brand-accent/25 rounded-2xl px-4 py-3.5">
                                    <Clock size={20} color={colors.accent} />
                                    <View className="flex-1">
                                        <Text className="text-brand-accent font-semibold text-sm">Pending Match</Text>
                                        <Text className="text-brand-accent/80 text-xs mt-0.5">
                                            Waiting to be matched to a transaction
                                        </Text>
                                    </View>
                                </View>
                            ) : (
                                <View className="flex-row items-center gap-x-3 bg-brand-elevated border border-brand-border rounded-2xl px-4 py-3.5">
                                    <AlertCircle size={20} color={colors.muted} />
                                    <View className="flex-1">
                                        <Text className="text-brand-text font-semibold text-sm">Unmatched</Text>
                                        <Text className="text-brand-muted text-xs mt-0.5">No matching transaction found</Text>
                                    </View>
                                </View>
                            )}

                            {/* Merchant + total */}
                            <View className="bg-brand-surface border border-brand-border rounded-2xl overflow-hidden">
                                <View className="px-4 py-3.5 border-b border-brand-border flex-row items-center justify-between">
                                    <View className="flex-1 pr-3">
                                        <Text className="text-brand-text font-semibold" numberOfLines={1}>
                                            {receipt.merchantName ?? 'Unknown Merchant'}
                                        </Text>
                                        {receipt.date && (
                                            <Text className="text-brand-muted text-xs mt-0.5">
                                                {new Date(receipt.date + 'T00:00:00').toLocaleDateString('en-US', {
                                                    month: 'short', day: 'numeric', year: 'numeric',
                                                })}
                                            </Text>
                                        )}
                                    </View>
                                    {editable ? (
                                        <View className="flex-row items-center bg-brand-elevated border border-brand-border rounded-xl px-3 h-10">
                                            <Text className="text-brand-muted text-sm mr-1">$</Text>
                                            <TextInput
                                                value={totalText}
                                                onChangeText={(t) => { setTotalText(t); setSaveMessage(null) }}
                                                keyboardType="decimal-pad"
                                                accessibilityLabel="Receipt total"
                                                className="text-brand-text text-sm font-semibold min-w-[64px] text-right"
                                                placeholder="0.00"
                                                placeholderTextColor={colors.muted}
                                            />
                                        </View>
                                    ) : (
                                        receipt.total != null && <AmountText amount={-receipt.total} size="md" showSign />
                                    )}
                                </View>

                                {/* Line items: name, amount and category can all be corrected */}
                                {currentItems.length > 0 ? (
                                    currentItems.map((item, i) => (
                                        <View
                                            key={i}
                                            className={`px-4 py-3 gap-y-2 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                                        >
                                            {editable ? (
                                                <>
                                                    <TextInput
                                                        value={item.description}
                                                        onChangeText={(t) => { updateItem(i, { description: t }); setSaveMessage(null) }}
                                                        maxLength={120}
                                                        accessibilityLabel={`Item ${i + 1} name`}
                                                        className="text-brand-text text-sm bg-brand-elevated border border-brand-border rounded-xl px-3 h-10"
                                                        placeholder="Item name"
                                                        placeholderTextColor={colors.muted}
                                                    />
                                                    <View className="flex-row items-center gap-x-2">
                                                        <TouchableOpacity
                                                            className="flex-1 flex-row items-center justify-between bg-brand-elevated border border-brand-border rounded-xl px-3 h-10"
                                                            onPress={() => { haptics.light(); setPickingIndex(i) }}
                                                            activeOpacity={0.7}
                                                            accessibilityRole="button"
                                                            accessibilityLabel={`Item ${i + 1} category`}
                                                        >
                                                            <Text className="text-brand-accent text-xs" numberOfLines={1}>
                                                                {item.categoryName ?? 'Tap to categorize'}
                                                            </Text>
                                                            <ChevronRight size={14} color={colors.muted} strokeWidth={2} />
                                                        </TouchableOpacity>
                                                        <View className="flex-row items-center bg-brand-elevated border border-brand-border rounded-xl px-3 h-10 w-28">
                                                            <Text className="text-brand-muted text-sm mr-1">$</Text>
                                                            <TextInput
                                                                value={item.amountText}
                                                                onChangeText={(t) => { updateItem(i, { amountText: t }); setSaveMessage(null) }}
                                                                keyboardType="decimal-pad"
                                                                accessibilityLabel={`Item ${i + 1} amount`}
                                                                className="flex-1 min-w-0 text-brand-text text-sm text-right"
                                                                placeholder="0.00"
                                                                placeholderTextColor={colors.muted}
                                                            />
                                                        </View>
                                                    </View>
                                                </>
                                            ) : (
                                                <View className="flex-row items-center">
                                                    <View className="flex-1 pr-3">
                                                        <Text className="text-brand-text text-sm" numberOfLines={1}>{item.description}</Text>
                                                        <Text className="text-brand-muted text-xs mt-0.5">{item.categoryName ?? 'Uncategorized'}</Text>
                                                    </View>
                                                    <AmountText amount={-Number(item.amountText)} size="sm" showSign />
                                                </View>
                                            )}
                                        </View>
                                    ))
                                ) : (
                                    <View className="px-4 py-4">
                                        <Text className="text-brand-muted text-sm">No line items parsed</Text>
                                    </View>
                                )}
                            </View>

                            {/* Tax & tip: how it is handled when the transaction is split. Always offered; the choice is kept for next time */}
                            {editable && currentItems.length > 0 && (
                                <View className="bg-brand-surface border border-brand-border rounded-2xl px-4 py-3.5 gap-y-2.5">
                                    <Text className="text-brand-muted text-xs font-semibold uppercase tracking-wide">Tax &amp; tip when splitting</Text>
                                    {([
                                        ['spread', 'Spread it across the categories', 'Each category carries its share, so every split adds up to what you were charged.'],
                                        ['separate', 'Show it as its own line', 'Each category matches the receipt exactly, with a separate “Tax & tip” split.'],
                                    ] as const).map(([value, label, hint]) => (
                                        <TouchableOpacity
                                            key={value}
                                            className="flex-row items-start gap-x-3"
                                            onPress={() => { haptics.light(); setTaxMode(value); setSaveMessage(null) }}
                                            activeOpacity={0.7}
                                            accessibilityRole="radio"
                                            accessibilityState={{ selected: taxMode === value }}
                                            accessibilityLabel={label}
                                        >
                                            <View className={`mt-0.5 w-5 h-5 rounded-full border-2 items-center justify-center ${taxMode === value ? 'border-brand-accent' : 'border-brand-border'}`}>
                                                {taxMode === value && <View className="w-2.5 h-2.5 rounded-full bg-brand-accent" />}
                                            </View>
                                            <View className="flex-1">
                                                <Text className="text-brand-text text-sm font-medium">{label}</Text>
                                                <Text className="text-brand-muted text-xs mt-0.5">{hint}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    ))}
                                    <Text className="text-brand-muted text-xs">Saved as your choice for future receipts. You can change it here every time.</Text>
                                </View>
                            )}

                            {/* What the split will look like */}
                            {editable && receipt.status === 'matched' && itemsValid && preview && (
                                <View className="bg-brand-elevated rounded-2xl px-4 py-3.5 gap-y-1">
                                    <Text className="text-brand-muted text-xs font-semibold">The transaction will be split like this</Text>
                                    {preview.splits ? (
                                        preview.splits.map((sp, i) => (
                                            <View key={i} className="flex-row justify-between">
                                                <Text className="text-brand-text text-sm flex-1 pr-3" numberOfLines={1}>
                                                    {sp.isTaxLine ? 'Tax & tip' : sp.categoryName ?? 'Uncategorized'}
                                                </Text>
                                                <Text className="text-brand-text text-sm font-mono">${sp.amount.toFixed(2)}</Text>
                                            </View>
                                        ))
                                    ) : (
                                        <Text className="text-brand-muted text-xs">
                                            These items won't be split automatically: they fall in one category, or they don't add up to the charge.
                                        </Text>
                                    )}
                                </View>
                            )}

                            {/* Save the corrections (re-splits an already split transaction) */}
                            {editable && (
                                <View className="gap-y-2">
                                    {saveMessage && (
                                        <Text className={`text-xs ${saveMessage.kind === 'ok' ? 'text-brand-positive' : 'text-brand-negative'}`}>
                                            {saveMessage.text}
                                        </Text>
                                    )}
                                    <TouchableOpacity
                                        className={`h-14 rounded-2xl items-center justify-center ${dirty && itemsValid && totalValid && !isSaving ? 'bg-brand-accent' : 'bg-brand-elevated'}`}
                                        onPress={() => { haptics.medium(); saveChanges() }}
                                        disabled={!dirty || !itemsValid || !totalValid || isSaving}
                                        activeOpacity={0.8}
                                        accessibilityRole="button"
                                    >
                                        <Text className={`font-semibold text-base ${dirty && itemsValid && totalValid && !isSaving ? 'text-white' : 'text-brand-muted'}`}>
                                            {isSaving ? 'Saving…' : 'Save changes'}
                                        </Text>
                                    </TouchableOpacity>
                                    {dirty && (!itemsValid || !totalValid) && (
                                        <Text className="text-brand-muted text-xs text-center">Every item needs a name and an amount, and the total must be more than 0.</Text>
                                    )}
                                </View>
                            )}

                            {/* Apply split to matched transaction */}
                            {receipt.status === 'matched' && currentItems.length > 0 && (
                                receipt.splitApplied ? (
                                    <View className="flex-row items-center gap-x-3 bg-brand-positive/10 border border-brand-positive/25 rounded-2xl px-4 py-3.5">
                                        <CheckCircle size={20} color={colors.positive} />
                                        <View className="flex-1">
                                            <Text className="text-brand-positive font-semibold text-sm">Split Applied</Text>
                                            <Text className="text-brand-positive/80 text-xs mt-0.5">
                                                The transaction has been split by category
                                            </Text>
                                        </View>
                                    </View>
                                ) : (
                                    <TouchableOpacity
                                        className="h-14 rounded-2xl bg-brand-accent items-center justify-center"
                                        onPress={handleApplySplit}
                                        disabled={isSplitting}
                                        activeOpacity={0.8}
                                    >
                                        <Text className="text-white font-semibold text-base">
                                            {isSplitting ? 'Splitting…' : 'Split Transaction by Category'}
                                        </Text>
                                    </TouchableOpacity>
                                )
                            )}
                        </View>
                    </ScrollView>

                    <CategoryPicker
                        visible={pickingIndex !== null}
                        categories={categories}
                        selectedId={pickingIndex !== null ? (currentItems[pickingIndex]?.categoryId ?? null) : null}
                        onSelect={(id, name) => {
                            if (pickingIndex !== null) handleCategorySelect(pickingIndex, id, name)
                        }}
                        onClose={() => setPickingIndex(null)}
                    />
                </SafeAreaView>
        </Modal>
    )
}
