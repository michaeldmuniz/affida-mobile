import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg'

/**
 * Affida brand mark — matches the web app's BrandMark (components/Brand.tsx):
 * an upward "ascent" glyph on an indigo gradient tile.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
    return (
        <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
            <Defs>
                <LinearGradient id="affida-tile" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                    <Stop stopColor="#6D8BFF" />
                    <Stop offset="1" stopColor="#4A63E7" />
                </LinearGradient>
            </Defs>
            <Rect width="64" height="64" rx="16" fill="url(#affida-tile)" />
            <Rect x="14" y="36" width="8" height="14" rx="3" fill="white" fillOpacity="0.55" />
            <Rect x="28" y="27" width="8" height="23" rx="3" fill="white" fillOpacity="0.75" />
            <Rect x="42" y="14" width="8" height="36" rx="3" fill="white" />
        </Svg>
    )
}
