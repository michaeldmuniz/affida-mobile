import { useState } from 'react'
import { Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Check, Users } from 'lucide-react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { colors } from '@/lib/colors'

interface ScopeOption {
    token: string
    label: string
    kind: 'me' | 'shared'
    role: 'VIEWER' | 'EDITOR' | null
    accountCount: number
}
interface ScopeData { options: ScopeOption[]; selection: string[] }

/** Shared by the Accounts header chip and its sheet: same data as the website's header dropdown. */
export function useScope() {
    return useQuery<ScopeData>({
        queryKey: ['scope'],
        queryFn: async () => (await apiClient.get('/scope')).data.data,
        staleTime: 60 * 1000,
    })
}

/** Short text for the chip: "Personal", "Business", "Personal + 1 more"... */
export function scopeSummary(scope: ScopeData | undefined) {
    if (!scope) return 'Personal'
    const names = scope.options.filter(o => scope.selection.includes(o.token)).map(o => o.label)
    if (names.length === 0) return 'Personal'
    return names.length === 1 ? names[0] : `${names[0]} + ${names.length - 1} more`
}

/**
 * Multi-select of whose accounts to look at: my Personal / Business and each connected person's
 * shared Personal / Business. The same choice the website's header dropdown saves.
 */
export function ScopeSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
    const queryClient = useQueryClient()
    const { data: scope, isLoading } = useScope()
    const [error, setError] = useState<string | null>(null)

    const { mutate: save, isPending } = useMutation({
        mutationFn: async (selection: string[]) => (await apiClient.put('/scope', { selection })).data.data as ScopeData,
        onSuccess: (data) => {
            setError(null)
            queryClient.setQueryData(['scope'], data)
            // Everything on screen depends on the choice
            queryClient.invalidateQueries({ predicate: q => q.queryKey[0] !== 'scope' })
        },
        onError: () => setError('Could not save that choice. Please try again.'),
    })

    const toggle = (token: string) => {
        if (!scope) return
        const on = scope.selection.includes(token)
        const next = on ? scope.selection.filter(t => t !== token) : [...scope.selection, token]
        if (next.length === 0) return // always keep at least one
        save(next)
    }

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView className="flex-1 bg-brand-bg">
                <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                    <Text className="flex-1 text-brand-text text-lg font-semibold">Show accounts</Text>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8}>
                        <X size={20} color={colors.muted} />
                    </TouchableOpacity>
                </View>
                <ScrollView className="flex-1">
                    {isLoading && <ActivityIndicator className="mt-8" color={colors.accent} />}
                    {scope?.options.map((o, i) => {
                        const on = scope.selection.includes(o.token)
                        return (
                            <TouchableOpacity
                                key={o.token}
                                className={`flex-row items-center px-4 py-3.5 ${i < scope.options.length - 1 ? 'border-b border-brand-border' : ''}`}
                                onPress={() => toggle(o.token)}
                                disabled={isPending}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: on }}
                            >
                                <View className="flex-1">
                                    <View className="flex-row items-center gap-x-2">
                                        {o.kind === 'shared' && <Users size={14} color={colors.muted} />}
                                        <Text className="text-brand-text text-sm">{o.label}</Text>
                                    </View>
                                    <Text className="text-brand-muted text-xs mt-0.5">
                                        {o.accountCount} account{o.accountCount === 1 ? '' : 's'}{o.role ? ` · ${o.role === 'EDITOR' ? 'can edit' : 'view only'}` : ''}
                                    </Text>
                                </View>
                                {on && <Check size={16} color={colors.accent} />}
                            </TouchableOpacity>
                        )
                    })}
                    {error && <Text className="text-brand-negative text-xs px-4 pt-3">{error}</Text>}
                    <Text className="text-brand-muted text-xs px-4 py-4">
                        Accounts, transactions, budgets and reports show whatever is ticked here. Move an account to Business from its own screen.
                    </Text>
                </ScrollView>
            </SafeAreaView>
        </Modal>
    )
}
