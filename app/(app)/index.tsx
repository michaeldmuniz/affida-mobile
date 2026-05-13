import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { TrendingUp, TrendingDown } from 'lucide-react-native'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/lib/auth-store'
import { Card } from '@/components/ui/Card'
import { AmountText } from '@/components/ui/AmountText'
import type { DashboardStats } from '@/lib/types'

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function currentMonthLabel() {
    return new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export default function DashboardScreen() {
    const { user } = useAuthStore()

    const { data, isLoading, refetch, isRefetching } = useQuery<DashboardStats>({
        queryKey: ['dashboard'],
        queryFn: async () => {
            const res = await apiClient.get('/dashboard')
            return res.data.data
        },
        retry: 1,
    })

    const firstName = user?.name?.split(' ')[0] ?? 'there'

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefetching}
                        onRefresh={refetch}
                        tintColor="#5B7BF8"
                    />
                }
            >
                {/* Header */}
                <View className="flex-row items-center justify-between px-6 pt-4 pb-6">
                    <View>
                        <Text className="text-brand-muted text-sm">{currentMonthLabel()}</Text>
                        <Text className="text-brand-text text-2xl font-bold mt-0.5">
                            Hi, {firstName}
                        </Text>
                    </View>
                </View>

                <View className="px-6 gap-y-4 pb-8">
                    {/* Net Worth Card */}
                    <Card className="p-6">
                        <Text className="text-brand-muted text-xs font-medium uppercase tracking-widest mb-3">
                            Net Worth
                        </Text>
                        {data ? (
                            <>
                                <AmountText
                                    amount={data.netWorth}
                                    size="xl"
                                    neutral
                                    className="text-brand-text"
                                />
                                <View className="flex-row gap-x-6 mt-4">
                                    <View>
                                        <Text className="text-brand-muted text-xs mb-1">Assets</Text>
                                        <AmountText amount={data.totalAssets} size="sm" neutral className="text-brand-positive" />
                                    </View>
                                    <View>
                                        <Text className="text-brand-muted text-xs mb-1">Liabilities</Text>
                                        <AmountText amount={-data.totalLiabilities} size="sm" />
                                    </View>
                                </View>
                            </>
                        ) : (
                            <NetWorthPlaceholder />
                        )}
                    </Card>

                    {/* Cash Flow */}
                    <View className="flex-row gap-x-3">
                        <Card className="flex-1 p-4">
                            <View className="flex-row items-center gap-x-2 mb-2">
                                <TrendingUp size={14} color="#34D399" strokeWidth={2} />
                                <Text className="text-brand-muted text-xs uppercase tracking-widest">Income</Text>
                            </View>
                            {data
                                ? <AmountText amount={data.monthlyIncome} size="md" neutral className="text-brand-positive" />
                                : <PlaceholderLine width="w-20" />
                            }
                        </Card>
                        <Card className="flex-1 p-4">
                            <View className="flex-row items-center gap-x-2 mb-2">
                                <TrendingDown size={14} color="#F87171" strokeWidth={2} />
                                <Text className="text-brand-muted text-xs uppercase tracking-widest">Expenses</Text>
                            </View>
                            {data
                                ? <AmountText amount={-data.monthlyExpenses} size="md" />
                                : <PlaceholderLine width="w-20" />
                            }
                        </Card>
                    </View>

                    {/* Recent Transactions */}
                    <View>
                        <Text className="text-brand-text font-semibold text-base mb-3">
                            Recent Activity
                        </Text>
                        {data?.recentTransactions?.length ? (
                            <Card className="divide-y divide-brand-border overflow-hidden">
                                {data.recentTransactions.map((tx, i) => (
                                    <View key={tx.id} className={`flex-row items-center justify-between py-3.5 ${i > 0 ? 'border-t border-brand-border' : ''}`}>
                                        <View className="flex-1 pr-3">
                                            <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>
                                                {tx.merchantName ?? tx.description}
                                            </Text>
                                            <Text className="text-brand-muted text-xs mt-0.5">
                                                {tx.categoryName ?? 'Uncategorized'} · {formatDate(tx.date)}
                                            </Text>
                                        </View>
                                        <AmountText
                                            amount={tx.amount}
                                            size="sm"
                                            showSign
                                        />
                                    </View>
                                ))}
                            </Card>
                        ) : (
                            <RecentTransactionsPlaceholder />
                        )}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

function PlaceholderLine({ width }: { width: string }) {
    return <View className={`h-4 ${width} bg-brand-elevated rounded-md`} />
}

function NetWorthPlaceholder() {
    return (
        <View className="gap-y-3">
            <View className="h-9 w-44 bg-brand-elevated rounded-lg" />
            <View className="flex-row gap-x-6 mt-1">
                <View className="gap-y-1.5">
                    <View className="h-2.5 w-10 bg-brand-elevated rounded" />
                    <View className="h-4 w-20 bg-brand-elevated rounded" />
                </View>
                <View className="gap-y-1.5">
                    <View className="h-2.5 w-16 bg-brand-elevated rounded" />
                    <View className="h-4 w-20 bg-brand-elevated rounded" />
                </View>
            </View>
        </View>
    )
}

function RecentTransactionsPlaceholder() {
    return (
        <Card>
            <View className="gap-y-4">
                {[1, 2, 3].map((i) => (
                    <View key={i} className="flex-row items-center justify-between">
                        <View className="gap-y-1.5 flex-1">
                            <View className="h-3.5 w-32 bg-brand-elevated rounded" />
                            <View className="h-2.5 w-20 bg-brand-elevated rounded" />
                        </View>
                        <View className="h-3.5 w-16 bg-brand-elevated rounded" />
                    </View>
                ))}
            </View>
        </Card>
    )
}
