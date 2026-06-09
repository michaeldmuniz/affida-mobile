import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft, Repeat, CalendarClock } from 'lucide-react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { apiClient } from '@/lib/api-client'
import { Card } from '@/components/ui/Card'
import { AmountText } from '@/components/ui/AmountText'
import { haptics } from '@/lib/haptics'
import type { SubscriptionsResponse, SubscriptionItem } from '@/lib/types'

function formatDay(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysUntil(dateStr: string) {
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (diff <= 0) return 'Due now'
    if (diff === 1) return 'Tomorrow'
    if (diff <= 7) return `In ${diff} days`
    return formatDay(dateStr)
}

export default function SubscriptionsScreen() {
    const router = useRouter()
    const queryClient = useQueryClient()

    const { data, isLoading, refetch, isRefetching } = useQuery<SubscriptionsResponse>({
        queryKey: ['subscriptions'],
        queryFn: async () => (await apiClient.get('/subscriptions')).data.data,
    })

    const { mutate: markStatus } = useMutation({
        mutationFn: async ({ merchantName, status }: { merchantName: string; status: string }) => {
            await apiClient.patch('/subscriptions', { merchantName, status })
        },
        onMutate: async ({ merchantName }) => {
            await queryClient.cancelQueries({ queryKey: ['subscriptions'] })
            const prev = queryClient.getQueryData<SubscriptionsResponse>(['subscriptions'])
            queryClient.setQueryData<SubscriptionsResponse>(['subscriptions'], (old) =>
                old
                    ? {
                          ...old,
                          items: old.items.filter((i) => i.merchantName !== merchantName),
                          monthlyTotal:
                              old.monthlyTotal -
                              (old.items.find((i) => i.merchantName === merchantName)?.amount ?? 0),
                      }
                    : old
            )
            return { prev }
        },
        onError: (_e, _v, ctx) => {
            queryClient.setQueryData(['subscriptions'], ctx?.prev)
            Alert.alert('Error', 'Failed to update subscription.')
        },
    })

    const handlePress = (item: SubscriptionItem) => {
        haptics.light()
        Alert.alert(item.merchantName, `$${item.amount.toFixed(2)} · ${item.frequency}`, [
            { text: 'Close', style: 'cancel' },
            {
                text: 'Mark as cancelled',
                onPress: () => {
                    haptics.success()
                    markStatus({ merchantName: item.merchantName, status: 'CANCELLED' })
                },
            },
            {
                text: 'Not a subscription',
                style: 'destructive',
                onPress: () => {
                    haptics.light()
                    markStatus({ merchantName: item.merchantName, status: 'IGNORED' })
                },
            },
        ])
    }

    const sorted = [...(data?.items ?? [])].sort(
        (a, b) => new Date(a.nextDate).getTime() - new Date(b.nextDate).getTime()
    )

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            {/* Header */}
            <View className="flex-row items-center px-4 pt-4 pb-3">
                <TouchableOpacity onPress={() => router.back()} hitSlop={8} className="w-8">
                    <ChevronLeft size={22} color="#6B7280" />
                </TouchableOpacity>
                <Text className="flex-1 text-center text-brand-text text-lg font-bold">Recurring</Text>
                <View className="w-8" />
            </View>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#5B7BF8" />
                }
            >
                <View className="px-6 gap-y-4 pb-10 pt-2">
                    {/* Monthly total */}
                    <Card className="p-6">
                        <Text className="text-brand-muted text-xs font-medium uppercase tracking-widest mb-3">
                            Estimated Monthly Cost
                        </Text>
                        {data ? (
                            <>
                                <AmountText amount={-(data.monthlyTotal)} size="xl" />
                                <Text className="text-brand-muted text-xs mt-2">
                                    {data.items.length} active subscription{data.items.length === 1 ? '' : 's'} detected from your transactions
                                </Text>
                            </>
                        ) : (
                            <View className="h-10 w-40 bg-brand-elevated rounded-lg" />
                        )}
                    </Card>

                    {/* Upcoming list */}
                    {isLoading ? (
                        <View className="items-center py-16">
                            <ActivityIndicator color="#5B7BF8" />
                        </View>
                    ) : sorted.length > 0 ? (
                        <View>
                            <Text className="text-brand-text font-semibold text-base mb-3">Upcoming</Text>
                            <Card className="overflow-hidden p-0">
                                {sorted.map((item, i) => (
                                    <TouchableOpacity
                                        key={item.merchantName}
                                        onPress={() => handlePress(item)}
                                        activeOpacity={0.7}
                                        className={`flex-row items-center px-4 py-4 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                                    >
                                        <View className="w-9 h-9 rounded-xl bg-brand-accent/15 items-center justify-center mr-3.5">
                                            <CalendarClock size={16} color="#5B7BF8" strokeWidth={2} />
                                        </View>
                                        <View className="flex-1 pr-3">
                                            <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>
                                                {item.merchantName}
                                            </Text>
                                            <Text className="text-brand-muted text-xs mt-0.5">
                                                {daysUntil(item.nextDate)} · {item.frequency}
                                                {item.confidence === 'Medium' ? ' · Possible' : ''}
                                            </Text>
                                        </View>
                                        <AmountText amount={-item.amount} size="sm" />
                                    </TouchableOpacity>
                                ))}
                            </Card>
                            <Text className="text-brand-muted text-xs text-center mt-3 px-4 leading-relaxed">
                                Tap a subscription to mark it cancelled or remove it from this list.
                            </Text>
                        </View>
                    ) : (
                        <EmptyState />
                    )}
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

function EmptyState() {
    return (
        <View className="items-center py-16">
            <View className="w-14 h-14 rounded-2xl bg-brand-surface border border-brand-border items-center justify-center mb-4">
                <Repeat size={24} color="#6B7280" strokeWidth={1.5} />
            </View>
            <Text className="text-brand-text font-semibold mb-1">No recurring charges found</Text>
            <Text className="text-brand-muted text-sm text-center leading-relaxed px-8">
                Once we see the same charge repeat monthly, it will show up here automatically.
            </Text>
        </View>
    )
}
