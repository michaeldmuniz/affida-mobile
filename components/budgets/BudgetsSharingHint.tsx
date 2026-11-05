import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { Users, X } from 'lucide-react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { colors } from '@/lib/colors'
import { haptics } from '@/lib/haptics'

interface Intros {
    budgetsCategories: boolean
    budgetsSharing?: boolean
    budgetsSharingLinkId?: string | null
    budgetsSharingName?: string | null
}

/**
 * For someone who sees a partner's accounts but whose budgets count only their own spending (the same note as the
 * website's Budgets page, and dismissing it in one hides it in the other). Explains why a budget can show $0 spent while
 * the partner's purchases are on Home, and offers the switch that follows the shared budget with both people's spending.
 */
export function BudgetsSharingHint() {
    const queryClient = useQueryClient()
    const { data } = useQuery<Intros>({
        queryKey: ['intros'],
        queryFn: async () => (await apiClient.get('/intros')).data.data,
        staleTime: 5 * 60 * 1000,
    })
    const { mutate: dismiss } = useMutation({
        mutationFn: async () => { await apiClient.post('/intros', { key: 'budgetsSharing' }) },
        onMutate: () => { queryClient.setQueryData(['intros'], (old: Intros | undefined) => (old ? { ...old, budgetsSharing: false } : old)) },
    })
    const { mutate: turnOn, isPending } = useMutation({
        mutationFn: async () => { await apiClient.post(`/sharing/${data!.budgetsSharingLinkId}`, { action: 'budgets', shared: true }) },
        onSuccess: () => {
            haptics.success?.()
            queryClient.invalidateQueries({ queryKey: ['intros'] })
            queryClient.invalidateQueries({ queryKey: ['budgets'] })
        },
        onError: (e: any) => Alert.alert('Could not turn on budget sharing', e?.response?.data?.error ?? 'Please try again.'),
    })
    if (!data?.budgetsSharing || !data.budgetsSharingLinkId) return null
    const name = data.budgetsSharingName || 'your partner'

    return (
        <View className="mx-6 mt-3 mb-1 rounded-2xl border border-brand-accent/30 bg-brand-accent/10 p-4 pr-10" accessibilityRole="summary">
            <TouchableOpacity
                onPress={() => { haptics.light(); dismiss() }}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Dismiss"
                className="absolute right-3 top-3"
            >
                <X size={16} color={colors.muted} />
            </TouchableOpacity>
            <View className="flex-row gap-x-3">
                <Users size={18} color={colors.accent} style={{ marginTop: 2 }} />
                <View className="flex-1">
                    <Text className="text-brand-text text-sm font-semibold">These budgets only count your own accounts</Text>
                    <Text className="text-brand-muted text-xs mt-1 leading-4">
                        {name}'s accounts show up on Home and in Transactions, but they are not counted here. Turn on budget sharing to follow the budget with both of your spending.
                    </Text>
                    <View className="flex-row items-center gap-x-4 mt-3">
                        <TouchableOpacity
                            onPress={() => { haptics.light(); turnOn() }}
                            disabled={isPending}
                            accessibilityRole="button"
                            className="rounded-lg bg-brand-accent px-3 py-2"
                        >
                            {isPending
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text className="text-white text-xs font-semibold">Turn on budget sharing</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { haptics.light(); dismiss() }} accessibilityRole="button">
                            <Text className="text-brand-muted text-xs font-medium">Not now</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    )
}
