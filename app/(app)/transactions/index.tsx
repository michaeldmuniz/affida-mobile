import { useState, useMemo } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity, TextInput, ActivityIndicator, Share, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Search, Flag, SlidersHorizontal, Download } from 'lucide-react-native'
import { useInfiniteQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Card } from '@/components/ui/Card'
import { AmountText } from '@/components/ui/AmountText'
import { EditSheet } from '@/components/transactions/EditSheet'
import { FilterSheet, DEFAULT_FILTERS, activeFilterCount, filtersToParams } from '@/components/transactions/FilterSheet'
import type { Transaction, PaginatedResponse } from '@/lib/types'
import type { TransactionFilters } from '@/components/transactions/FilterSheet'

const PAGE_SIZE = 50

export default function TransactionsScreen() {
    const [search, setSearch] = useState('')
    const [editing, setEditing] = useState<Transaction | null>(null)
    const [showFilters, setShowFilters] = useState(false)
    const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_FILTERS)

    const filterCount = activeFilterCount(filters)
    const [isExporting, setIsExporting] = useState(false)

    const handleExport = async () => {
        setIsExporting(true)
        try {
            const params = { ...filtersToParams(filters), search }
            const res = await apiClient.get('/export', { params })
            const csv: string = res.data.data?.csv ?? ''
            await Share.share({ message: csv, title: 'transactions.csv' })
        } catch {
            Alert.alert('Error', 'Failed to export transactions.')
        } finally {
            setIsExporting(false)
        }
    }

    const {
        data,
        isLoading,
        isFetchingNextPage,
        hasNextPage,
        fetchNextPage,
        refetch,
        isRefetching,
    } = useInfiniteQuery<PaginatedResponse<Transaction>>({
        queryKey: ['transactions', search, filters],
        initialPageParam: 1,
        queryFn: async ({ pageParam }) => {
            const params = {
                ...filtersToParams(filters),
                search,
                limit: String(PAGE_SIZE),
                page: String(pageParam),
            }
            const res = await apiClient.get('/transactions', { params })
            return res.data.data
        },
        getNextPageParam: (lastPage) =>
            lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
        retry: 1,
    })

    const transactions = useMemo(
        () => data?.pages.flatMap(p => p.items) ?? [],
        [data]
    )

    const grouped = useMemo(() =>
        transactions.reduce<Record<string, Transaction[]>>((acc, tx) => {
            const key = tx.date.slice(0, 10)
            if (!acc[key]) acc[key] = []
            acc[key].push(tx)
            return acc
        }, {}),
        [transactions]
    )

    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            {/* Header */}
            <View className="px-6 pt-4 pb-3">
                <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-brand-text text-2xl font-bold">Transactions</Text>
                    <View className="flex-row items-center gap-x-2">
                        <TouchableOpacity
                            className="w-9 h-9 rounded-full bg-brand-surface border border-brand-border items-center justify-center"
                            onPress={handleExport}
                            disabled={isExporting}
                        >
                            {isExporting
                                ? <ActivityIndicator size="small" color="#6B7280" />
                                : <Download size={16} color="#6B7280" strokeWidth={1.8} />
                            }
                        </TouchableOpacity>
                        <TouchableOpacity
                            className={`w-9 h-9 rounded-full items-center justify-center border ${filterCount > 0 ? 'bg-brand-accent border-brand-accent' : 'bg-brand-surface border-brand-border'}`}
                            onPress={() => setShowFilters(true)}
                        >
                            {filterCount > 0
                                ? <Text className="text-white text-xs font-bold">{filterCount}</Text>
                                : <SlidersHorizontal size={16} color="#6B7280" strokeWidth={1.8} />
                            }
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Active filter pills */}
                {filterCount > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 -mx-1">
                        <View className="flex-row gap-x-2 px-1">
                            {filters.type !== 'all' && (
                                <FilterPill label={filters.type === 'income' ? 'Income' : 'Expense'} onRemove={() => setFilters(f => ({ ...f, type: 'all' }))} />
                            )}
                            {filters.dateRange !== 'all' && (
                                <FilterPill
                                    label={{ thisMonth: 'This month', lastMonth: 'Last month', '30d': 'Last 30d', '90d': 'Last 90d' }[filters.dateRange] ?? filters.dateRange}
                                    onRemove={() => setFilters(f => ({ ...f, dateRange: 'all' }))}
                                />
                            )}
                            {filters.accountName && (
                                <FilterPill label={filters.accountName} onRemove={() => setFilters(f => ({ ...f, accountId: null, accountName: null }))} />
                            )}
                            {filters.categoryName && (
                                <FilterPill label={filters.categoryName} onRemove={() => setFilters(f => ({ ...f, categoryId: null, categoryName: null }))} />
                            )}
                            {filters.flagged && (
                                <FilterPill label="Flagged" onRemove={() => setFilters(f => ({ ...f, flagged: false }))} />
                            )}
                            {(filters.sort !== 'date' || filters.order !== 'desc') && (
                                <FilterPill
                                    label={filters.sort === 'amount' ? `Amount ${filters.order === 'desc' ? '↓' : '↑'}` : `Date ${filters.order === 'asc' ? '↑' : '↓'}`}
                                    onRemove={() => setFilters(f => ({ ...f, sort: 'date', order: 'desc' }))}
                                />
                            )}
                        </View>
                    </ScrollView>
                )}

                {/* Search */}
                <View className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-3.5 h-11 gap-x-2">
                    <Search size={16} color="#6B7280" strokeWidth={1.8} />
                    <TextInput
                        className="flex-1 text-brand-text text-sm"
                        placeholder="Search transactions..."
                        placeholderTextColor="#6B7280"
                        value={search}
                        onChangeText={setSearch}
                        autoCorrect={false}
                    />
                </View>
            </View>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#5B7BF8" />
                }
            >
                <View className="px-6 gap-y-5 pb-8">
                    {isLoading ? (
                        <TransactionsSkeleton />
                    ) : sortedDates.length > 0 ? (
                        <>
                            {sortedDates.map((date) => (
                                <View key={date}>
                                    <Text className="text-brand-muted text-xs font-medium uppercase tracking-widest mb-2.5 px-1">
                                        {new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
                                            weekday: 'long', month: 'long', day: 'numeric',
                                        })}
                                    </Text>
                                    <Card className="overflow-hidden p-0">
                                        {grouped[date].map((tx, i) => (
                                            <TouchableOpacity
                                                key={tx.id}
                                                className={`flex-row items-center px-4 py-3.5 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                                                activeOpacity={0.7}
                                                onPress={() => setEditing(tx)}
                                            >
                                                <View className="flex-1 pr-3">
                                                    <View className="flex-row items-center gap-x-1.5">
                                                        <Text className="text-brand-text text-sm font-medium flex-shrink" numberOfLines={1}>
                                                            {tx.merchantName ?? tx.description}
                                                        </Text>
                                                        {tx.flagged && (
                                                            <Flag size={11} color="#F87171" fill="#F87171" />
                                                        )}
                                                    </View>
                                                    <Text className="text-brand-muted text-xs mt-0.5" numberOfLines={1}>
                                                        {tx.categoryName ?? 'Uncategorized'} · {tx.accountName}
                                                    </Text>
                                                </View>
                                                <AmountText amount={tx.amount} size="sm" showSign />
                                            </TouchableOpacity>
                                        ))}
                                    </Card>
                                </View>
                            ))}

                            {/* Load more */}
                            {hasNextPage && (
                                <TouchableOpacity
                                    className="h-12 rounded-2xl border border-brand-border bg-brand-surface items-center justify-center"
                                    onPress={() => fetchNextPage()}
                                    disabled={isFetchingNextPage}
                                    activeOpacity={0.7}
                                >
                                    {isFetchingNextPage
                                        ? <ActivityIndicator color="#5B7BF8" size="small" />
                                        : <Text className="text-brand-text text-sm font-medium">Load more</Text>
                                    }
                                </TouchableOpacity>
                            )}

                            {/* End of results indicator */}
                            {!hasNextPage && transactions.length >= PAGE_SIZE && (
                                <Text className="text-brand-muted text-xs text-center pb-2">
                                    All {transactions.length} transactions loaded
                                </Text>
                            )}
                        </>
                    ) : (
                        <EmptyState hasFilters={filterCount > 0 || !!search} onClear={() => { setFilters(DEFAULT_FILTERS); setSearch('') }} />
                    )}
                </View>
            </ScrollView>

            <EditSheet transaction={editing} onClose={() => setEditing(null)} />

            <FilterSheet
                visible={showFilters}
                filters={filters}
                onApply={setFilters}
                onClose={() => setShowFilters(false)}
            />
        </SafeAreaView>
    )
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
    return (
        <TouchableOpacity
            className="flex-row items-center gap-x-1.5 bg-brand-accent/15 border border-brand-accent/30 rounded-full px-3 h-7"
            onPress={onRemove}
            activeOpacity={0.7}
        >
            <Text className="text-brand-accent text-xs font-medium">{label}</Text>
            <Text className="text-brand-accent text-xs">×</Text>
        </TouchableOpacity>
    )
}

function TransactionsSkeleton() {
    return (
        <View className="gap-y-5">
            {[1, 2].map((g) => (
                <View key={g}>
                    <View className="h-2.5 w-24 bg-brand-surface rounded mb-3" />
                    <Card className="gap-y-4 p-4">
                        {[1, 2, 3].map((i) => (
                            <View key={i} className="flex-row items-center justify-between">
                                <View className="gap-y-1.5 flex-1">
                                    <View className="h-3.5 w-32 bg-brand-elevated rounded" />
                                    <View className="h-2.5 w-20 bg-brand-elevated rounded" />
                                </View>
                                <View className="h-3.5 w-14 bg-brand-elevated rounded" />
                            </View>
                        ))}
                    </Card>
                </View>
            ))}
        </View>
    )
}

function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
    return (
        <View className="items-center py-16">
            <View className="w-14 h-14 rounded-2xl bg-brand-surface border border-brand-border items-center justify-center mb-4">
                <Search size={24} color="#6B7280" strokeWidth={1.5} />
            </View>
            <Text className="text-brand-text font-semibold mb-1">No transactions found</Text>
            {hasFilters ? (
                <>
                    <Text className="text-brand-muted text-sm text-center leading-relaxed px-8 mb-4">
                        No transactions match your current filters.
                    </Text>
                    <TouchableOpacity
                        className="px-5 h-9 rounded-xl border border-brand-border bg-brand-surface items-center justify-center"
                        onPress={onClear}
                        activeOpacity={0.7}
                    >
                        <Text className="text-brand-text text-sm font-medium">Clear filters</Text>
                    </TouchableOpacity>
                </>
            ) : (
                <Text className="text-brand-muted text-sm text-center leading-relaxed px-8">
                    Your transactions will appear here once you connect an account.
                </Text>
            )}
        </View>
    )
}
