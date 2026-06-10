import { View, Text } from 'react-native'

interface TrendBarsProps {
    data: Array<{ month: string; income: number; expenses: number }>
    height?: number
}

/**
 * Grouped income (green) vs expense (red) bars per month.
 * Pure View implementation — crisper than SVG for simple bars.
 */
export function TrendBars({ data, height = 120 }: TrendBarsProps) {
    const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expenses]))

    return (
        <View>
            <View className="flex-row items-end justify-between" style={{ height }}>
                {data.map((d, i) => (
                    <View key={i} className="flex-1 flex-row items-end justify-center gap-x-1">
                        <View
                            className="w-3 rounded-t-md bg-brand-positive/80"
                            style={{ height: Math.max(3, (d.income / max) * height) }}
                        />
                        <View
                            className="w-3 rounded-t-md bg-brand-negative/80"
                            style={{ height: Math.max(3, (d.expenses / max) * height) }}
                        />
                    </View>
                ))}
            </View>
            <View className="flex-row justify-between mt-2">
                {data.map((d, i) => (
                    <Text key={i} className="flex-1 text-center text-brand-muted text-[10px]">
                        {d.month.split(' ')[0]}
                    </Text>
                ))}
            </View>
        </View>
    )
}
