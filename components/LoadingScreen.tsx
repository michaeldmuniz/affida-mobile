import { View, Image, ActivityIndicator } from 'react-native'

export function LoadingScreen() {
    return (
        <View className="flex-1 bg-brand-bg items-center justify-center gap-y-8">
            <Image
                source={require('../assets/logo.png')}
                style={{ width: 160, height: 80 }}
                resizeMode="contain"
            />
            <ActivityIndicator size="large" color="#5B7BF8" />
        </View>
    )
}
