import { Image } from 'react-native'

/**
 * Affida brand mark — matches the web app's BrandMark (components/Brand.tsx).
 * The app is always dark, so it uses the white mark.
 */
export function BrandMark({ size = 32 }: { size?: number }) {
    return (
        <Image
            source={require('@/assets/brand/logo-white.png')}
            style={{ width: size, height: size }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
        />
    )
}
