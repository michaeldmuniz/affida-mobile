import { useEffect, useState } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import NetInfo from '@react-native-community/netinfo'

export function OfflineBanner() {
    const [isOffline, setIsOffline] = useState(false)

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            setIsOffline(state.isConnected === false)
        })
        return unsubscribe
    }, [])

    if (!isOffline) return null

    return (
        <View style={styles.banner}>
            <Text style={styles.text}>No internet connection</Text>
        </View>
    )
}

const styles = StyleSheet.create({
    banner: {
        backgroundColor: '#92400E',
        paddingVertical: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    text: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
    },
})
