import { useState } from 'react'
import { Modal, View, Text, TouchableOpacity, ScrollView, Switch } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Check, ChevronRight } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { CategoryPicker } from './CategoryPicker'
import type { Account, Category } from '@/lib/types'

export interface TransactionFilters {
    type: 'all' | 'income' | 'expense'
    dateRange: 'all' | '30d' | '90d' | 'thisMonth' | 'lastMonth'
    accountId: string | null
    accountName: string | null
    categoryId: string | null
    categoryName: string | null
    flagged: boolean
    sort: 'date' | 'amount'
    order: 'asc' | 'desc'
}

export const DEFAULT_FILTERS: TransactionFilters = {
    type: 'all',
    dateRange: 'all',
    accountId: null,
    accountName: null,
    categoryId: null,
    categoryName: null,
    flagged: false,
    sort: 'date',
    order: 'desc',
}

export function activeFilterCount(f: TransactionFilters): number {
    let n = 0
    if (f.type !== 'all') n++
    if (f.dateRange !== 'all') n++
    if (f.accountId) n++
    if (f.categoryId !== undefined && f.categoryId !== null) n++
    if (f.flagged) n++
    if (f.sort !== 'date' || f.order !== 'desc') n++
    return n
}

export function filtersToParams(f: TransactionFilters): Record<string, string> {
    const p: Record<string, string> = {}
    if (f.type !== 'all') p.type = f.type
    if (f.accountId) p.accountId = f.accountId
    if (f.categoryId) p.categoryId = f.categoryId
    if (f.flagged) p.flagged = 'true'
    p.sort = f.sort
    p.order = f.order

    if (f.dateRange !== 'all') {
        const now = new Date()
        if (f.dateRange === 'thisMonth') {
            p.startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
            p.endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
        } else if (f.dateRange === 'lastMonth') {
            p.startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()
            p.endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString()
        } else if (f.dateRange === '30d') {
            const d = new Date(); d.setDate(d.getDate() - 30)
            p.startDate = d.toISOString()
        } else if (f.dateRange === '90d') {
            const d = new Date(); d.setDate(d.getDate() - 90)
            p.startDate = d.toISOString()
        }
    }

    return p
}

const DATE_OPTIONS: { value: TransactionFilters['dateRange']; label: string }[] = [
    { value: 'all', label: 'All time' },
    { value: 'thisMonth', label: 'This month' },
    { value: 'lastMonth', label: 'Last month' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
]

const SORT_OPTIONS: { sort: TransactionFilters['sort']; order: TransactionFilters['order']; label: string }[] = [
    { sort: 'date', order: 'desc', label: 'Date (newest first)' },
    { sort: 'date', order: 'asc', label: 'Date (oldest first)' },
    { sort: 'amount', order: 'desc', label: 'Amount (highest first)' },
    { sort: 'amount', order: 'asc', label: 'Amount (lowest first)' },
]

interface Props {
    visible: boolean
    filters: TransactionFilters
    onApply: (f: TransactionFilters) => void
    onClose: () => void
}

export function FilterSheet({ visible, filters, onApply, onClose }: Props) {
    const [local, setLocal] = useState<TransactionFilters>(filters)
    const [showCategoryPicker, setShowCategoryPicker] = useState(false)
    const [showAccountPicker, setShowAccountPicker] = useState(false)

    const { data: categories = [] } = useQuery<Category[]>({
        queryKey: ['categories'],
        queryFn: async () => {
            const res = await apiClient.get('/categories')
            return res.data.data ?? []
        },
        staleTime: 5 * 60 * 1000,
    })

    const { data: accounts = [] } = useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: async () => {
            const res = await apiClient.get('/accounts')
            return res.data.data ?? []
        },
        staleTime: 5 * 60 * 1000,
    })

    const set = <K extends keyof TransactionFilters>(k: K, v: TransactionFilters[K]) =>
        setLocal(prev => ({ ...prev, [k]: v }))

    const handleOpen = () => setLocal(filters)

    const handleReset = () => setLocal(DEFAULT_FILTERS)

    const handleApply = () => {
        onApply(local)
        onClose()
    }

    const currentSort = SORT_OPTIONS.find(o => o.sort === local.sort && o.order === local.order)
        ?? SORT_OPTIONS[0]

    return (
        <>
            <Modal
                visible={visible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={onClose}
                onShow={handleOpen}
            >
                <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                    {/* Header */}
                    <View className="flex-row items-center justify-between px-5 pt-5 pb-4 border-b border-brand-border">
                        <TouchableOpacity onPress={handleReset}>
                            <Text className="text-brand-muted text-sm">Reset</Text>
                        </TouchableOpacity>
                        <Text className="text-brand-text text-base font-bold">Filters</Text>
                        <TouchableOpacity onPress={onClose}>
                            <X size={20} color="#6B7280" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                        <View className="px-5 pt-5 gap-y-6 pb-8">

                            {/* Type */}
                            <Section label="Type">
                                <View className="flex-row gap-x-2">
                                    {(['all', 'income', 'expense'] as const).map(t => (
                                        <Chip
                                            key={t}
                                            label={t === 'all' ? 'All' : t === 'income' ? 'Income' : 'Expense'}
                                            active={local.type === t}
                                            onPress={() => set('type', t)}
                                        />
                                    ))}
                                </View>
                            </Section>

                            {/* Date Range */}
                            <Section label="Date Range">
                                <View className="gap-y-2">
                                    {DATE_OPTIONS.map(opt => (
                                        <RowOption
                                            key={opt.value}
                                            label={opt.label}
                                            active={local.dateRange === opt.value}
                                            onPress={() => set('dateRange', opt.value)}
                                        />
                                    ))}
                                </View>
                            </Section>

                            {/* Account */}
                            <Section label="Account">
                                <TouchableOpacity
                                    className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 h-12"
                                    onPress={() => setShowAccountPicker(true)}
                                    activeOpacity={0.7}
                                >
                                    <Text className={`flex-1 text-sm ${local.accountId ? 'text-brand-text' : 'text-brand-muted'}`}>
                                        {local.accountName ?? 'All accounts'}
                                    </Text>
                                    {local.accountId
                                        ? <TouchableOpacity onPress={() => { set('accountId', null); set('accountName', null) }} hitSlop={8}>
                                            <X size={15} color="#6B7280" />
                                        </TouchableOpacity>
                                        : <ChevronRight size={16} color="#6B7280" />
                                    }
                                </TouchableOpacity>
                            </Section>

                            {/* Category */}
                            <Section label="Category">
                                <TouchableOpacity
                                    className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 h-12"
                                    onPress={() => setShowCategoryPicker(true)}
                                    activeOpacity={0.7}
                                >
                                    <Text className={`flex-1 text-sm ${local.categoryId ? 'text-brand-text' : 'text-brand-muted'}`}>
                                        {local.categoryName ?? 'All categories'}
                                    </Text>
                                    {local.categoryId
                                        ? <TouchableOpacity onPress={() => { set('categoryId', null); set('categoryName', null) }} hitSlop={8}>
                                            <X size={15} color="#6B7280" />
                                        </TouchableOpacity>
                                        : <ChevronRight size={16} color="#6B7280" />
                                    }
                                </TouchableOpacity>
                            </Section>

                            {/* Flagged */}
                            <Section label="Other">
                                <View className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-4 h-12">
                                    <Text className="flex-1 text-brand-text text-sm">Flagged only</Text>
                                    <Switch
                                        value={local.flagged}
                                        onValueChange={v => set('flagged', v)}
                                        trackColor={{ true: '#5B7BF8' }}
                                        thumbColor="#fff"
                                    />
                                </View>
                            </Section>

                            {/* Sort */}
                            <Section label="Sort By">
                                <View className="gap-y-2">
                                    {SORT_OPTIONS.map(opt => (
                                        <RowOption
                                            key={`${opt.sort}-${opt.order}`}
                                            label={opt.label}
                                            active={local.sort === opt.sort && local.order === opt.order}
                                            onPress={() => { set('sort', opt.sort); set('order', opt.order) }}
                                        />
                                    ))}
                                </View>
                            </Section>

                        </View>
                    </ScrollView>

                    {/* Apply */}
                    <View className="px-5 pb-4 pt-3 border-t border-brand-border">
                        <TouchableOpacity
                            className="h-14 rounded-2xl bg-brand-accent items-center justify-center"
                            onPress={handleApply}
                            activeOpacity={0.85}
                        >
                            <Text className="text-white font-semibold text-base">Apply Filters</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>

                {/* Pickers must be inside the Modal */}
                <CategoryPicker
                    visible={showCategoryPicker}
                    categories={categories}
                    selectedId={local.categoryId}
                    onSelect={(id, name) => { set('categoryId', id); set('categoryName', name) }}
                    onClose={() => setShowCategoryPicker(false)}
                />

                <Modal
                    visible={showAccountPicker}
                    animationType="slide"
                    presentationStyle="pageSheet"
                    onRequestClose={() => setShowAccountPicker(false)}
                >
                    <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                        <View className="flex-row items-center justify-between px-4 py-3 border-b border-brand-border">
                            <Text className="flex-1 text-brand-text text-lg font-semibold">Account</Text>
                            <TouchableOpacity onPress={() => setShowAccountPicker(false)} hitSlop={8}>
                                <X size={20} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView className="flex-1">
                            <TouchableOpacity
                                className="flex-row items-center px-4 py-3.5 border-b border-brand-border"
                                onPress={() => { set('accountId', null); set('accountName', null); setShowAccountPicker(false) }}
                            >
                                <Text className="flex-1 text-brand-muted text-sm">All accounts</Text>
                                {!local.accountId && <Check size={16} color="#5B7BF8" />}
                            </TouchableOpacity>
                            {accounts.map((acc, i) => (
                                <TouchableOpacity
                                    key={acc.id}
                                    className={`flex-row items-center px-4 py-3.5 ${i < accounts.length - 1 ? 'border-b border-brand-border' : ''}`}
                                    onPress={() => { set('accountId', acc.id); set('accountName', acc.name); setShowAccountPicker(false) }}
                                >
                                    <View className="flex-1">
                                        <Text className="text-brand-text text-sm">{acc.name}</Text>
                                        <Text className="text-brand-muted text-xs mt-0.5">{acc.institutionName}</Text>
                                    </View>
                                    {local.accountId === acc.id && <Check size={16} color="#5B7BF8" />}
                                </TouchableOpacity>
                            ))}
                            <View className="h-8" />
                        </ScrollView>
                    </SafeAreaView>
                </Modal>
            </Modal>
        </>
    )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <View className="gap-y-2.5">
            <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest px-1">{label}</Text>
            {children}
        </View>
    )
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    return (
        <TouchableOpacity
            className={`px-4 h-9 rounded-xl border items-center justify-center ${active ? 'bg-brand-accent border-brand-accent' : 'bg-brand-surface border-brand-border'}`}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Text className={`text-sm font-medium ${active ? 'text-white' : 'text-brand-muted'}`}>{label}</Text>
        </TouchableOpacity>
    )
}

function RowOption({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
    return (
        <TouchableOpacity
            className={`flex-row items-center px-4 h-12 rounded-xl border ${active ? 'border-brand-accent bg-brand-accent/10' : 'border-brand-border bg-brand-surface'}`}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <Text className={`flex-1 text-sm ${active ? 'text-brand-accent font-medium' : 'text-brand-text'}`}>{label}</Text>
            {active && <Check size={15} color="#5B7BF8" />}
        </TouchableOpacity>
    )
}
