import { View, Text, Switch, Alert } from 'react-native'
import { Users } from 'lucide-react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { colors } from '@/lib/colors'
import { haptics } from '@/lib/haptics'

interface Connection {
    linkId: string
    budgetsShared: boolean
    partner: { name: string | null; email: string }
}

const firstName = (c: Connection) => c.partner.name?.split(' ')[0] || c.partner.email.split('@')[0]

/**
 * "Share budgets" per connection: the same setting as the website's Settings → Budgets and Sharing tab. On, the person
 * follows the shared budget (the inviter's) with both people's spending; off, budgets count only their own accounts.
 * Renders nothing when they are not connected to anyone.
 */
export function BudgetSharingRows({ renderRow }: { renderRow?: (row: React.ReactNode, key: string) => React.ReactNode }) {
    const queryClient = useQueryClient()
    const { data } = useQuery<{ connections: Connection[] }>({
        queryKey: ['sharing'],
        queryFn: async () => (await apiClient.get('/sharing')).data.data,
        staleTime: 60 * 1000,
    })
    const { mutate: setShared, variables, isPending } = useMutation({
        mutationFn: async (v: { linkId: string; shared: boolean }) => { await apiClient.post(`/sharing/${v.linkId}`, { action: 'budgets', shared: v.shared }) },
        onSuccess: () => {
            haptics.success()
            for (const key of ['sharing', 'budgets', 'intros']) queryClient.invalidateQueries({ queryKey: [key] })
        },
        onError: (e: any) => Alert.alert('Could not change budget sharing', e?.response?.data?.error ?? 'Please try again.'),
    })
    const connections = data?.connections ?? []
    if (connections.length === 0) return null

    return (
        <>
            {connections.map((c) => {
                const on = isPending && variables?.linkId === c.linkId ? variables.shared : c.budgetsShared
                const row = (
                    <View className="flex-row items-center px-4 py-4 bg-brand-surface" testID={`budget-sharing-${c.linkId}`}>
                        <View className="w-8 h-8 rounded-lg items-center justify-center mr-3 bg-brand-accent/15">
                            <Users size={16} color={colors.accent} strokeWidth={2} />
                        </View>
                        <View className="flex-1 mr-3">
                            <Text className="text-brand-text text-sm font-medium">Share budgets with {firstName(c)}</Text>
                            <Text className="text-brand-muted text-xs mt-0.5 leading-4">
                                {on ? 'Budgets count both of your spending.' : 'Budgets count only your own accounts.'}
                            </Text>
                        </View>
                        <Switch
                            value={on}
                            disabled={isPending}
                            onValueChange={(v) => { haptics.light(); setShared({ linkId: c.linkId, shared: v }) }}
                            accessibilityLabel={`Share budgets with ${firstName(c)}`}
                        />
                    </View>
                )
                return renderRow ? renderRow(row, c.linkId) : <View key={c.linkId}>{row}</View>
            })}
        </>
    )
}
