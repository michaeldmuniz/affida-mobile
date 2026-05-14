import { useState, useRef } from 'react'
import {
    View,
    Text,
    Image,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    ActivityIndicator,
    Alert,
    Linking,
} from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Eye, EyeOff } from 'lucide-react-native'
import axios from 'axios'
import { authApi } from '@/lib/api-client'
import { useAuthStore } from '@/lib/auth-store'
import type { AuthTokenResponse, MobileUser } from '@/lib/types'

export default function LoginScreen() {
    const router = useRouter()
    const { setAuth } = useAuthStore()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const passwordRef = useRef<TextInput>(null)

    const handleLogin = async () => {
        if (!email.trim() || !password) {
            setError('Please enter your email and password.')
            return
        }

        setError(null)
        setLoading(true)

        try {
            const res = await authApi.login(email.trim().toLowerCase(), password)
            const { data, error: apiError } = res.data as { data: AuthTokenResponse | null; error: string | null }

            if (apiError === 'MFA_REQUIRED') {
                router.push({
                    pathname: '/(auth)/mfa',
                    params: { email: email.trim().toLowerCase(), password, mfaType: 'totp' },
                })
                return
            }

            if (apiError === 'MFA_EMAIL_REQUIRED') {
                await authApi.sendEmailMfa(email.trim().toLowerCase())
                router.push({
                    pathname: '/(auth)/mfa',
                    params: { email: email.trim().toLowerCase(), password, mfaType: 'email' },
                })
                return
            }

            if (!data) {
                setError('Invalid email or password.')
                return
            }

            setAuth(data.token, data.user as MobileUser, data.expiresAt)
        } catch (err) {
            if (axios.isAxiosError(err) && err.response) {
                const apiError = err.response.data?.error
                if (apiError === 'MFA_REQUIRED') {
                    router.push({
                        pathname: '/(auth)/mfa',
                        params: { email: email.trim().toLowerCase(), password, mfaType: 'totp' },
                    })
                    return
                }
                if (apiError === 'MFA_EMAIL_REQUIRED') {
                    try {
                        await authApi.sendEmailMfa(email.trim().toLowerCase())
                    } catch {
                        // fire-and-forget — proceed to MFA screen regardless
                    }
                    router.push({
                        pathname: '/(auth)/mfa',
                        params: { email: email.trim().toLowerCase(), password, mfaType: 'email' },
                    })
                    return
                }
                if (err.response.status === 401) {
                    setError('Invalid email or password.')
                } else {
                    setError('Something went wrong. Please try again.')
                }
            } else {
                setError('Unable to connect. Please try again.')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <SafeAreaView className="flex-1 bg-brand-bg">
            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    {/* Logo */}
                    <View className="flex-1 justify-center px-6 pt-16 pb-8">
                        <View className="mb-12">
                            <Image
                                source={require('../../assets/logo.png')}
                                style={{ width: 160, height: 80 }}
                                resizeMode="contain"
                            />
                        </View>

                        {/* Form */}
                        <View className="gap-y-3">
                            <View>
                                <Text className="text-brand-muted text-xs font-medium uppercase tracking-widest mb-2">
                                    Email
                                </Text>
                                <TextInput
                                    className="bg-brand-surface border border-brand-border rounded-2xl px-4 h-14 text-brand-text text-base"
                                    placeholder="you@example.com"
                                    placeholderTextColor="#6B7280"
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    returnKeyType="next"
                                    onSubmitEditing={() => passwordRef.current?.focus()}
                                    autoComplete="email"
                                />
                            </View>

                            <View>
                                <Text className="text-brand-muted text-xs font-medium uppercase tracking-widest mb-2">
                                    Password
                                </Text>
                                <View className="relative">
                                    <TextInput
                                        ref={passwordRef}
                                        className="bg-brand-surface border border-brand-border rounded-2xl px-4 pr-14 h-14 text-brand-text text-base"
                                        placeholder="••••••••"
                                        placeholderTextColor="#6B7280"
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={!showPassword}
                                        returnKeyType="go"
                                        onSubmitEditing={handleLogin}
                                        autoComplete="current-password"
                                    />
                                    <TouchableOpacity
                                        className="absolute right-4 top-0 bottom-0 justify-center"
                                        onPress={() => setShowPassword((v) => !v)}
                                        hitSlop={8}
                                    >
                                        {showPassword
                                            ? <EyeOff size={20} color="#6B7280" />
                                            : <Eye size={20} color="#6B7280" />
                                        }
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {error && (
                                <View className="bg-brand-negative/10 border border-brand-negative/20 rounded-xl px-4 py-3">
                                    <Text className="text-brand-negative text-sm">{error}</Text>
                                </View>
                            )}

                            <TouchableOpacity
                                className={`rounded-2xl h-14 items-center justify-center mt-2 ${loading ? 'bg-brand-accent/50' : 'bg-brand-accent'}`}
                                onPress={handleLogin}
                                disabled={loading}
                                activeOpacity={0.85}
                            >
                                {loading
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text className="text-white font-semibold text-base">Sign In</Text>
                                }
                            </TouchableOpacity>
                        </View>

                        <Text className="text-brand-muted text-xs text-center mt-8 leading-relaxed">
                            Don't have an account? Sign up at{'\n'}affida.money
                        </Text>

                        <View className="flex-row justify-center gap-x-4 mt-4">
                            <TouchableOpacity onPress={() => Linking.openURL('https://affida.money/privacy')}>
                                <Text className="text-brand-muted text-xs underline">Privacy Policy</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => Linking.openURL('https://affida.money/terms')}>
                                <Text className="text-brand-muted text-xs underline">Terms of Service</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    )
}
