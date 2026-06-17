import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Linking, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { LogOut, User, Shield, CreditCard, ChevronRight, Mail, Smartphone, Zap, FileText, ScrollText, Pencil, X } from 'lucide-react-native'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/lib/auth-store'
import { useSettingsStore } from '@/lib/settings-store'
import { haptics } from '@/lib/haptics'
import { colors } from '@/lib/colors'

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
    actionIcon: ActionIcon,
}: {
    icon: any
    label: string
    value?: string
    onPress?: () => void
    destructive?: boolean
    actionIcon?: any
}) {
    return (
        <TouchableOpacity
            className="flex-row items-center px-4 py-4 bg-brand-surface active:opacity-70"
            onPress={onPress}
            disabled={!onPress}
            activeOpacity={onPress ? 0.7 : 1}
        >
            <View className={`w-8 h-8 rounded-lg items-center justify-center mr-3 ${destructive ? 'bg-brand-negative/15' : 'bg-brand-accent/15'}`}>
                <Icon size={16} color={destructive ? colors.destructive : colors.accent} strokeWidth={2} />
            </View>
            <Text className={`flex-1 text-sm font-medium ${destructive ? 'text-brand-negative' : 'text-brand-text'}`}>
                {label}
            </Text>
            {value && (
                <Text className="text-brand-muted text-sm mr-2">{value}</Text>
            )}
            {ActionIcon && <ActionIcon size={14} color={colors.muted} />}
            {onPress && !destructive && !ActionIcon && (
                <ChevronRight size={16} color={colors.muted} />
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
    const queryClient = useQueryClient()
    const { clearAuth, user: authUser, setAuth, token, expiresAt } = useAuthStore()
    const [showEditName, setShowEditName] = useState(false)
    const [newName, setNewName] = useState('')

    const { mutate: saveName, isPending: isSavingName } = useMutation({
        mutationFn: async (name: string) => {
            const res = await apiClient.patch('/me', { name })
            return res.data.data
        },
        onSuccess: (data) => {
            if (token && authUser && expiresAt) {
                setAuth(token, { ...authUser, name: data.name }, expiresAt)
            }
            queryClient.invalidateQueries({ queryKey: ['profile'] })
            setShowEditName(false)
        },
        onError: () => Alert.alert('Error', 'Failed to update name.'),
    })

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

    const handleToggleAppLock = async (enabled: boolean) => {
        haptics.light()
        if (!enabled) {
            setAppLockEnabled(false)
            return
        }
        // Confirm the user can actually authenticate before locking them in
        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Confirm to enable App Lock',
            })
            if (result.success) {
                haptics.success()
                setAppLockEnabled(true)
            }
        } catch {
            Alert.alert('Unavailable', 'Biometric authentication is not available on this device.')
        }
    }

    const displayEmail = profile?.email ?? authUser?.email ?? ''
    const displayName = profile?.name ?? authUser?.name ?? null

    const subStatus = profile?.subscriptionStatus ?? authUser?.subscriptionStatus ?? 'INACTIVE'
    const isActive = subStatus === 'ACTIVE' || subStatus === 'TRIALING'

    return (
        <SafeAreaView className="flex-1 bg-brand-bg">
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View className="flex-row items-center px-6 pt-4 pb-6 gap-x-2">
                    <TouchableOpacity onPress={() => router.back()} hitSlop={8} className="-ml-2">
                        <ChevronLeft size={24} color={colors.muted} />
                    </TouchableOpacity>
                    <Text className="text-brand-text text-2xl font-bold">Settings</Text>
                </View>

                {/* Avatar + name */}
                <View className="items-center pb-6">
                    <View className="w-20 h-20 rounded-full bg-brand-accent/20 border border-brand-accent/30 items-center justify-center mb-3">
                        {isLoading ? (
                            <ActivityIndicator color={colors.accent} />
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
                        onPress={() => { setNewName(displayName ?? ''); setShowEditName(true) }}
                        actionIcon={Pencil}
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
                    <View className="flex-row items-center px-4 py-3.5 bg-brand-surface">
                        <View className="w-8 h-8 rounded-lg items-center justify-center mr-3 bg-brand-accent/15">
                            <ScanFace size={16} color={colors.accent} strokeWidth={2} />
                        </View>
                        <View className="flex-1">
                            <Text className="text-sm font-medium text-brand-text">App Lock</Text>
                            <Text className="text-brand-muted text-xs mt-0.5">
                                {biometricsAvailable
                                    ? 'Require Face ID when opening the app'
                                    : 'No biometrics enrolled on this device'}
                            </Text>
                        </View>
                        <Switch
                            value={appLockEnabled}
                            onValueChange={handleToggleAppLock}
                            disabled={!biometricsAvailable && !appLockEnabled}
                            trackColor={{ false: colors.disabled, true: colors.accent }}
                            thumbColor="#fff"
                        />
                    </View>
                    <Divider />
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

                {/* Money */}
                <SectionHeader title="Money" />
                <View className="mx-4 rounded-2xl overflow-hidden border border-brand-border">
                    <SettingsRow
                        icon={Repeat}
                        label="Recurring & Subscriptions"
                        onPress={() => router.push('/(app)/subscriptions')}
                    />
                    <Divider />
                    <SettingsRow
                        icon={Zap}
                        label="Categorization Rules"
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

            {/* Edit Name Modal */}
            <Modal visible={showEditName} transparent animationType="fade" onRequestClose={() => setShowEditName(false)}>
                <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <View className="flex-1 bg-black/60 items-center justify-center px-6">
                        <View className="bg-brand-surface border border-brand-border rounded-2xl p-6 w-full">
                            <View className="flex-row items-center justify-between mb-4">
                                <Text className="text-brand-text text-base font-bold">Edit Name</Text>
                                <TouchableOpacity onPress={() => setShowEditName(false)} hitSlop={8}>
                                    <X size={18} color={colors.muted} />
                                </TouchableOpacity>
                            </View>
                            <View className="bg-brand-elevated border border-brand-border rounded-xl px-4 h-12 justify-center mb-4">
                                <TextInput
                                    className="text-brand-text text-base"
                                    value={newName}
                                    onChangeText={setNewName}
                                    placeholder="Your name"
                                    placeholderTextColor={colors.muted}
                                    autoFocus
                                    autoCorrect={false}
                                />
                            </View>
                            <View className="flex-row gap-x-3">
                                <TouchableOpacity
                                    className="flex-1 h-11 rounded-xl border border-brand-border items-center justify-center"
                                    onPress={() => setShowEditName(false)}
                                    activeOpacity={0.7}
                                >
                                    <Text className="text-brand-muted font-medium text-sm">Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    className="flex-1 h-11 rounded-xl bg-brand-accent items-center justify-center"
                                    onPress={() => saveName(newName)}
                                    disabled={isSavingName || !newName.trim()}
                                    activeOpacity={0.85}
                                >
                                    {isSavingName
                                        ? <ActivityIndicator color="#fff" />
                                        : <Text className="text-white font-semibold text-sm">Save</Text>
                                    }
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </SafeAreaView>
    )
}
