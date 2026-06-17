import { useState } from 'react'
import { View, Text } from 'react-native'
import Svg, { Polyline, Polygon, Defs, LinearGradient, Stop, Circle } from 'react-native-svg'
import { colors } from '@/lib/colors'

interface LineChartProps {
    points: number[]
    labels?: string[]
    height?: number
    color?: string
    /** Compact sparkline mode: no labels, thinner stroke */
    sparkline?: boolean
}

export function LineChart({
    points,
    labels,
    height = 140,
    color = colors.accent,
    sparkline = false,
}: LineChartProps) {
    const [width, setWidth] = useState(0)

    if (points.length < 2) return null

    const min = Math.min(...points)
    const max = Math.max(...points)
    const range = max - min || 1
    const padY = sparkline ? 4 : 10

    const coords = points.map((p, i) => {
        const x = (i / (points.length - 1)) * width
        const y = padY + (1 - (p - min) / range) * (height - padY * 2)
        return { x, y }
    })

    const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ')
    const polygonPoints = `0,${height} ${polylinePoints} ${width},${height}`
    const last = coords[coords.length - 1]
    const gradientId = sparkline ? 'sparkFill' : 'lineFill'

    return (
        <View>
            <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
                {width > 0 && (
                    <Svg width={width} height={height}>
                        <Defs>
                            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                <Stop offset="0" stopColor={color} stopOpacity={0.25} />
                                <Stop offset="1" stopColor={color} stopOpacity={0} />
                            </LinearGradient>
                        </Defs>
                        <Polygon points={polygonPoints} fill={`url(#${gradientId})`} />
                        <Polyline
                            points={polylinePoints}
                            fill="none"
                            stroke={color}
                            strokeWidth={sparkline ? 2 : 2.5}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />
                        <Circle cx={last.x} cy={last.y} r={sparkline ? 3 : 4} fill={color} />
                    </Svg>
                )}
            </View>
            {!sparkline && labels && labels.length > 0 && (
                <View className="flex-row justify-between mt-2">
                    {labels.map((l, i) => (
                        <Text key={i} className="text-brand-muted text-[10px]">
                            {l}
                        </Text>
                    ))}
                </View>
            )}
        </View>
    )
}
