import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

export interface ReviewRow { id: string; day: string; description: string; amount: number; categoryName: string | null }
export interface ReviewItem {
    bankId: string
    kind: 'SINGLE' | 'SPLIT'
    accountId: string
    accountName: string
    bank: { day: string; description: string; amount: number }
    rows: ReviewRow[]
    reason: string
    leftover: number
    canMerge: boolean
    willDo: string
    cannotMerge?: string
}
export interface LogEntry { id: string; kind: string; summary: string; createdAt: string; seen: boolean }
export interface PairingReview { items: ReviewItem[]; more: number; log: LogEntry[]; unseen: number }

/**
 * Bank charges that may already be in the list as entries the person typed, and the log of what was combined for
 * them (same data as the website's banner). Nothing changes until `merge` is called for an item.
 */
export function usePairingReview(enabled = true) {
    const queryClient = useQueryClient()
    const { data } = useQuery<PairingReview | null>({
        queryKey: ['pairing-review'],
        enabled,
        staleTime: 60_000,
        queryFn: async () => {
            try { return ((await apiClient.get('/pairing-review')).data.data as PairingReview | null) ?? null } catch { return null } // a banner is never worth an error
        },
    })
    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['pairing-review'] })
        queryClient.invalidateQueries({ queryKey: ['accounts'] })
        queryClient.invalidateQueries({ queryKey: ['transactions'] })
        queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    }
    const merge = useMutation({
        mutationFn: async (item: ReviewItem) => (await apiClient.post('/pairing-review', { action: 'merge', bankId: item.bankId, rowIds: item.rows.map((r) => r.id) })).data.data as { summary: string },
        onSettled: refresh,
    })
    const separate = useMutation({
        mutationFn: async (bankId: string) => (await apiClient.post('/pairing-review', { action: 'dismiss', bankId })).data.data,
        onSettled: refresh,
    })
    const markSeen = useMutation({
        mutationFn: async () => (await apiClient.post('/pairing-review', { action: 'seen' })).data.data,
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['pairing-review'] }),
    })
    return { review: data ?? null, merge, separate, markSeen }
}
