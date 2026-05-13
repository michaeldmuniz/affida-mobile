import { useState, useRef } from 'react'
import { TouchableOpacity, Text, ActivityIndicator, Alert, Modal, View } from 'react-native'
import { WebView, WebViewNavigation } from 'react-native-webview'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { SyncOptionsSheet, computeSyncStartDate } from './SyncOptionsSheet'

type RangeOption = '30d' | '90d' | '180d' | '365d' | 'all'

interface Props {
    onSuccess?: () => void
}

// Injected after the Plaid-hosted page loads — wires up onSuccess/onExit callbacks
const buildInjectedJS = (token: string) => `
(function() {
    if (window.__plaidHandlerReady) return;
    window.__plaidHandlerReady = true;
    var handler = Plaid.create({
        token: '${token}',
        onSuccess: function(publicToken, metadata) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
                action: 'plaidSuccess',
                publicToken: publicToken,
                institutionName: metadata.institution ? metadata.institution.name : 'your bank',
            }));
        },
        onExit: function() {
            window.ReactNativeWebView.postMessage(JSON.stringify({ action: 'plaidExit' }));
        },
    });
    handler.open();
})();
true;
`

export function PlaidLinkButton({ onSuccess }: Props) {
    const queryClient = useQueryClient()
    const [linkToken, setLinkToken] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [pendingToken, setPendingToken] = useState<string | null>(null)
    const [institutionName, setInstitutionName] = useState('')
    const [syncRange, setSyncRange] = useState<RangeOption>('180d')
    const [exchanging, setExchanging] = useState(false)
    const webViewRef = useRef<WebView>(null)

    const fetchLinkToken = async () => {
        setLoading(true)
        try {
            const res = await apiClient.get('/plaid/link-token')
            setLinkToken(res.data.data.link_token)
        } catch {
            Alert.alert('Error', 'Unable to start bank connection. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleWebViewMessage = (event: { nativeEvent: { data: string } }) => {
        try {
            const msg = JSON.parse(event.nativeEvent.data)
            if (msg.action === 'plaidSuccess') {
                setInstitutionName(msg.institutionName ?? 'your bank')
                setPendingToken(msg.publicToken)
                setLinkToken(null)
                setSyncRange('180d')
            } else if (msg.action === 'plaidExit') {
                setLinkToken(null)
            }
        } catch { /* ignore non-JSON messages */ }
    }

    const handleLoadEnd = () => {
        if (linkToken) {
            webViewRef.current?.injectJavaScript(buildInjectedJS(linkToken))
        }
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
                onPress={fetchLinkToken}
                disabled={loading}
                activeOpacity={0.85}
            >
                {loading
                    ? <ActivityIndicator color="#fff" />
                    : <Text className="text-white font-semibold text-base">Connect Bank Account</Text>
                }
            </TouchableOpacity>

            <Modal visible={!!linkToken} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setLinkToken(null)}>
                <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                    <View className="flex-row items-center justify-between px-4 py-3 border-b border-brand-border">
                        <Text className="text-brand-text font-semibold text-base">Connect Bank Account</Text>
                        <TouchableOpacity onPress={() => setLinkToken(null)}>
                            <Text className="text-brand-muted text-sm">Cancel</Text>
                        </TouchableOpacity>
                    </View>
                    <WebView
                        ref={webViewRef}
                        source={{ uri: 'https://cdn.plaid.com/link/v2/stable/link.html' }}
                        onLoadEnd={handleLoadEnd}
                        onMessage={handleWebViewMessage}
                        javaScriptEnabled
                        domStorageEnabled
                        originWhitelist={['*']}
                        startInLoadingState
                        renderLoading={() => (
                            <View className="flex-1 items-center justify-center bg-brand-bg">
                                <ActivityIndicator color="#5B7BF8" />
                            </View>
                        )}
                        style={{ flex: 1, backgroundColor: '#111827' }}
                    />
                </SafeAreaView>
            </Modal>

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
