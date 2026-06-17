import { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, Image } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as LocalAuthentication from 'expo-local-authentication'
import { ScanFace } from 'lucide-react-native'
import { colors } from '@/lib/colors'

interface Props {
    onUnlock: () => void
}

export function LockScreen({ onUnlock }: Props) {
    const [failed, setFailed] = useState(false)

    const attempt = useCallback(async () => {
        setFailed(false)
        try {
            const result = await LocalAuthentication.authenticateAsync({
                promptMessage: 'Unlock Affida',
                cancelLabel: 'Cancel',
            })
            if (result.success) {
                onUnlock()
            } else {
                setFailed(true)
            }
        } catch {
            setFailed(true)
        }
    }, [onUnlock])

    useEffect(() => {
        attempt()
    }, [attempt])

    return (
        <SafeAreaView className="flex-1 bg-brand-bg items-center justify-center px-8">
            <View className="items-center">
                <View className="w-16 h-16 rounded-3xl bg-brand-accent/15 items-center justify-center mb-5">
                    <ScanFace size={30} color={colors.accent} strokeWidth={1.8} />
                </View>
                <Text className="text-brand-text text-xl font-bold mb-1.5">Affida is locked</Text>
                <Text className="text-brand-muted text-sm text-center leading-relaxed mb-8">
                    Unlock with Face ID or your device passcode to continue.
                </Text>
                <TouchableOpacity
                    className="bg-brand-accent px-8 py-3.5 rounded-xl"
                    onPress={attempt}
                    activeOpacity={0.85}
                >
                    <Text className="text-white font-semibold text-sm">
                        {failed ? 'Try Again' : 'Unlock'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    )
}
