import { useState, useCallback, useEffect } from 'react'
import { TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native'
import { create, open, destroy, LinkSuccess, LinkExit } from 'react-native-plaid-link-sdk'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { SyncOptionsSheet, computeSyncStartDate } from './SyncOptionsSheet'

type RangeOption = '30d' | '90d' | '180d' | '365d' | 'all'

interface Props {
    onSuccess?: () => void
}

export function PlaidLinkButton({ onSuccess }: Props) {
    const queryClient = useQueryClient()
    const [linkToken, setLinkToken] = useState<string | null>(null)
    const [fetching, setFetching] = useState(false)
    const [pendingToken, setPendingToken] = useState<string | null>(null)
    const [institutionName, setInstitutionName] = useState('')
    const [syncRange, setSyncRange] = useState<RangeOption>('180d')
    const [exchanging, setExchanging] = useState(false)

    const refreshToken = useCallback(async () => {
        setLinkToken(null)
        setFetching(true)
        try {
            await destroy()
            const res = await apiClient.get('/plaid/link-token')
            const token = res.data.data.link_token
            setLinkToken(token)
            create({ token })
        } catch (err: any) {
            const status = err?.response?.status
            const detail = err?.response?.data?.error ?? err?.message ?? 'Unknown error'
            console.error('[Plaid] link-token error', { status, detail })
            Alert.alert('Error', `Unable to start bank connection. (${status ?? 'network'}: ${detail})`)
        } finally {
            setFetching(false)
        }
    }, [])

    useEffect(() => {
        refreshToken()
    }, [refreshToken])

    const handlePress = () => {
        if (!linkToken || fetching) return
        open({
            onSuccess: (success: LinkSuccess) => {
                setInstitutionName(success.metadata.institution?.name ?? 'your bank')
                setPendingToken(success.publicToken)
                setSyncRange('180d')
                refreshToken()
            },
            onExit: (_exit: LinkExit) => {
                refreshToken()
            },
        })
    }

    const handleConfirm = async () => {
        if (!pendingToken) return
        setExchanging(true)
        try {
            await apiClient.post('/plaid/exchange', {
                public_token: pendingToken,
                syncStartDate: computeSyncStartDate(syncRange),
            })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            setPendingToken(null)
            onSuccess?.()
            Alert.alert('Connected!', `Successfully connected ${institutionName}.`)
        } catch {
            Alert.alert('Error', 'Failed to connect bank account. Please try again.')
        } finally {
            setExchanging(false)
        }
    }

    const handleCancel = () => {
        setPendingToken(null)
    }

    return (
        <>
            <TouchableOpacity
                className="h-14 rounded-2xl bg-brand-accent items-center justify-center"
                onPress={handlePress}
                disabled={fetching || !linkToken}
                activeOpacity={0.85}
            >
                {fetching
                    ? <ActivityIndicator color="#fff" />
                    : <Text className="text-white font-semibold text-base">Connect Bank Account</Text>
                }
            </TouchableOpacity>
            <SyncOptionsSheet
                visible={!!pendingToken}
                institutionName={institutionName}
                selected={syncRange}
                onSelect={setSyncRange}
                onConfirm={handleConfirm}
                onCancel={handleCancel}
                isLoading={exchanging}
            />
        </>
    )
}
