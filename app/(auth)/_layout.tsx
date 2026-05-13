import { Redirect, Stack } from 'expo-router'
import { useAuthStore } from '@/lib/auth-store'

export default function AuthLayout() {
    const { token } = useAuthStore()

    if (token) {
        return <Redirect href="/(app)" />
    }

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#09090F' },
                animation: 'slide_from_right',
            }}
        />
    )
}
