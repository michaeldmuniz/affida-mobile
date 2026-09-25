import { useState, useEffect } from 'react'
import {
    Modal, View, Text, TextInput, TouchableOpacity,
    ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Trash2 } from 'lucide-react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type { Child } from '@/lib/types'
import { colors, KID_COLORS, type KidColorKey } from '@/lib/colors'
import { haptics } from '@/lib/haptics'

interface Props {
    /** 'new' to add a kid, a Child to edit, null when closed. */
    child: Child | 'new' | null
    onClose: () => void
    /** Called after the kid is removed, so a parent sheet can close too. */
    onRemoved?: () => void
}

const COLOR_KEYS = Object.keys(KID_COLORS) as KidColorKey[]

export function ChildEditSheet({ child, onClose, onRemoved }: Props) {
    const queryClient = useQueryClient()
    const existing = child && child !== 'new' ? child : null
    const [name, setName] = useState('')
    const [birthYear, setBirthYear] = useState('')
    const [color, setColor] = useState<string>('chart-1')

    useEffect(() => {
        if (!child) return
        setName(existing?.name ?? '')
        setBirthYear(existing?.birthYear ? String(existing.birthYear) : '')
        setColor(existing?.color ?? 'chart-1')
    }, [child === 'new' ? 'new' : existing?.id])

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['family'] })
        if (existing) queryClient.invalidateQueries({ queryKey: ['family', existing.id] })
    }

    const { mutate: save, isPending } = useMutation({
        mutationFn: async () => {
            const body = { name: name.trim(), birthYear: birthYear ? Number(birthYear) : null, color }
            if (existing) await apiClient.patch(`/family/children/${existing.id}`, body)
            else await apiClient.post('/family/children', body)
        },
        onSuccess: () => {
            haptics.success()
            invalidate()
            onClose()
        },
        onError: (e: any) => {
            haptics.error()
            Alert.alert('Error', e?.response?.data?.error ?? 'Failed to save. Please try again.')
        },
    })

    const handleRemove = () => {
        if (!existing) return
        haptics.warning()
        Alert.alert(`Remove ${existing.name}?`, "They'll disappear from your family. Their wallet history is kept.", [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive', onPress: async () => {
                    try {
                        await apiClient.delete(`/family/children/${existing.id}`)
                        invalidate()
                        onClose()
                        onRemoved?.()
                    } catch {
                        Alert.alert('Error', 'Failed to remove.')
                    }
                },
            },
        ])
    }

    if (!child) return null

    return (
        <Modal visible animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
            <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                    <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                        <TouchableOpacity onPress={onClose} hitSlop={8} className="w-8">
                            <X size={20} color={colors.muted} />
                        </TouchableOpacity>
                        <Text className="flex-1 text-center text-brand-text text-base font-semibold" numberOfLines={1}>
                            {existing ? `Edit ${existing.name}` : 'Add Kid'}
                        </Text>
                        <TouchableOpacity onPress={() => save()} disabled={isPending || !name.trim()} hitSlop={8} className="items-end">
                            {isPending
                                ? <ActivityIndicator size="small" color={colors.accent} />
                                : <Text className={`font-semibold text-sm ${name.trim() ? 'text-brand-accent' : 'text-brand-muted'}`}>Save</Text>
                            }
                        </TouchableOpacity>
                    </View>

                    <View className="px-4 pt-6 gap-y-5 flex-1">
                        <View>
                            <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">Name</Text>
                            <TextInput
                                className="bg-brand-surface border border-brand-border rounded-xl px-4 h-12 text-brand-text text-base"
                                value={name}
                                onChangeText={setName}
                                placeholder="e.g. Emma"
                                placeholderTextColor={colors.muted}
                                maxLength={50}
                                autoFocus={!existing}
                            />
                        </View>

                        <View>
                            <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">Birth year (optional)</Text>
                            <TextInput
                                className="bg-brand-surface border border-brand-border rounded-xl px-4 h-12 text-brand-text text-base"
                                value={birthYear}
                                onChangeText={(t) => setBirthYear(t.replace(/\D/g, '').slice(0, 4))}
                                placeholder={String(new Date().getFullYear() - 10)}
                                placeholderTextColor={colors.muted}
                                keyboardType="number-pad"
                            />
                        </View>

                        <View>
                            <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">Color</Text>
                            <View className="flex-row gap-x-3">
                                {COLOR_KEYS.map((key) => (
                                    <TouchableOpacity
                                        key={key}
                                        onPress={() => { haptics.light(); setColor(key) }}
                                        className="w-10 h-10 rounded-full items-center justify-center"
                                        style={{ borderWidth: 2, borderColor: color === key ? colors.text : 'transparent' }}
                                    >
                                        <View className="w-8 h-8 rounded-full" style={{ backgroundColor: KID_COLORS[key] }} />
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <Text className="text-brand-muted text-xs leading-relaxed">
                            Kids don't need their own login — you and your partner manage their wallet.
                        </Text>

                        {existing && (
                            <TouchableOpacity onPress={handleRemove} className="flex-row items-center justify-center gap-x-2 py-3 mt-auto mb-4">
                                <Trash2 size={16} color={colors.destructive} />
                                <Text className="text-brand-negative font-medium">Remove {existing.name}</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </Modal>
    )
}
