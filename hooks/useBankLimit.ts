import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

export interface BankChoice { id: string; institutionName: string | null; accounts: number; linkedAt: string }
export interface BankLimit { limit: number; graceEndsAt: string | null; banks: BankChoice[]; keepByDefault: string[] }

/**
 * Lite includes a few banks; someone who moved down from Pro with more is asked to choose which to keep before a
 * deadline. null = nothing to choose (not on Lite, within the limit, or the server switch is off). Same data as the
 * website's banner. `keep` disconnects the banks that were not chosen (their accounts and history stay).
 */
export function useBankLimit(enabled = true) {
    const queryClient = useQueryClient()
    const { data } = useQuery<BankLimit | null>({
        queryKey: ['bank-limit'],
        enabled,
        staleTime: 60_000,
        queryFn: async () => {
            try { return ((await apiClient.get('/bank-limit')).data.data as BankLimit | null) ?? null } catch { return null } // a banner is never worth an error
        },
    })
    const keep = useMutation({
        mutationFn: async (keepIds: string[]) => (await apiClient.post('/bank-limit', { keepIds })).data.data as { kept: number; disconnected: number },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['bank-limit'] })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
        },
    })
    return { limit: data ?? null, keep }
}
