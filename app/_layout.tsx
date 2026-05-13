import { Stack } from 'expo-router'
import { QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import '../global.css'
import { queryClient } from '@/lib/query-client'
import { useAuthStore } from '@/lib/auth-store'
import { LoadingScreen } from '@/components/LoadingScreen'

export default function RootLayout() {
    const { _hasHydrated } = useAuthStore()

    if (!_hasHydrated) {
        return <LoadingScreen />
    }

    return (
        <GestureHandlerRootView className="flex-1">
            <QueryClientProvider client={queryClient}>
                <StatusBar style="light" />
                <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
            </QueryClientProvider>
        </GestureHandlerRootView>
    )
}
