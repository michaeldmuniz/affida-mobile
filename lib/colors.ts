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
