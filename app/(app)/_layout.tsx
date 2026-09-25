import { useEffect, useRef, useState } from 'react'
import { Redirect, Tabs } from 'expo-router'
import { View, AppState } from 'react-native'
import * as LocalAuthentication from 'expo-local-authentication'

export { ErrorBoundary } from '@/components/ErrorBoundary'
import { Home, ArrowLeftRight, PieChart, Target, LineChart } from 'lucide-react-native'
import { useAuthStore } from '@/lib/auth-store'
import { useSettingsStore } from '@/lib/settings-store'
import { LockScreen } from '@/components/LockScreen'
import { LoadingScreen } from '@/components/LoadingScreen'
import { haptics } from '@/lib/haptics'
import { colors } from '@/lib/colors'
import { syncOnOpen } from '@/lib/sync'

function TabIcon({ Icon, focused }: { Icon: any; focused: boolean }) {
    return (
        <View className={`p-2 rounded-xl ${focused ? 'bg-brand-accent/15' : ''}`}>
            <Icon size={22} color={focused ? colors.accent : colors.muted} strokeWidth={focused ? 2.5 : 1.8} />
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
    const { appLockEnabled, appLockDefaultApplied, setAppLockEnabled, setAppLockDefaultApplied, _hasHydrated } =
        useSettingsStore()
    const [locked, setLocked] = useState<boolean | null>(null)
    const appStateRef = useRef(AppState.currentState)

    // Initialize lock state once settings have hydrated
    useEffect(() => {
        if (_hasHydrated && locked === null) {
            setLocked(appLockEnabled)
        }
    }, [_hasHydrated, locked, appLockEnabled])

    // One-time default: turn App Lock on automatically if the device already has
    // Face ID / Touch ID enrolled (which guarantees a passcode fallback exists too,
    // since iOS requires one to enroll biometrics in the first place).
    useEffect(() => {
        if (!_hasHydrated || appLockDefaultApplied) return
        LocalAuthentication.isEnrolledAsync()
            .then((enrolled) => {
                if (enrolled) setAppLockEnabled(true)
            })
            .finally(() => setAppLockDefaultApplied(true))
    }, [_hasHydrated, appLockDefaultApplied, setAppLockEnabled, setAppLockDefaultApplied])

    // Keep bank data current: check on launch and whenever the app comes back.
    useEffect(() => {
        if (!token) return
        syncOnOpen()
        const sub = AppState.addEventListener('change', (next) => {
            if (next === 'active') syncOnOpen()
        })
        return () => sub.remove()
    }, [token])

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
                    backgroundColor: colors.bg,
                    borderTopColor: colors.border,
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
                tabBarActiveTintColor: colors.accent,
                tabBarInactiveTintColor: colors.muted,
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
                options={HIDDEN_SCREEN_OPTIONS}
            />
            <Tabs.Screen
                name="assistant"
                options={HIDDEN_SCREEN_OPTIONS}
            />
            <Tabs.Screen
                name="subscriptions"
                options={HIDDEN_SCREEN_OPTIONS}
            />
            <Tabs.Screen
                name="accounts/index"
                options={HIDDEN_SCREEN_OPTIONS}
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
                name="family/index"
                options={HIDDEN_SCREEN_OPTIONS}
            />
            <Tabs.Screen
                name="family/[id]"
                options={HIDDEN_SCREEN_OPTIONS}
            />
            <Tabs.Screen
                name="receipts"
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
