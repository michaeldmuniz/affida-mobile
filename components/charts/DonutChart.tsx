import { View } from 'react-native'
import Svg, { Path, Circle } from 'react-native-svg'
import { colors } from '@/lib/colors'

export interface DonutSlice {
    label: string
    value: number
    color: string
}

interface DonutChartProps {
    data: DonutSlice[]
    size?: number
    strokeWidth?: number
    /** Rendered in the hole of the donut (e.g. total amount) */
    children?: React.ReactNode
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const a = ((angleDeg - 90) * Math.PI) / 180
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(cx, cy, r, endAngle)
    const end = polarToCartesian(cx, cy, r, startAngle)
    const largeArc = endAngle - startAngle <= 180 ? '0' : '1'
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`
}

const GAP_DEGREES = 2.5

export function DonutChart({ data, size = 180, strokeWidth = 22, children }: DonutChartProps) {
    const total = data.reduce((s, d) => s + d.value, 0)
    const cx = size / 2
    const cy = size / 2
    const r = (size - strokeWidth) / 2

    const visible = data.filter((d) => d.value > 0)

    let segments: { path: string; color: string }[] = []
    let fullCircleColor: string | null = null

    if (total > 0 && visible.length === 1) {
        fullCircleColor = visible[0].color
    } else if (total > 0) {
        let angle = 0
        for (const d of visible) {
            const sweep = (d.value / total) * 360
            // Skip slivers that would be smaller than the gap itself
            if (sweep > GAP_DEGREES * 1.5) {
                segments.push({
                    path: arcPath(cx, cy, r, angle + GAP_DEGREES / 2, angle + sweep - GAP_DEGREES / 2),
                    color: d.color,
                })
            }
            angle += sweep
        }
    }

    return (
        <View style={{ width: size, height: size }}>
            <Svg width={size} height={size}>
                {total === 0 && (
                    <Circle cx={cx} cy={cy} r={r} stroke={colors.elevated} strokeWidth={strokeWidth} fill="none" />
                )}
                {fullCircleColor && (
                    <Circle cx={cx} cy={cy} r={r} stroke={fullCircleColor} strokeWidth={strokeWidth} fill="none" />
                )}
                {segments.map((s, i) => (
                    <Path
                        key={i}
                        d={s.path}
                        stroke={s.color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="butt"
                        fill="none"
                    />
                ))}
            </Svg>
            <View className="absolute inset-0 items-center justify-center">
                {children}
            </View>
        </View>
    )
}
