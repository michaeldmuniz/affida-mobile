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
    type EditItem = { description: string; amountText: string; categoryId: string | null; categoryName: string | null; notInOwnersList?: string | null }
    const toEdit = (r: Receipt): EditItem[] =>
        r.lineItems.map((i) => ({ description: i.description, amountText: String(i.amount), categoryId: i.categoryId, categoryName: i.categoryName, notInOwnersList: i.notInOwnersList ?? null }))

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

    // Linked to someone else's account: a transaction there carries a category from its owner's list, so offer exactly that list
    const ownerName = receipt?.matchedTransaction?.accountOwnerName ?? null
    const ownerAccountId = ownerName ? receipt?.matchedTransaction?.accountId ?? null : null
    const { data: ownerList } = useQuery<{ ownerName: string | null; categories: (Category & { isSystem?: boolean })[] }>({
        queryKey: ['account-categories', ownerAccountId],
        queryFn: async () => (await apiClient.get(`/accounts/${ownerAccountId}/categories`)).data.data,
        staleTime: 5 * 60 * 1000,
        enabled: !!ownerAccountId && receipt?.canEdit !== false,
    })
    const pickerCategories: Category[] = ownerList
        ? ownerList.categories.map((c) => ({ id: c.id, name: c.name, group: c.group, isDefault: !!c.isSystem }))
        : categories
    const unmatchedCount = items.filter((i) => i.notInOwnersList).length

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
    type Preview = { linked: boolean; applied?: boolean; status?: string; reason?: string | null; splits: { categoryName: string | null; amount: number; isTaxLine: boolean }[] | null }
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

    const { mutate: undoSplit, isPending: isUndoing } = useMutation({
        mutationFn: async () => {
            await apiClient.delete(`/receipts/${receipt!.id}/split`)
        },
        onSuccess: () => {
            haptics.success()
            queryClient.invalidateQueries({ queryKey: ['receipts'] })
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            onClose()
        },
        onError: (err: any) => Alert.alert('Error', err?.response?.data?.error ?? err?.message ?? 'Failed to undo the split'),
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
            'This will split the matched transaction into one entry per category from this receipt. You can undo it from this receipt.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Split', onPress: () => applySplit() },
            ]
        )
    }

    const handleUndoSplit = () => {
        haptics.light()
        Alert.alert(
            'Undo Split',
            'The transaction goes back to one entry. You can split it again from this receipt, or unlink the receipt.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Undo split', style: 'destructive', onPress: () => undoSplit() },
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
        setItems((prev) => prev.map((item, i) => (i === index ? { ...item, categoryId, categoryName, notInOwnersList: null } : item)))
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

                                {ownerName && currentItems.length > 0 && (
                                    <Text className="px-4 pt-3 text-brand-muted text-xs">
                                        This is on {ownerName}'s account, so the items use {ownerName}'s categories.
                                    </Text>
                                )}
                                {unmatchedCount > 0 && (
                                    <View className="mx-4 mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2">
                                        <Text className="text-amber-400 text-xs">
                                            {unmatchedCount === 1 ? '1 item has' : `${unmatchedCount} items have`} no matching category on {ownerName ? `${ownerName}'s` : 'that'} account and will be uncategorized. You can pick one below, or leave {unmatchedCount === 1 ? 'it' : 'them'} as is.
                                        </Text>
                                    </View>
                                )}

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
                                                    {item.notInOwnersList && (
                                                        <Text className="text-amber-400 text-xs">
                                                            “{item.notInOwnersList}” isn't one of {ownerName ? `${ownerName}'s` : "the account owner's"} categories, so this item is uncategorized unless you pick one.
                                                        </Text>
                                                    )}
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
                            {editable && currentItems.length > 0 && (receipt.hasTaxOrTip || taxMode !== (base?.taxMode ?? 'spread')) && (
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
                                    <Text className="text-brand-muted text-xs">Saved as your choice for future receipts.</Text>
                                </View>
                            )}

                            {/* Where the split stands: what it is, or will be after saving, or the plain reason it is not split */}
                            {editable && receipt.status === 'matched' && itemsValid && preview && (
                                <View className="bg-brand-elevated rounded-2xl px-4 py-3.5 gap-y-1">
                                    <Text className="text-brand-muted text-xs font-semibold">
                                        {receipt.splitApplied
                                            ? dirty
                                                ? (preview.splits ? 'After you save, the split will be' : 'After you save, the transaction is no longer split')
                                                : 'The transaction is split by category'
                                            : preview.splits ? 'It can be split by category like this' : 'Not split'}
                                    </Text>
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
                                        <Text className="text-brand-muted text-xs">{preview.reason ?? "These items can't be split by category."}</Text>
                                    )}
                                    {dirty && receipt.splitApplied && preview.splits && (
                                        <Text className="text-brand-muted text-xs mt-1">Save your changes and the split follows them.</Text>
                                    )}
                                </View>
                            )}

                            {/* The split button for what is true right now: undo a split in place, or split when it can be */}
                            {editable && receipt.status === 'matched' && !dirty && currentItems.length > 0 && (
                                receipt.splitApplied ? (
                                    <TouchableOpacity
                                        className="h-12 rounded-2xl border border-brand-border items-center justify-center"
                                        onPress={handleUndoSplit}
                                        disabled={isUndoing}
                                        activeOpacity={0.8}
                                        accessibilityRole="button"
                                    >
                                        <Text className="text-brand-text font-semibold text-sm">{isUndoing ? 'Undoing…' : 'Undo split'}</Text>
                                    </TouchableOpacity>
                                ) : receipt.splitStatus === 'available' ? (
                                    <TouchableOpacity
                                        className="h-12 rounded-2xl bg-brand-accent items-center justify-center"
                                        onPress={handleApplySplit}
                                        disabled={isSplitting}
                                        activeOpacity={0.8}
                                        accessibilityRole="button"
                                    >
                                        <Text className="text-white font-semibold text-sm">{isSplitting ? 'Splitting…' : 'Split by category'}</Text>
                                    </TouchableOpacity>
                                ) : null
                            )}

                            {/* Only while there is something to save: no dead button */}
                            {editable && dirty && (
                                <View className="gap-y-2">
                                    {saveMessage && (
                                        <Text className={`text-xs ${saveMessage.kind === 'ok' ? 'text-brand-positive' : 'text-brand-negative'}`}>
                                            {saveMessage.text}
                                        </Text>
                                    )}
                                    <TouchableOpacity
                                        className={`h-14 rounded-2xl items-center justify-center ${itemsValid && totalValid && !isSaving ? 'bg-brand-accent' : 'bg-brand-elevated'}`}
                                        onPress={() => { haptics.medium(); saveChanges() }}
                                        disabled={!itemsValid || !totalValid || isSaving}
                                        activeOpacity={0.8}
                                        accessibilityRole="button"
                                    >
                                        <Text className={`font-semibold text-base ${itemsValid && totalValid && !isSaving ? 'text-white' : 'text-brand-muted'}`}>
                                            {isSaving ? 'Saving…' : 'Save changes'}
                                        </Text>
                                    </TouchableOpacity>
                                    {(!itemsValid || !totalValid) && (
                                        <Text className="text-brand-muted text-xs text-center">Every item needs a name and an amount, and the total must be more than 0.</Text>
                                    )}
                                </View>
                            )}
                            {editable && !dirty && saveMessage && (
                                <Text className={`text-xs ${saveMessage.kind === 'ok' ? 'text-brand-positive' : 'text-brand-negative'}`}>{saveMessage.text}</Text>
                            )}
                        </View>
                    </ScrollView>

                    <CategoryPicker
                        visible={pickingIndex !== null}
                        categories={pickerCategories}
                        ownerName={ownerList?.ownerName ?? null}
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
