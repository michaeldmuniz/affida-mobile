import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'

export type AssetGapKind = 'home' | 'vehicle'
export interface AssetGap { kind: AssetGapKind; title: string; detail: string; button: string; choice: 'ASSET_HOME' | 'ASSET_VEHICLE' }

/**
 * "Your home is missing from your net worth": a mortgage with no home listed, an auto loan with no vehicle listed. The
 * server decides what to show (Not now hides a card for 30 days; a second Not now stops it until a new loan; Don't ask
 * again is final), same rules as the website. An empty list = nothing to ask.
 */
export function useAssetPrompt() {
    const queryClient = useQueryClient()
    const { data } = useQuery<AssetGap[]>({
        queryKey: ['asset-prompt'],
        staleTime: 60_000,
        queryFn: async () => {
            try { return ((await apiClient.get('/asset-prompt')).data.data as AssetGap[] | null) ?? [] } catch { return [] } // a card is never worth an error
        },
    })
    const answer = useMutation({
        mutationFn: async (v: { kind: AssetGapKind; answer: 'later' | 'never' }) => { await apiClient.post('/asset-prompt', v) },
        onMutate: async (v) => {
            await queryClient.cancelQueries({ queryKey: ['asset-prompt'] })
            queryClient.setQueryData<AssetGap[]>(['asset-prompt'], (old) => (old ?? []).filter((g) => g.kind !== v.kind))
        },
        onSettled: () => queryClient.invalidateQueries({ queryKey: ['asset-prompt'] }),
    })
    return { gaps: data ?? [], answer }
}
