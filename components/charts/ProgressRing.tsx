import { View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'
import { colors } from '@/lib/colors'

interface ProgressRingProps {
    /** 0–1 (values above 1 render as a full ring) */
    progress: number
    color: string
    size?: number
    strokeWidth?: number
    /** Rendered in the middle of the ring */
    children?: React.ReactNode
}

export function ProgressRing({ progress, color, size = 150, strokeWidth = 14, children }: ProgressRingProps) {
    const r = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * r
    const clamped = Math.max(0, Math.min(progress, 1))

    return (
        <View style={{ width: size, height: size }}>
            <Svg width={size} height={size}>
                <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.elevated} strokeWidth={strokeWidth} fill="none" />
                {clamped > 0 && (
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={r}
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        fill="none"
                        strokeDasharray={`${circumference * clamped} ${circumference}`}
                        // Start at 12 o'clock
                        transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    />
                )}
            </Svg>
            <View className="absolute inset-0 items-center justify-center">{children}</View>
        </View>
    )
}
