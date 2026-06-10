import { useEffect, useRef, useState } from 'react'
import { Redirect, Tabs } from 'expo-router'
import { View, AppState } from 'react-native'

export { ErrorBoundary } from '@/components/ErrorBoundary'
import { Home, ArrowLeftRight, PieChart, Target, LineChart } from 'lucide-react-native'
import { useAuthStore } from '@/lib/auth-store'
import { useSettingsStore } from '@/lib/settings-store'
import { LockScreen } from '@/components/LockScreen'
import { LoadingScreen } from '@/components/LoadingScreen'
import { haptics } from '@/lib/haptics'

function TabIcon({ Icon, focused }: { Icon: any; focused: boolean }) {
    return (
        <View className={`p-2 rounded-xl ${focused ? 'bg-brand-accent/15' : ''}`}>
            <Icon size={22} color={focused ? '#5B7BF8' : '#6B7280'} strokeWidth={focused ? 2.5 : 1.8} />
        </View>
    )
}

const HIDDEN_SCREEN_OPTIONS = {
    tabBarButton: () => null,
    tabBarItemStyle: { display: 'none' as const, width: 0 },
    tabBarStyle: { display: 'none' as const },
}

export default function AppLayout() {
    const { token } = useAuthStore()
    const { appLockEnabled, _hasHydrated } = useSettingsStore()
    const [locked, setLocked] = useState<boolean | null>(null)
    const appStateRef = useRef(AppState.currentState)

    // Initialize lock state once settings have hydrated
    useEffect(() => {
        if (_hasHydrated && locked === null) {
            setLocked(appLockEnabled)
        }
    }, [_hasHydrated, locked, appLockEnabled])

    // Re-lock when the app goes to background
    useEffect(() => {
        const sub = AppState.addEventListener('change', (next) => {
            if (
                appLockEnabled &&
                appStateRef.current === 'active' &&
                (next === 'background' || next === 'inactive')
            ) {
                setLocked(true)
            }
            appStateRef.current = next
        })
        return () => sub.remove()
    }, [appLockEnabled])

    if (!token) {
        return <Redirect href="/(auth)/login" />
    }

    if (!_hasHydrated || locked === null) {
        return <LoadingScreen />
    }

    if (locked && appLockEnabled) {
        return <LockScreen onUnlock={() => setLocked(false)} />
    }

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: '#09090F',
                    borderTopColor: '#1E1E2A',
                    borderTopWidth: 1,
                    paddingTop: 8,
                    paddingBottom: 4,
                    height: 68,
                },
                tabBarShowLabel: true,
                tabBarLabelStyle: {
                    fontSize: 10,
                    fontWeight: '500',
                    marginTop: 2,
                },
                tabBarActiveTintColor: '#5B7BF8',
                tabBarInactiveTintColor: '#6B7280',
            }}
            screenListeners={{
                tabPress: () => haptics.light(),
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ focused }) => <TabIcon Icon={Home} focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="transactions/index"
                options={{
                    title: 'Transactions',
                    tabBarIcon: ({ focused }) => <TabIcon Icon={ArrowLeftRight} focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="insights"
                options={{
                    title: 'Insights',
                    tabBarIcon: ({ focused }) => <TabIcon Icon={LineChart} focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="budgets"
                options={{
                    title: 'Budgets',
                    tabBarIcon: ({ focused }) => <TabIcon Icon={PieChart} focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="goals"
                options={{
                    title: 'Goals',
                    tabBarIcon: ({ focused }) => <TabIcon Icon={Target} focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="settings"
                options={{
                    title: 'Settings',
                    tabBarIcon: ({ focused }) => <TabIcon Icon={Settings} focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="rules"
                options={{
                    tabBarButton: () => null,
                    tabBarItemStyle: { display: 'none', width: 0 },
                    tabBarStyle: { display: 'none' },
                }}
            />
            <Tabs.Screen
                name="reports"
                options={{
                    tabBarButton: () => null,
                    tabBarItemStyle: { display: 'none', width: 0 },
                    tabBarStyle: { display: 'none' },
                }}
            />
            <Tabs.Screen
                name="accounts/[id]"
                options={{
                    tabBarButton: () => null,
                    tabBarItemStyle: { display: 'none', width: 0 },
                    tabBarStyle: { display: 'none' },
                }}
            />
        </Tabs>
    )
}
