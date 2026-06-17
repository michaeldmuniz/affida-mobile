import { Redirect, Stack } from 'expo-router'
import { useAuthStore } from '@/lib/auth-store'
import { colors } from '@/lib/colors'

export default function AuthLayout() {
    const { token } = useAuthStore()

    if (token) {
        return <Redirect href="/(app)" />
    }

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.bg },
                animation: 'slide_from_right',
            }}
        />
    )
}
