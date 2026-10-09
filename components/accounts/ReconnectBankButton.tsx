import { useCallback, useEffect, useState } from 'react'
import { TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native'
import { create, open, destroy, LinkSuccess } from 'react-native-plaid-link-sdk'
import { useQueryClient } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react-native'
import { apiClient } from '@/lib/api-client'
import { colors } from '@/lib/colors'

interface Props {
    /** The bank connection to repair (account.reconnectItemId) */
    plaidItemId: string
}

type Prepared = { token: string; mode: 'update' | 'fresh' }

/**
 * Repairs a bank whose login broke — the same flow as the web Reconnect button.
 * Plaid Link runs in update mode on the existing connection; if Plaid no longer
 * knows it, a fresh link for that bank that the server re-attaches to the same
 * accounts and history.
 */
export function ReconnectBankButton({ plaidItemId }: Props) {
    const queryClient = useQueryClient()
    const [prepared, setPrepared] = useState<Prepared | null>(null)
    const [loading, setLoading] = useState(false)
    const [finishing, setFinishing] = useState(false)

    const prepare = useCallback(async (): Promise<Prepared | string> => {
        setLoading(true)
        try {
            await destroy()
            const res = await apiClient.get('/plaid/link-token', { params: { reconnectItemId: plaidItemId } })
            const next: Prepared = { token: res.data.data.link_token, mode: res.data.data.mode === 'update' ? 'update' : 'fresh' }
            create({ token: next.token })
            setPrepared(next)
            return next
        } catch (err: any) {
            setPrepared(null)
            return err?.response?.data?.error ?? 'Check your connection and try again.'
        } finally {
            setLoading(false)
        }
    }, [plaidItemId])

    useEffect(() => { prepare() }, [prepare])

    const finish = async (success: LinkSuccess, mode: Prepared['mode']) => {
        setFinishing(true)
        try {
            if (mode === 'update') {
                await apiClient.post('/plaid/reconnected', { plaidItemId })
            } else {
                await apiClient.post('/plaid/exchange', { public_token: success.publicToken })
            }
            for (const key of ['accounts', 'account-detail', 'dashboard', 'transactions']) {
                queryClient.invalidateQueries({ queryKey: [key] })
            }
            Alert.alert('Reconnected', 'Your bank is connected again. New transactions will sync shortly.')
        } catch (err: any) {
            Alert.alert('Reconnect failed', err?.response?.data?.error ?? 'Please try again.')
        } finally {
            setFinishing(false)
            prepare()
        }
    }

    const handlePress = async () => {
        // Never a dead button: if it couldn't be prepared, try again and say why
        let ready: Prepared | string | null = prepared
        if (!ready) {
            ready = await prepare()
            if (typeof ready === 'string') {
                Alert.alert("Couldn't start the reconnection", ready)
                return
            }
        }
        const mode = ready.mode
        open({
            onSuccess: (success: LinkSuccess) => { finish(success, mode) },
            onExit: () => { prepare() },
        })
    }

    const busy = loading || finishing
    return (
        <TouchableOpacity
            className="flex-row items-center gap-x-2 mt-4 self-start bg-brand-elevated border border-brand-negative rounded-xl px-4 h-9"
            onPress={handlePress}
            disabled={busy}
            activeOpacity={0.85}
        >
            {busy
                ? <ActivityIndicator size="small" color={colors.negative} />
                : <RefreshCw size={14} color={colors.negative} />}
            <Text className="text-brand-negative text-sm font-semibold">{finishing ? 'Syncing…' : 'Reconnect'}</Text>
        </TouchableOpacity>
    )
}
