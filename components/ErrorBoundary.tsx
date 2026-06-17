import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { ErrorBoundaryProps } from 'expo-router'
import { colors } from '@/lib/colors'

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
        backgroundColor: colors.bg,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    title: {
        color: colors.text,
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 8,
    },
    message: {
        color: colors.muted,
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    button: {
        backgroundColor: colors.accent,
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
