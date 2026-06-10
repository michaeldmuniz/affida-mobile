// Category color palette tuned for the dark theme — assigned by index, stable per render order.
export const CHART_COLORS = [
    '#5B7BF8', // brand accent blue
    '#34D399', // emerald
    '#F59E0B', // amber
    '#A78BFA', // violet
    '#22D3EE', // cyan
    '#F472B6', // pink
    '#FB923C', // orange
    '#4ADE80', // green
    '#F87171', // red
    '#94A3B8', // slate
]

export function colorForIndex(i: number): string {
    return CHART_COLORS[i % CHART_COLORS.length]
}
