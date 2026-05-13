import { Text } from 'react-native'
import type { TextProps } from 'react-native'

interface AmountTextProps extends TextProps {
    amount: number
    size?: 'sm' | 'md' | 'lg' | 'xl'
    showSign?: boolean
    neutral?: boolean
}

const sizeClass = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-2xl',
    xl: 'text-4xl',
}

export function AmountText({
    amount,
    size = 'md',
    showSign = false,
    neutral = false,
    className,
    ...props
}: AmountTextProps) {
    const isPositive = amount >= 0
    const colorClass = neutral
        ? 'text-brand-text'
        : isPositive
        ? 'text-brand-positive'
        : 'text-brand-negative'

    const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(Math.abs(amount))

    const prefix = showSign ? (isPositive ? '+' : '−') : isPositive ? '' : '−'

    return (
        <Text
            className={`font-mono font-semibold ${sizeClass[size]} ${colorClass} ${className ?? ''}`}
            {...props}
        >
            {prefix}{formatted}
        </Text>
    )
}
