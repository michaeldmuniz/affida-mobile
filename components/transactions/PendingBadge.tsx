import { View, Text } from 'react-native'

/** "Not posted yet" pill — same as the web's Pending badge (amber). Pending charges are
 * left out of budget and report totals until they post. */
export function PendingBadge() {
    return (
        <View className="rounded-full px-1.5 py-0.5" style={{ backgroundColor: 'rgba(245,158,11,0.15)' }}>
            <Text className="text-[10px] font-medium" style={{ color: '#F5AE39' }}>Pending</Text>
        </View>
    )
}
