import { View, Text } from 'react-native'
import { kidColor } from '@/lib/colors'

export function KidAvatar({ name, color, size = 44 }: { name: string; color: string | null; size?: number }) {
    return (
        <View
            className="rounded-full items-center justify-center"
            style={{ width: size, height: size, backgroundColor: kidColor(color) }}
        >
            <Text className="text-white font-bold" style={{ fontSize: size * 0.4 }}>
                {name.charAt(0).toUpperCase()}
            </Text>
        </View>
    )
}
