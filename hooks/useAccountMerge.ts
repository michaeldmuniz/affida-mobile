import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

export interface MergeSuggestion {
    manual: { id: string; name: string; type: string; balance: number; entries: number }
    synced: { id: string; name: string; type: string; balance: number; mask: string | null; institutionName: string; entries: number }
    confidence: 'high' | 'likely'
    reasons: string[]
    effects: string[]
}

/**
 * Accounts the person typed that the bank also made a copy of (a bank connected from the Add button), the same
 * suggestions as the website's banner. Nothing changes until `merge` is called for a pair the person confirmed.
 */
export function useAccountMerge(enabled = true) {
    const queryClient = useQueryClient()
    const { data } = useQuery<MergeSuggestion[]>({
        queryKey: ['account-merge'],
        enabled,
        staleTime: 60_000,
        queryFn: async () => {
            try { return ((await apiClient.get('/account-merge')).data.data?.suggestions as MergeSuggestion[] | undefined) ?? [] } catch { return [] } // a banner is never worth an error
        },
    })
    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['account-merge'] })
        queryClient.invalidateQueries({ queryKey: ['accounts'] })
        queryClient.invalidateQueries({ queryKey: ['transactions'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    }
    const merge = useMutation({
        mutationFn: async (s: MergeSuggestion) => (await apiClient.post('/account-merge', { action: 'merge', manualId: s.manual.id, syncedId: s.synced.id })).data.data as { paired: number; moved: number; keptSeparate: number },
        onSettled: refresh,
    })
    const separate = useMutation({
        mutationFn: async (s: MergeSuggestion) => (await apiClient.post('/account-merge', { action: 'dismiss', manualId: s.manual.id, syncedId: s.synced.id })).data.data,
        onSettled: refresh,
    })
    return { suggestions: data ?? [], merge, separate }
}
