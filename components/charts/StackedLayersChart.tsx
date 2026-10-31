import { useState } from 'react'
import { View, Text } from 'react-native'
import Svg, { Polygon, Polyline, Line, Circle } from 'react-native-svg'
import { colors } from '@/lib/colors'
import type { NetWorthLayers } from '@/lib/types'

// What net worth is made of, stacked under the net worth line: liquid cash at the bottom, then investments, then other
// assets; what is owed hangs below zero. cash + investments + other - owed = net worth on every point (the server
// guarantees it). Mirrors the website's Net Worth report.
export const LAYER_STYLE = [
    { key: 'cash', label: 'Liquid cash', color: colors.positive },
    { key: 'investments', label: 'Investments', color: colors.accent },
    { key: 'other', label: 'Other assets', color: '#F59E0B' },
    { key: 'debt', label: 'Owed', color: colors.negative },
] as const

interface Props {
    points: { netWorth: number; layers: NetWorthLayers }[]
    labels?: string[]
    height?: number
}

export function StackedLayersChart({ points, labels, height = 150 }: Props) {
    const [width, setWidth] = useState(0)
    if (points.length < 2) return null

    // a layer is drawn from its own value; a negative one (an overdrawn account) is drawn as zero, the line stays true
    const cash = points.map((p) => Math.max(0, p.layers.cash))
    const inv = points.map((p) => Math.max(0, p.layers.investments))
    const oth = points.map((p) => Math.max(0, p.layers.other))
    const owed = points.map((p) => Math.max(0, p.layers.debt))
    const tops = points.map((_, i) => cash[i] + inv[i] + oth[i])
    const hi = Math.max(...tops, ...points.map((p) => p.netWorth), 1)
    const lo = Math.min(0, ...owed.map((d) => -d), ...points.map((p) => p.netWorth))
    const range = hi - lo || 1
    const padY = 6
    const y = (v: number) => padY + (1 - (v - lo) / range) * (height - padY * 2)
    const x = (i: number) => (i / (points.length - 1)) * width

    // the area between a lower and an upper edge (one value per point)
    const band = (lower: number[], upper: number[]) =>
        [...upper.map((v, i) => `${x(i)},${y(v)}`), ...lower.map((v, i) => `${x(lower.length - 1 - i)},${y(lower[lower.length - 1 - i])}`)].join(' ')
    const zero = points.map(() => 0)
    const t1 = cash
    const t2 = cash.map((v, i) => v + inv[i])
    const t3 = tops
    const line = points.map((p, i) => `${x(i)},${y(p.netWorth)}`).join(' ')
    const last = points[points.length - 1]

    return (
        <View>
            <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
                {width > 0 && (
                    <Svg width={width} height={height}>
                        <Polygon points={band(zero, t1)} fill={LAYER_STYLE[0].color} fillOpacity={0.45} />
                        <Polygon points={band(t1, t2)} fill={LAYER_STYLE[1].color} fillOpacity={0.45} />
                        <Polygon points={band(t2, t3)} fill={LAYER_STYLE[2].color} fillOpacity={0.45} />
                        <Polygon points={band(zero, owed.map((d) => -d))} fill={LAYER_STYLE[3].color} fillOpacity={0.35} />
                        <Line x1={0} x2={width} y1={y(0)} y2={y(0)} stroke={colors.border} strokeWidth={1} />
                        <Polyline points={line} fill="none" stroke={colors.text} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                        <Circle cx={x(points.length - 1)} cy={y(last.netWorth)} r={4} fill={colors.text} />
                    </Svg>
                )}
            </View>
            {labels && labels.length > 0 && (
                <View className="flex-row justify-between mt-2">
                    {labels.map((l, i) => (
                        <Text key={i} className="text-brand-muted text-[10px]">{l}</Text>
                    ))}
                </View>
            )}
        </View>
    )
}
