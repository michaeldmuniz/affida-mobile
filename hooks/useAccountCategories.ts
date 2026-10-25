import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Category } from '@/lib/types'

interface AccountCategories {
    ownerName: string | null
    mine: boolean
    canCreate: boolean
    categories: Category[]
}

/**
 * The categories a transaction on this account can use. A transaction always carries a
 * category from the account owner's own list (that is what their budgets count), so on a
 * shared account you get the owner's list, not yours. `createCategory` adds to the owner's
 * list and only exists when the owner gave you edit access; otherwise it is undefined.
 */
export function useAccountCategories(accountId: string | null | undefined, enabled = true) {
    const queryClient = useQueryClient()

    const own = useQuery<Category[]>({
        queryKey: ['categories'],
        queryFn: async () => (await apiClient.get('/categories')).data.data,
        enabled,
        staleTime: 10 * 60 * 1000,
    })
    const forAccount = useQuery<AccountCategories>({
        queryKey: ['categories', 'account', accountId],
        queryFn: async () => (await apiClient.get(`/accounts/${accountId}/categories`)).data.data,
        enabled: enabled && !!accountId,
        staleTime: 5 * 60 * 1000,
    })

    // While the owner's list loads, show nothing rather than the wrong person's categories
    const categories = forAccount.data?.categories ?? (accountId ? [] : own.data ?? [])
    const ownerName = forAccount.data?.ownerName ?? null
    const canCreate = !!forAccount.data && !forAccount.data.mine && forAccount.data.canCreate

    const createCategory = canCreate
        ? async (name: string): Promise<Category> => {
            const res = await apiClient.post('/categories', { name: name.trim(), group: 'EXPENSE', accountId })
            await queryClient.invalidateQueries({ queryKey: ['categories', 'account', accountId] })
            return res.data.data as Category
        }
        : undefined

    return { categories, ownerName, createCategory }
}
