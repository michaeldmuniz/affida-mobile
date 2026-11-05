import { View, Text, TouchableOpacity } from 'react-native'
import { Tag, X } from 'lucide-react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { colors } from '@/lib/colors'
import { haptics } from '@/lib/haptics'

/**
 * Shown once on a person's first visit to Budgets (the same note as the website, and dismissing it in one hides it in
 * the other). Explains the three kinds of category, since a budget is set only for Expense ones. Closing it means "seen".
 */
export function CategoriesIntro() {
    const queryClient = useQueryClient()
    const { data } = useQuery<{ budgetsCategories: boolean; budgetsSharing?: boolean }>({
        queryKey: ['intros'],
        queryFn: async () => (await apiClient.get('/intros')).data.data,
        staleTime: 5 * 60 * 1000,
    })
    const { mutate: dismiss } = useMutation({
        mutationFn: async () => { await apiClient.post('/intros', { key: 'budgetsCategories' }) },
        onMutate: () => { queryClient.setQueryData(['intros'], (old: object | undefined) => ({ ...old, budgetsCategories: false })) },
    })
    if (!data?.budgetsCategories) return null

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
                <Tag size={18} color={colors.accent} style={{ marginTop: 2 }} />
                <View className="flex-1">
                    <Text className="text-brand-text text-sm font-semibold">A budget is set for each Expense category</Text>
                    <Text className="text-brand-muted text-xs mt-1 leading-4">
                        Every category is an Expense, an Income or a Transfer, and that decides what counts as spending. Expense is what you spend (what budgets track), Income is money coming in, and Transfer is money moving between your own accounts.
                    </Text>
                    <TouchableOpacity onPress={() => { haptics.light(); dismiss() }} className="mt-2 self-start" accessibilityRole="button">
                        <Text className="text-brand-accent text-xs font-medium">Got it</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    )
}
