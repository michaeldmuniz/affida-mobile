import { useState } from 'react'
import {
    Modal, View, Text, ScrollView, TouchableOpacity, Image,
    ActivityIndicator, Alert, useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Camera, Image as ImageIcon, ReceiptText } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import DocumentScanner from 'react-native-document-scanner-plugin'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { haptics } from '@/lib/haptics'
import { colors } from '@/lib/colors'
import { ReceiptDetailSheet } from '@/components/receipts/ReceiptDetailSheet'
import { CropStep, type CropQuad } from '@/components/receipts/CropStep'
import type { Receipt } from '@/lib/types'

type ScanStep = 'pick' | 'crop' | 'preview' | 'uploading'

interface Props {
    visible: boolean
    onClose: () => void
    onViewPending: () => void
}

export function ScanSheet({ visible, onClose, onViewPending }: Props) {
    const queryClient = useQueryClient()
    const [step, setStep] = useState<ScanStep>('pick')
    const [imageUri, setImageUri] = useState<string | null>(null)
    const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
    const [cropQuad, setCropQuad] = useState<CropQuad | null>(null)
    const [result, setResult] = useState<Receipt | null>(null)

    const reset = () => {
        setStep('pick')
        setImageUri(null)
        setNaturalSize(null)
        setCropQuad(null)
        setResult(null)
    }

    const handleClose = () => {
        reset()
        onClose()
    }

    const scanWithCamera = async () => {
        haptics.light()
        try {
            // Native document scanner: live edge detection, auto perspective (tilt)
            // correction, and its own crop-adjustment screen before returning.
            const { scannedImages, status } = await DocumentScanner.scanDocument({
                croppedImageQuality: 100,
            })
            if (status === 'success' && scannedImages && scannedImages.length > 0) {
                setImageUri(scannedImages[0])
                setStep('preview')
            }
        } catch {
            Alert.alert('Camera Error', 'Could not open the document scanner. Please try again.')
        }
    }

    const pickFromLibrary = async () => {
        haptics.light()
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (!permission.granted) {
            Alert.alert('Photo Access', 'Please allow photo library access in Settings to select receipts.')
            return
        }
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 1.0,
            allowsEditing: false,
        })
        if (!res.canceled && res.assets[0]) {
            const asset = res.assets[0]
            setImageUri(asset.uri)
            // expo-image-picker's reported width/height can be 0 (e.g. for
            // iCloud-optimized photos not yet fully downloaded) — read the
            // real dimensions from the file itself rather than trusting it.
            Image.getSize(
                asset.uri,
                (width, height) => {
                    setNaturalSize({ width, height })
                    setStep('crop')
                },
                () => {
                    Alert.alert('Error', 'Could not read that image. Please try a different photo.')
                }
            )
        }
    }

    const { mutate: upload } = useMutation({
        mutationFn: async () => {
            if (!imageUri) return null
            const formData = new FormData()
            formData.append('image', {
                uri: imageUri,
                type: 'image/jpeg',
                name: 'receipt.jpg',
            } as any)
            if (cropQuad) {
                formData.append('cropQuad', JSON.stringify(cropQuad))
            }
            const res = await apiClient.post('/receipts', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 30000,
            })
            return res.data.data as Receipt
        },
        onMutate: () => setStep('uploading'),
        onSuccess: (data) => {
            if (!data) return
            setResult(data)
            queryClient.invalidateQueries({ queryKey: ['receipts'] })
            if (data.status === 'matched') {
                queryClient.invalidateQueries({ queryKey: ['transactions'] })
                haptics.success()
            } else {
                haptics.light()
            }
        },
        onError: (err: any) => {
            setStep('preview')
            const msg = err?.response?.data?.error ?? err?.message ?? 'Unknown error'
            Alert.alert('Upload Failed', msg)
        },
    })

    return (
        <>
            <Modal visible={visible && !result} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
                <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                    <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                        <TouchableOpacity onPress={handleClose} hitSlop={8} className="w-8">
                            <X size={20} color={colors.muted} />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-brand-text text-base font-semibold">
                            Scan Receipt
                        </Text>
                        <View className="w-8" />
                    </View>

                    <ScrollView
                        className="flex-1"
                        contentContainerStyle={{ flexGrow: 1 }}
                        showsVerticalScrollIndicator={false}
                        scrollEnabled={step !== 'crop'}
                    >
                        {step === 'pick' && (
                            <View className="flex-1 items-center justify-center px-8 gap-y-4 py-12">
                                <View className="w-16 h-16 rounded-2xl bg-brand-surface border border-brand-border items-center justify-center mb-2">
                                    <ReceiptText size={28} color={colors.accent} strokeWidth={1.5} />
                                </View>
                                <Text className="text-brand-text text-xl font-bold text-center">Scan a Receipt</Text>
                                <Text className="text-brand-muted text-sm text-center leading-relaxed">
                                    Take a photo or choose one from your library. We'll auto-crop and straighten it, match it to a transaction, and split the categories automatically.
                                </Text>
                                <View className="w-full gap-y-3 mt-4">
                                    <TouchableOpacity
                                        className="h-14 rounded-2xl bg-brand-accent items-center justify-center flex-row gap-x-2"
                                        onPress={scanWithCamera}
                                        activeOpacity={0.8}
                                    >
                                        <Camera size={18} color="#fff" strokeWidth={2} />
                                        <Text className="text-white font-semibold text-base">Take Photo</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        className="h-14 rounded-2xl bg-brand-surface border border-brand-border items-center justify-center flex-row gap-x-2"
                                        onPress={pickFromLibrary}
                                        activeOpacity={0.8}
                                    >
                                        <ImageIcon size={18} color={colors.text} strokeWidth={1.8} />
                                        <Text className="text-brand-text font-medium text-base">Choose from Library</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {step === 'crop' && imageUri && naturalSize && (
                            <CropStep
                                imageUri={imageUri}
                                naturalWidth={naturalSize.width}
                                naturalHeight={naturalSize.height}
                                onConfirm={(quad) => { setCropQuad(quad); setStep('preview') }}
                                onCancel={reset}
                            />
                        )}

                        {step === 'preview' && imageUri && (
                            <View className="flex-1 px-6 py-6 gap-y-4">
                                {cropQuad && naturalSize ? (
                                    <>
                                        <CroppedPreview imageUri={imageUri} naturalSize={naturalSize} cropQuad={cropQuad} />
                                        <Text className="text-brand-muted text-xs text-center -mt-2">
                                            Perspective will be straightened automatically
                                        </Text>
                                    </>
                                ) : (
                                    <Image
                                        source={{ uri: imageUri }}
                                        style={{ width: '100%', height: 480, borderRadius: 16, resizeMode: 'contain', backgroundColor: '#111' }}
                                    />
                                )}
                                <TouchableOpacity
                                    className="h-14 rounded-2xl bg-brand-accent items-center justify-center"
                                    onPress={() => upload()}
                                    activeOpacity={0.8}
                                >
                                    <Text className="text-white font-semibold text-base">Scan Receipt</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    className="h-12 rounded-2xl items-center justify-center"
                                    onPress={reset}
                                    activeOpacity={0.7}
                                >
                                    <Text className="text-brand-muted text-sm">Choose a different image</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {step === 'uploading' && (
                            <View className="flex-1 items-center justify-center px-8 gap-y-4">
                                <ActivityIndicator size="large" color={colors.accent} />
                                <Text className="text-brand-text text-base font-medium">Processing your receipt...</Text>
                                <Text className="text-brand-muted text-sm text-center">This usually takes a few seconds</Text>
                            </View>
                        )}
                    </ScrollView>
                </SafeAreaView>
            </Modal>

            <ReceiptDetailSheet
                receipt={result}
                onClose={() => { reset(); onClose() }}
            />
        </>
    )
}

function CroppedPreview({
    imageUri,
    naturalSize,
    cropQuad,
}: {
    imageUri: string
    naturalSize: { width: number; height: number }
    cropQuad: CropQuad
}) {
    const { width: windowWidth } = useWindowDimensions()

    // The exact perspective warp happens server-side; this shows an approximate
    // bounding-box preview of the selection (still skewed) so the user isn't
    // left staring at the full, unmodified photo before upload.
    const points = [cropQuad.tl, cropQuad.tr, cropQuad.br, cropQuad.bl]
    const cropX = Math.min(...points.map((p) => p.x))
    const cropY = Math.min(...points.map((p) => p.y))
    const cropWidth = Math.max(...points.map((p) => p.x)) - cropX
    const cropHeight = Math.max(...points.map((p) => p.y)) - cropY

    const containerWidth = windowWidth - 48 // matches the sheet's px-6 horizontal padding
    const scale = containerWidth / cropWidth
    const containerHeight = cropHeight * scale

    return (
        <View style={{ width: '100%', height: containerHeight, borderRadius: 16, overflow: 'hidden', backgroundColor: '#111' }}>
            <Image
                source={{ uri: imageUri }}
                style={{
                    position: 'absolute',
                    left: -cropX * scale,
                    top: -cropY * scale,
                    width: naturalSize.width * scale,
                    height: naturalSize.height * scale,
                }}
            />
        </View>
    )
}
