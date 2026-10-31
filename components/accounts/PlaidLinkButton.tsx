import { useState, useCallback, useEffect } from 'react'
import { TouchableOpacity, Text, ActivityIndicator, Alert, Platform } from 'react-native'
import { create, open, destroy, LinkSuccess, LinkExit } from 'react-native-plaid-link-sdk'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { SyncOptionsSheet, computeSyncStartDate } from './SyncOptionsSheet'
import { guessClaimedAccount, type LinkedAccount } from '@/lib/plaid-claim'

type RangeOption = 'auto' | '30d' | '90d' | '180d' | '365d' | 'all'

// The server answers 403 when a bank can't be connected: a trialing user at the bank limit, or
// someone on the free plan. Its message says which. No upgrade action here — billing is managed on the web.
const TRIAL_LIMIT_TITLE = 'Bank connections'
const TRIAL_LIMIT_MESSAGE = 'Free trials can connect up to 3 banks. You can connect more once your trial ends.'
const limitText = (err: any): string => err?.response?.data?.error ?? TRIAL_LIMIT_MESSAGE

// iOS can't present a modal/alert while another native screen is still animating
// out (Plaid Link, the sync sheet, the Add sheet). Overlapping them left the app
// on a dark, unresponsive screen, so each step waits for the previous to finish.
const DISMISS_MS = 600
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

interface Props {
    onSuccess?: () => void
    /** Turn this manual account into the bank account it matches, instead of adding new ones */
    claimAccount?: { id: string; name: string; type: string }
    label?: string
}

export function PlaidLinkButton({ onSuccess, claimAccount, label }: Props) {
    const [linked, setLinked] = useState<LinkedAccount[]>([])
    const queryClient = useQueryClient()
    const [linkToken, setLinkToken] = useState<string | null>(null)
    const [fetching, setFetching] = useState(false)
    const [pendingToken, setPendingToken] = useState<string | null>(null)
    const [institutionName, setInstitutionName] = useState('')
    const [syncRange, setSyncRange] = useState<RangeOption>('180d')
    // The newest entry on the account being connected over (YYYY-MM-DD): null = none, undefined = still being read
    const [newestDay, setNewestDay] = useState<string | null | undefined>(undefined)
    const [exchanging, setExchanging] = useState(false)
    const [limitMessage, setLimitMessage] = useState<string | null>(null)

    const refreshToken = useCallback(async () => {
        setLinkToken(null)
        setLimitMessage(null)
        setFetching(true)
        try {
            await destroy()
            const res = await apiClient.get('/plaid/link-token', { params: { platform: Platform.OS } })
            const token = res.data.data.link_token
            setLinkToken(token)
            create({ token })
        } catch (err: any) {
            const status = err?.response?.status
            const detail = err?.response?.data?.error ?? err?.message ?? 'Unknown error'
            if (status === 403) {
                // Shown when the button is tapped, not on screen open
                setLimitMessage(limitText(err))
                return
            }
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
        if (limitMessage) {
            Alert.alert(TRIAL_LIMIT_TITLE, limitMessage)
            return
        }
        if (!linkToken || fetching) return
        open({
            onSuccess: async (success: LinkSuccess) => {
                // Wait for Plaid Link to finish dismissing before presenting our sheet
                await sleep(DISMISS_MS)
                setInstitutionName(success.metadata.institution?.name ?? 'your bank')
                setPendingToken(success.publicToken)
                setLinked(success.metadata.accounts.map((a: any) => ({ id: a.id, name: a.name, mask: a.mask, type: a.type, subtype: a.subtype })))
                // Connecting over an account that has transactions: nobody has to choose how far back. It starts a week before
                // the account's newest entry (or takes everything the bank has when it has none); the other choices stay in the sheet.
                setSyncRange(claimAccount ? 'auto' : '180d')
                setNewestDay(claimAccount ? undefined : null)
                if (claimAccount) {
                    apiClient.get(`/accounts/${claimAccount.id}/manual-preview`)
                        .then((r) => setNewestDay((r.data.data?.latestDay as string | null) ?? null))
                        .catch(() => setNewestDay(null)) // not read: take the bank's whole history, as before
                }
                refreshToken()
            },
            onExit: async (_exit: LinkExit) => {
                await sleep(DISMISS_MS)
                refreshToken()
            },
        })
    }

    const handleConfirm = async () => {
        if (!pendingToken) return
        setExchanging(true)
        try {
            // Converting a manual account: confirm which bank account it becomes
            let claim: { plaidAccountId: string; accountId: string } | undefined
            const guess = claimAccount ? guessClaimedAccount(claimAccount, linked) : null
            if (claimAccount && guess) {
                const useIt = await new Promise<boolean>(resolve => Alert.alert(
                    `Is ${guess.name}${guess.mask ? ` ••${guess.mask}` : ''} your "${claimAccount.name}"?`,
                    'It keeps its name and every transaction you have; the bank\'s transactions are matched to yours, so nothing is counted twice.',
                    [
                        { text: 'No, add as new', style: 'cancel', onPress: () => resolve(false) },
                        { text: 'Yes', onPress: () => resolve(true) },
                    ],
                    { onDismiss: () => resolve(false) },
                ))
                if (useIt) claim = { plaidAccountId: guess.id, accountId: claimAccount.id }
            }
            await apiClient.post('/plaid/exchange', {
                public_token: pendingToken,
                // The automatic start belongs to the account being connected over (the server gives it to that account only), so the
                // bank's other accounts keep all their history; with no match to connect over there is nothing to start from: everything the bank has
                syncStartDate: syncRange === 'auto' ? undefined : computeSyncStartDate(syncRange, newestDay),
                ...(claim ? { claim: { ...claim, ...(syncRange === 'auto' && computeSyncStartDate('auto', newestDay) ? { syncStartDate: computeSyncStartDate('auto', newestDay) } : {}) } } : {}),
            })
            queryClient.invalidateQueries({ queryKey: ['account-detail'] })
            queryClient.invalidateQueries({ queryKey: ['accounts'] })
            queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            queryClient.invalidateQueries({ queryKey: ['transactions'] })
            // Dismiss the sync sheet, then the Add sheet, then show the alert — one at a time
            setPendingToken(null)
            await sleep(DISMISS_MS)
            onSuccess?.()
            await sleep(DISMISS_MS)
            Alert.alert('Connected!', `Successfully connected ${institutionName}.`)
        } catch (err: any) {
            if (err?.response?.status === 403) {
                setPendingToken(null)
                await sleep(DISMISS_MS)
                Alert.alert(TRIAL_LIMIT_TITLE, limitText(err))
                return
            }
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
                disabled={fetching || (!linkToken && !limitMessage)}
                activeOpacity={0.85}
            >
                {fetching
                    ? <ActivityIndicator color="#fff" />
                    : <Text className="text-white font-semibold text-base">{label ?? 'Connect Bank Account'}</Text>
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
                convertAccount={claimAccount ? { id: claimAccount.id, name: claimAccount.name } : undefined}
                newestDay={newestDay}
            />
        </>
    )
}
