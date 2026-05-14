import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { LogOut, User, Shield, CreditCard, ChevronRight, Mail, Smartphone, Zap, FileText, ScrollText } from 'lucide-react-native'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/lib/auth-store'

interface UserProfile {
    id: string
    email: string
    name: string | null
    twoFactorEnabled: boolean
    mfaMethod: string
    createdAt: string
    subscriptionStatus: string
    subscriptionEnds: string | null
}

function getInitials(name: string | null, email: string) {
    if (name) {
        const parts = name.trim().split(' ')
        return parts.length >= 2
            ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
            : parts[0].slice(0, 2).toUpperCase()
    }
    return email.slice(0, 2).toUpperCase()
}

function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function SettingsRow({
    icon: Icon,
    label,
    value,
    onPress,
    destructive = false,
}: {
    icon: any
    label: string
    value?: string
    onPress?: () => void
    destructive?: boolean
}) {
    return (
        <TouchableOpacity
            className="flex-row items-center px-4 py-4 bg-brand-surface active:opacity-70"
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={onPress ? 0.7 : 1}
        >
            <View className={`w-8 h-8 rounded-lg items-center justify-center mr-3 ${destructive ? 'bg-brand-negative/15' : 'bg-brand-accent/15'}`}>
                <Icon size={16} color={destructive ? '#EF4444' : '#5B7BF8'} strokeWidth={2} />
            </View>
            <Text className={`flex-1 text-sm font-medium ${destructive ? 'text-brand-negative' : 'text-brand-text'}`}>
                {label}
            </Text>
            {value && (
                <Text className="text-brand-muted text-sm mr-2">{value}</Text>
            )}
            {onPress && !destructive && (
                <ChevronRight size={16} color="#6B7280" />
            )}
        </TouchableOpacity>
    )
}

function SectionHeader({ title }: { title: string }) {
    return (
        <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest px-4 pt-6 pb-2">
            {title}
        </Text>
    )
}

function Divider() {
    return <View className="h-px bg-brand-border ml-14" />
}

export default function SettingsScreen() {
    const router = useRouter()
    const { clearAuth, user: authUser } = useAuthStore()

    const { data: profile, isLoading } = useQuery<UserProfile>({
        queryKey: ['profile'],
        queryFn: async () => {
            const res = await apiClient.get('/me')
            return res.data.data
        },
    })

    const handleSignOut = () => {
        Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign Out', style: 'destructive', onPress: clearAuth },
        ])
    }

    const displayEmail = profile?.email ?? authUser?.email ?? ''
    const displayName = profile?.name ?? authUser?.name ?? null

    const subStatus = profile?.subscriptionStatus ?? authUser?.subscriptionStatus ?? 'INACTIVE'
    const isActive = subStatus === 'ACTIVE' || subStatus === 'TRIALING'

    return (
        <SafeAreaView className="flex-1 bg-brand-bg">
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View className="px-6 pt-4 pb-6">
                    <Text className="text-brand-text text-2xl font-bold">Settings</Text>
                </View>

                {/* Avatar + name */}
                <View className="items-center pb-6">
                    <View className="w-20 h-20 rounded-full bg-brand-accent/20 border border-brand-accent/30 items-center justify-center mb-3">
                        {isLoading ? (
                            <ActivityIndicator color="#5B7BF8" />
                        ) : (
                            <Text className="text-brand-accent text-2xl font-bold">
                                {getInitials(displayName, displayEmail)}
                            </Text>
                        )}
                    </View>
                    <Text className="text-brand-text text-lg font-semibold">
                        {displayName ?? 'No name set'}
                    </Text>
                    <Text className="text-brand-muted text-sm mt-0.5">{displayEmail}</Text>
                </View>

                {/* Account */}
                <SectionHeader title="Account" />
                <View className="mx-4 rounded-2xl overflow-hidden border border-brand-border">
                    <SettingsRow
                        icon={User}
                        label="Name"
                        value={displayName ?? '—'}
                    />
                    <Divider />
                    <SettingsRow
                        icon={Mail}
                        label="Email"
                        value={displayEmail}
                    />
                </View>

                {/* Subscription */}
                <SectionHeader title="Subscription" />
                <View className="mx-4 rounded-2xl overflow-hidden border border-brand-border">
                    <SettingsRow
                        icon={CreditCard}
                        label="Plan"
                        value={isActive ? (subStatus === 'TRIALING' ? 'Trial' : 'Active') : 'Inactive'}
                    />
                    {profile?.subscriptionEnds && (
                        <>
                            <Divider />
                            <SettingsRow
                                icon={CreditCard}
                                label={isActive ? 'Renews' : 'Expired'}
                                value={formatDate(profile.subscriptionEnds)}
                            />
                        </>
                    )}
                </View>

                {/* Security */}
                <SectionHeader title="Security" />
                <View className="mx-4 rounded-2xl overflow-hidden border border-brand-border">
                    <SettingsRow
                        icon={Shield}
                        label="Two-Factor Auth"
                        value={profile?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                    />
                    {profile?.twoFactorEnabled && (
                        <>
                            <Divider />
                            <SettingsRow
                                icon={profile?.mfaMethod === 'EMAIL' ? Mail : Smartphone}
                                label="MFA Method"
                                value={profile?.mfaMethod === 'EMAIL' ? 'Email code' : 'Authenticator app'}
                            />
                        </>
                    )}
                </View>

                {/* Automation */}
                <SectionHeader title="Automation" />
                <View className="mx-4 rounded-2xl overflow-hidden border border-brand-border">
                    <SettingsRow
                        icon={Zap}
                        label="Categorization Rules"
                        value={undefined}
                        onPress={() => router.push('/(app)/rules')}
                    />
                </View>

                {/* Legal */}
                <SectionHeader title="Legal" />
                <View className="mx-4 rounded-2xl overflow-hidden border border-brand-border">
                    <SettingsRow
                        icon={FileText}
                        label="Privacy Policy"
                        onPress={() => Linking.openURL('https://affida.money/privacy')}
                    />
                    <Divider />
                    <SettingsRow
                        icon={ScrollText}
                        label="Terms of Service"
                        onPress={() => Linking.openURL('https://affida.money/terms')}
                    />
                </View>

                {/* Sign out */}
                <SectionHeader title="Session" />
                <View className="mx-4 rounded-2xl overflow-hidden border border-brand-negative/20">
                    <SettingsRow
                        icon={LogOut}
                        label="Sign Out"
                        onPress={handleSignOut}
                        destructive
                    />
                </View>

                <View className="h-8" />
            </ScrollView>
        </SafeAreaView>
    )
}
