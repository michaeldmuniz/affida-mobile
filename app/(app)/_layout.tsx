import { Redirect, Tabs } from 'expo-router'
import { View } from 'react-native'

export { ErrorBoundary } from '@/components/ErrorBoundary'
import { Home, CreditCard, ArrowLeftRight, PieChart, Target, Settings } from 'lucide-react-native'
import { useAuthStore } from '@/lib/auth-store'

function TabIcon({ Icon, focused }: { Icon: any; focused: boolean }) {
    return (
        <View className={`p-2 rounded-xl ${focused ? 'bg-brand-accent/15' : ''}`}>
            <Icon size={22} color={focused ? '#5B7BF8' : '#6B7280'} strokeWidth={focused ? 2.5 : 1.8} />
        </View>
    )
}

export default function AppLayout() {
    const { token } = useAuthStore()

    if (!token) {
        return <Redirect href="/(auth)/login" />
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
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Home',
                    tabBarIcon: ({ focused }) => <TabIcon Icon={Home} focused={focused} />,
                }}
            />
            <Tabs.Screen
                name="accounts/index"
                options={{
                    title: 'Accounts',
                    tabBarIcon: ({ focused }) => <TabIcon Icon={CreditCard} focused={focused} />,
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
