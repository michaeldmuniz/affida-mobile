import { useMemo, useRef, useState } from 'react'
import { View, Text, Image, PanResponder, TouchableOpacity, useWindowDimensions } from 'react-native'
import Svg, { Path, Polygon } from 'react-native-svg'
import { colors } from '@/lib/colors'

export interface Point {
    x: number
    y: number
}

export interface CropQuad {
    tl: Point
    tr: Point
    br: Point
    bl: Point
}

interface Props {
    imageUri: string
    naturalWidth: number
    naturalHeight: number
    onConfirm: (quad: CropQuad) => void
    onCancel: () => void
}

const HANDLE_SIZE = 26

type Corner = 'tl' | 'tr' | 'bl' | 'br'

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max)
}

export function CropStep({ imageUri, naturalWidth, naturalHeight, onConfirm, onCancel }: Props) {
    const { width: windowWidth, height: windowHeight } = useWindowDimensions()
    const availableWidth = windowWidth - 48
    const maxHeight = windowHeight * 0.55

    const { displayWidth, displayHeight } = useMemo(() => {
        let w = availableWidth
        let h = w * (naturalHeight / naturalWidth)
        if (h > maxHeight) {
            h = maxHeight
            w = h * (naturalWidth / naturalHeight)
        }
        return { displayWidth: w, displayHeight: h }
    }, [availableWidth, maxHeight, naturalWidth, naturalHeight])

    const defaultQuad = useMemo((): CropQuad => {
        const inset = Math.min(displayWidth, displayHeight) * 0.08
        return {
            tl: { x: inset, y: inset },
            tr: { x: displayWidth - inset, y: inset },
            br: { x: displayWidth - inset, y: displayHeight - inset },
            bl: { x: inset, y: displayHeight - inset },
        }
    }, [displayWidth, displayHeight])

    const [quad, setQuad] = useState<CropQuad>(defaultQuad)
    const quadRef = useRef(quad)
    quadRef.current = quad
    const startRef = useRef<Point>({ x: 0, y: 0 })

    const responders = useMemo(() => {
        const make = (corner: Corner) =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onStartShouldSetPanResponderCapture: () => true,
                onMoveShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponderCapture: () => true,
                onPanResponderTerminationRequest: () => false,
                onPanResponderGrant: () => {
                    startRef.current = quadRef.current[corner]
                },
                onPanResponderMove: (_, gesture) => {
                    const start = startRef.current
                    const next: Point = {
                        x: clamp(start.x + gesture.dx, 0, displayWidth),
                        y: clamp(start.y + gesture.dy, 0, displayHeight),
                    }
                    setQuad((prev) => ({ ...prev, [corner]: next }))
                },
            })
        return { tl: make('tl'), tr: make('tr'), bl: make('bl'), br: make('br') }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [displayWidth, displayHeight])

    const scale = naturalWidth / displayWidth

    const handleConfirm = () => {
        const toNatural = (p: Point): Point => ({ x: Math.round(p.x * scale), y: Math.round(p.y * scale) })
        onConfirm({
            tl: toNatural(quad.tl),
            tr: toNatural(quad.tr),
            br: toNatural(quad.br),
            bl: toNatural(quad.bl),
        })
    }

    const corners: { corner: Corner; p: Point }[] = [
        { corner: 'tl', p: quad.tl },
        { corner: 'tr', p: quad.tr },
        { corner: 'bl', p: quad.bl },
        { corner: 'br', p: quad.br },
    ]

    const quadPointsAttr = `${quad.tl.x},${quad.tl.y} ${quad.tr.x},${quad.tr.y} ${quad.br.x},${quad.br.y} ${quad.bl.x},${quad.bl.y}`
    const maskPath = `M0,0 H${displayWidth} V${displayHeight} H0 Z M${quad.tl.x},${quad.tl.y} L${quad.tr.x},${quad.tr.y} L${quad.br.x},${quad.br.y} L${quad.bl.x},${quad.bl.y} Z`

    return (
        <View className="flex-1 px-6 py-6 gap-y-4 items-center">
            <Text className="text-brand-text text-base font-semibold self-start">Crop Receipt</Text>
            <View style={{ width: displayWidth, height: displayHeight }}>
                <Image
                    source={{ uri: imageUri }}
                    style={{ width: displayWidth, height: displayHeight, borderRadius: 12 }}
                    resizeMode="contain"
                />

                <Svg width={displayWidth} height={displayHeight} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
                    <Path d={maskPath} fill="rgba(0,0,0,0.55)" fillRule="evenodd" />
                    <Polygon points={quadPointsAttr} fill="none" stroke={colors.accent} strokeWidth={2} />
                </Svg>

                {corners.map(({ corner, p }) => (
                    <View
                        key={corner}
                        {...responders[corner].panHandlers}
                        hitSlop={16}
                        style={{
                            position: 'absolute',
                            left: p.x - HANDLE_SIZE / 2,
                            top: p.y - HANDLE_SIZE / 2,
                            width: HANDLE_SIZE,
                            height: HANDLE_SIZE,
                            borderRadius: HANDLE_SIZE / 2,
                            backgroundColor: colors.accent,
                            borderWidth: 3,
                            borderColor: '#fff',
                        }}
                    />
                ))}
            </View>

            <Text className="text-brand-muted text-xs text-center">
                Drag each corner to trace the receipt — tilted photos are straightened automatically
            </Text>

            <View className="w-full gap-y-3 mt-2">
                <TouchableOpacity
                    className="h-14 rounded-2xl bg-brand-accent items-center justify-center"
                    onPress={handleConfirm}
                    activeOpacity={0.8}
                >
                    <Text className="text-white font-semibold text-base">Use Photo</Text>
                </TouchableOpacity>
                <View className="flex-row gap-x-3">
                    <TouchableOpacity
                        className="flex-1 h-12 rounded-2xl items-center justify-center border border-brand-border"
                        onPress={() => setQuad(defaultQuad)}
                        activeOpacity={0.7}
                    >
                        <Text className="text-brand-muted text-sm">Reset</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        className="flex-1 h-12 rounded-2xl items-center justify-center"
                        onPress={onCancel}
                        activeOpacity={0.7}
                    >
                        <Text className="text-brand-muted text-sm">Different Photo</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    )
}
