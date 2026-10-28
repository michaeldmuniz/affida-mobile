import { useState } from 'react'
import {
    Modal, View, Text, ScrollView, TouchableOpacity, Image,
    ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Camera, Image as ImageIcon, ReceiptText } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import DocumentScanner from 'react-native-document-scanner-plugin'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { haptics } from '@/lib/haptics'
import { colors } from '@/lib/colors'
import { useAiUsage, aiLeftText } from '@/hooks/useAiUsage'
import { ReceiptDetailSheet } from '@/components/receipts/ReceiptDetailSheet'
import { CropStep, type CropQuad } from '@/components/receipts/CropStep'
import type { Receipt } from '@/lib/types'

type ScanStep = 'pick' | 'crop' | 'uploading'

interface Props {
    visible: boolean
    onClose: () => void
    onViewPending: () => void
}

export function ScanSheet({ visible, onClose, onViewPending }: Props) {
    const queryClient = useQueryClient()
    const { usage, refresh: refreshUsage } = useAiUsage(visible)
    const left = aiLeftText(usage, 'receipt', 'scans')
    const [step, setStep] = useState<ScanStep>('pick')
    const [imageUri, setImageUri] = useState<string | null>(null)
    const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null)
    const [cropQuad, setCropQuad] = useState<CropQuad | null>(null)
    const [result, setResult] = useState<Receipt | null>(null)
    // True from the moment an upload succeeds until the detail sheet opens, so the
    // scan modal is fully dismissed before the next one presents (two iOS modals
    // transitioning at once crashed the Fabric UIManager).
    const [finishing, setFinishing] = useState(false)
    // Errors render inside the sheet. A native Alert presented while the scan modal or
    // the document scanner is still on screen throws an NSException on iOS, and React
    // Native crashes the whole app converting it (SIGSEGV in Hermes).
    const [error, setError] = useState<string | null>(null)

    const reset = () => {
        setFinishing(false)
        setStep('pick')
        setImageUri(null)
        setNaturalSize(null)
        setCropQuad(null)
        setResult(null)
    }

    const handleClose = () => {
        reset()
        setError(null)
        onClose()
    }

    const scanWithCamera = async () => {
        haptics.light()
        setError(null)
        try {
            // Native document scanner: live edge detection, auto perspective (tilt)
            // correction, and its own crop-adjustment screen before returning.
            const { scannedImages, status } = await DocumentScanner.scanDocument({
                croppedImageQuality: 100,
            })
            if (status === 'success' && scannedImages && scannedImages.length > 0) {
                const uri = scannedImages[0]
                setImageUri(uri)
                // Let the native scanner finish dismissing before we touch the UI.
                await new Promise((resolve) => setTimeout(resolve, 500))
                upload({ uri, cropQuad: null })
            }
        } catch {
            setError('Could not open the document scanner. Please try again.')
        }
    }

    const pickFromLibrary = async () => {
        haptics.light()
        setError(null)
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (!permission.granted) {
            setError('Please allow photo library access in Settings to select receipts.')
            return
        }
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 1.0,
            allowsEditing: false,
            // Forces JPEG instead of the original HEIC — some HEIC files (e.g. ones
            // with many embedded auxiliary images) fail to decode server-side, and
            // OpenAI's vision API doesn't accept HEIC at all.
            preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
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
                    setError('Could not read that image. Please try a different photo.')
                }
            )
        }
    }

    const { mutate: upload } = useMutation({
        mutationFn: async ({ uri, cropQuad }: { uri: string; cropQuad: CropQuad | null }) => {
            const formData = new FormData()
            formData.append('image', {
                uri,
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
            setFinishing(true)
            setTimeout(() => setResult(data), 500)
            queryClient.invalidateQueries({ queryKey: ['receipts'] })
            refreshUsage()
            if (data.status === 'matched') {
                queryClient.invalidateQueries({ queryKey: ['transactions'] })
                haptics.success()
            } else {
                haptics.light()
            }
        },
        onError: (err: any) => {
            reset()
            // The server error can be a string or an object; only show plain text from it.
            const serverMsg = err?.response?.data?.error
            setError(
                typeof serverMsg === 'string' && serverMsg
                    ? serverMsg
                    : "We couldn't process that photo. Please try again with a clearer picture of the receipt."
            )
        },
    })

    return (
        <>
            <Modal visible={visible && !result && !finishing} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
                <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                    <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={handleClose} hitSlop={8} className="w-8">
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
                                {left && (
                                    <Text className={`text-xs text-center ${left.low ? 'text-amber-400' : 'text-brand-muted'}`}>{left.text}</Text>
                                )}
                                {error && (
                                    <Text className="text-red-400 text-sm text-center">{error}</Text>
                                )}
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
                                onConfirm={(quad) => { setCropQuad(quad); upload({ uri: imageUri, cropQuad: quad }) }}
                                onCancel={reset}
                            />
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
