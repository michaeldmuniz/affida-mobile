import { Stack } from 'expo-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import '../global.css'
import { queryClient } from '@/lib/query-client'
import { useAuthStore } from '@/lib/auth-store'
import { LoadingScreen } from '@/components/LoadingScreen'
import { OfflineBanner } from '@/components/OfflineBanner'

export { ErrorBoundary } from '@/components/ErrorBoundary'

export default function RootLayout() {
    const { _hasHydrated } = useAuthStore()

    if (!_hasHydrated) {
        return <LoadingScreen />
    }

    return (
        <GestureHandlerRootView className="flex-1">
            <SafeAreaProvider>
                <QueryClientProvider client={queryClient}>
                    <StatusBar style="light" />
                    <OfflineBanner />
                    <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
                </QueryClientProvider>
            </SafeAreaProvider>
        </GestureHandlerRootView>
    )
}
