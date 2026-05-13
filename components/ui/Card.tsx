import { View } from 'react-native'
import type { ViewProps } from 'react-native'

interface CardProps extends ViewProps {
    elevated?: boolean
}

export function Card({ elevated, className, children, ...props }: CardProps) {
    return (
        <View
            className={`rounded-2xl border border-brand-border p-4 ${elevated ? 'bg-brand-elevated' : 'bg-brand-surface'} ${className ?? ''}`}
            {...props}
        >
            {children}
        </View>
    )
}
