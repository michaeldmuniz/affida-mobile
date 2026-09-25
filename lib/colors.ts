// Brand color constants — mirrors tailwind.config.js `theme.extend.colors.brand`
// Use these for icon `color` props, StyleSheet values, and any place that requires a raw hex string.
// For NativeWind className strings, use the Tailwind classes: text-brand-positive, bg-brand-negative, etc.
export const colors = {
    accent:      '#5B7BF8',
    muted:       '#6B7280',
    positive:    '#34D399',
    negative:    '#F87171',
    destructive: '#EF4444',
    bg:          '#09090F',
    surface:     '#13131B',
    elevated:    '#1A1A24',
    border:      '#1E1E2A',
    text:        '#F0F0FA',
    disabled:    '#2A2A38',
} as const

// Kid avatar colors — hex of the web app's dark-theme --chart-1…5 tokens, so a
// kid's color matches across platforms (the API stores the token name).
export const KID_COLORS = {
    'chart-1': '#5A7BF7',
    'chart-2': '#3AD198',
    'chart-3': '#F5AE39',
    'chart-4': '#A876F2',
    'chart-5': '#36C1DD',
} as const

export type KidColorKey = keyof typeof KID_COLORS

export function kidColor(key: string | null | undefined): string {
    return KID_COLORS[(key ?? 'chart-1') as KidColorKey] ?? KID_COLORS['chart-1']
}
