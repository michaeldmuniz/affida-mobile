import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { ErrorBoundaryProps } from 'expo-router'

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>{error.message}</Text>
            <TouchableOpacity style={styles.button} onPress={retry} activeOpacity={0.85}>
                <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#09090F',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    title: {
        color: '#F0F0FA',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    message: {
        color: '#6B7280',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    button: {
        backgroundColor: '#5B7BF8',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 15,
    },
})
