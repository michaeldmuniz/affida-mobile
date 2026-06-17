import { useState, useRef, useEffect } from 'react'
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ArrowLeft } from 'lucide-react-native'
import { authApi } from '@/lib/api-client'
import { useAuthStore } from '@/lib/auth-store'
import type { AuthTokenResponse, MobileUser } from '@/lib/types'
import { colors } from '@/lib/colors'

const CODE_LENGTH = 6

export default function MfaScreen() {
    const router = useRouter()
    const { setAuth } = useAuthStore()
    const { email, password, mfaType } = useLocalSearchParams<{
        email: string
        password: string
        mfaType: 'totp' | 'email'
    }>()

    const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''))
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [resending, setResending] = useState(false)
    const [resendCooldown, setResendCooldown] = useState(0)

    const refs = useRef<Array<TextInput | null>>(Array(CODE_LENGTH).fill(null))

    useEffect(() => {
        setTimeout(() => refs.current[0]?.focus(), 300)
    }, [])

    useEffect(() => {
        if (resendCooldown <= 0) return
        const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
        return () => clearTimeout(t)
    }, [resendCooldown])

    const handleDigit = (text: string, index: number) => {
        const clean = text.replace(/\D/g, '').slice(-1)
        const next = [...digits]
        next[index] = clean
        setDigits(next)
        setError(null)

        if (clean && index < CODE_LENGTH - 1) {
            refs.current[index + 1]?.focus()
        }

        if (clean && index === CODE_LENGTH - 1) {
            const code = [...next.slice(0, index), clean].join('')
            if (code.length === CODE_LENGTH) {
                handleVerify(code)
            }
        }
    }

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
            refs.current[index - 1]?.focus()
        }
    }

    const handleVerify = async (code?: string) => {
        const totpCode = code ?? digits.join('')
        if (totpCode.length < CODE_LENGTH) {
            setError('Please enter the full 6-digit code.')
            return
        }

        setError(null)
        setLoading(true)

        try {
            const mfaVia = mfaType === 'email' ? 'email' : undefined
            const res = await authApi.login(email, password, totpCode, mfaVia)
            const { data, error: apiError } = res.data as { data: AuthTokenResponse | null; error: string | null }

            if (apiError === 'MFA_INVALID') {
                setError('Incorrect code. Please try again.')
                setDigits(Array(CODE_LENGTH).fill(''))
                setTimeout(() => refs.current[0]?.focus(), 100)
                return
            }

            if (!data) {
                setError('Verification failed. Please try again.')
                return
            }

            setAuth(data.token, data.user as MobileUser, data.expiresAt)
        } catch {
            setError('Unable to connect. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleResend = async () => {
        if (resendCooldown > 0 || mfaType !== 'email') return
        setResending(true)
        try {
            await authApi.sendEmailMfa(email)
            setResendCooldown(60)
        } finally {
            setResending(false)
        }
    }

    const isTotp = mfaType === 'totp'

    return (
        <SafeAreaView className="flex-1 bg-brand-bg">
            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <View className="flex-1 px-6 pt-4">
                    {/* Back */}
                    <TouchableOpacity
                        className="flex-row items-center gap-x-1 mb-10 self-start"
                        onPress={() => router.back()}
                        hitSlop={8}
                    >
                        <ArrowLeft size={20} color={colors.muted} />
                        <Text className="text-brand-muted text-sm">Back</Text>
                    </TouchableOpacity>

                    {/* Heading */}
                    <Text className="text-brand-text text-3xl font-bold mb-2">
                        Verify Identity
                    </Text>
                    <Text className="text-brand-muted text-base leading-relaxed mb-10">
                        {isTotp
                            ? 'Enter the 6-digit code from your authenticator app.'
                            : `Enter the code sent to ${email}.`
                        }
                    </Text>

                    {/* Digit boxes */}
                    <View className="flex-row justify-between mb-8">
                        {digits.map((digit, i) => (
                            <TextInput
                                key={i}
                                ref={(r) => { refs.current[i] = r }}
                                className={`w-12 h-14 rounded-xl border text-center text-xl font-semibold text-brand-text bg-brand-surface ${
                                    digit ? 'border-brand-accent' : 'border-brand-border'
                                }`}
                                value={digit}
                                onChangeText={(t) => handleDigit(t, i)}
                                onKeyPress={(e) => handleKeyPress(e, i)}
                                keyboardType="number-pad"
                                maxLength={1}
                                selectTextOnFocus
                            />
                        ))}
                    </View>

                    {error && (
                        <View className="bg-brand-negative/10 border border-brand-negative/20 rounded-xl px-4 py-3 mb-4">
                            <Text className="text-brand-negative text-sm">{error}</Text>
                        </View>
                    )}

                    <TouchableOpacity
                        className={`rounded-2xl h-14 items-center justify-center ${loading ? 'bg-brand-accent/50' : 'bg-brand-accent'}`}
                        onPress={() => handleVerify()}
                        disabled={loading}
                        activeOpacity={0.85}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text className="text-white font-semibold text-base">Verify</Text>
                        }
                    </TouchableOpacity>

                    {!isTotp && (
                        <TouchableOpacity
                            className="mt-6 items-center"
                            onPress={handleResend}
                            disabled={resending || resendCooldown > 0}
                        >
                            <Text className="text-brand-muted text-sm">
                                Didn't receive a code?{' '}
                                <Text className={resendCooldown > 0 ? 'text-brand-muted' : 'text-brand-accent'}>
                                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
                                </Text>
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    )
}
