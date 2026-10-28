import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

export type AiKind = 'chat' | 'receipt' | 'categorize'
export interface AiUsageItem { kind: AiKind; used: number; limit: number | null; remaining: number | null }
export interface AiUsage { plan: 'FREE' | 'LITE' | 'PRO'; resetsAt: string; items: AiUsageItem[] }

/** This month's AI allowance (same numbers as the web usage meter). `refresh` after something uses one. */
export function useAiUsage(enabled = true) {
    const queryClient = useQueryClient()
    const { data } = useQuery<AiUsage | null>({
        queryKey: ['ai-usage'],
        enabled,
        staleTime: 30_000,
        queryFn: async () => {
            try {
                const res = await apiClient.get('/ai-usage')
                return (res.data.data as AiUsage) ?? null
            } catch {
                return null // a meter is never worth an error
            }
        },
    })
    return { usage: data ?? null, refresh: () => queryClient.invalidateQueries({ queryKey: ['ai-usage'] }) }
}

/** "3 messages left this month", or null for an unlimited plan / not loaded. */
export function aiLeftText(usage: AiUsage | null, kind: AiKind, noun: string): { text: string; low: boolean } | null {
    const item = usage?.items.find(i => i.kind === kind)
    if (!item || item.remaining === null || item.limit === null) return null
    const low = item.remaining <= Math.max(1, Math.floor(item.limit * 0.2))
    return { text: item.remaining === 0 ? `No ${noun} left this month` : `${item.remaining.toLocaleString()} ${noun} left this month`, low }
}
