import { View, ActivityIndicator } from 'react-native'
import { colors } from '@/lib/colors'
import { BrandMark } from '@/components/BrandMark'

export function LoadingScreen() {
    return (
        <View className="flex-1 bg-brand-bg items-center justify-center gap-y-8">
            <BrandMark size={64} />
            <ActivityIndicator size="large" color={colors.accent} />
        </View>
    )
}
