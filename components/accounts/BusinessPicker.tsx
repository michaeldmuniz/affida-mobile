import { useState } from 'react'
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Check, Plus } from 'lucide-react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { colors } from '@/lib/colors'

interface Business { id: string; name: string; kind?: 'PERSONAL' | 'BUSINESS' }

/**
 * Where an account belongs: Personal, or one of the owner's named groups (each Personal or Business).
 * A group can be added right here ("+ New group"); each one has its own choice in the scope picker.
 */
export function BusinessPicker({ visible, selectedId, onSelect, onClose }: {
    visible: boolean
    /** null = Personal */
    selectedId: string | null
    onSelect: (businessId: string | null) => void
    onClose: () => void
}) {
    const queryClient = useQueryClient()
    const [adding, setAdding] = useState(false)
    const [name, setName] = useState('')
    const [kind, setKind] = useState<'PERSONAL' | 'BUSINESS'>('BUSINESS')
    const [saving, setSaving] = useState(false)

    const { data: businesses = [] } = useQuery<Business[]>({
        queryKey: ['businesses'],
        queryFn: async () => (await apiClient.get('/businesses')).data.data,
        enabled: visible,
    })

    const pick = (id: string | null) => { onSelect(id); onClose() }

    const create = async () => {
        if (!name.trim() || saving) return
        setSaving(true)
        try {
            const res = await apiClient.post('/businesses', { name: name.trim(), kind })
            await queryClient.invalidateQueries({ queryKey: ['businesses'] })
            await queryClient.invalidateQueries({ queryKey: ['scope'] })
            setName(''); setAdding(false)
            pick((res.data.data as Business).id)
        } catch (e: any) {
            Alert.alert('Could not add the group', e?.response?.data?.error ?? 'Please try again.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView className="flex-1 bg-brand-bg">
                <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                    <Text className="flex-1 text-brand-text text-lg font-semibold">Belongs to</Text>
                    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={8}>
                        <X size={20} color={colors.muted} />
                    </TouchableOpacity>
                </View>
                <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
                    {[{ id: null as string | null, name: 'Personal', kind: undefined as Business['kind'] }, ...businesses].map((b, i) => (
                        <TouchableOpacity
                            key={b.id ?? 'personal'}
                            className={`flex-row items-center px-4 py-3.5 ${i < businesses.length ? 'border-b border-brand-border' : ''}`}
                            onPress={() => pick(b.id)}
                        >
                            <Text className="flex-1 text-brand-text text-sm">{b.name}{b.kind ? ` (${b.kind === 'BUSINESS' ? 'Business' : 'Personal'})` : ''}</Text>
                            {selectedId === b.id && <Check size={16} color={colors.accent} />}
                        </TouchableOpacity>
                    ))}
                    {adding ? (
                        <View className="px-4 py-3 gap-y-2 border-t border-brand-border">
                            <TextInput
                                className="bg-brand-surface border border-brand-border rounded-xl px-3 h-11 text-brand-text text-sm"
                                placeholder="Group name, e.g. Acme LLC"
                                placeholderTextColor={colors.muted}
                                value={name} onChangeText={setName} maxLength={60} autoFocus
                                onSubmitEditing={create} returnKeyType="done"
                            />
                            <View className="flex-row gap-x-2">
                                {(['BUSINESS', 'PERSONAL'] as const).map(k => (
                                    <TouchableOpacity
                                        key={k} accessibilityRole="button" accessibilityState={{ selected: kind === k }} onPress={() => setKind(k)}
                                        className={`flex-1 h-10 rounded-xl items-center justify-center border ${kind === k ? 'bg-brand-accent border-brand-accent' : 'border-brand-border'}`}
                                    >
                                        <Text className={`text-sm font-medium ${kind === k ? 'text-white' : 'text-brand-muted'}`}>{k === 'BUSINESS' ? 'Business' : 'Personal'}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View className="flex-row gap-x-2">
                                <TouchableOpacity className="flex-1 h-10 rounded-xl bg-brand-accent items-center justify-center" onPress={create} disabled={saving || !name.trim()}>
                                    <Text className="text-white text-sm font-semibold">{saving ? 'Adding…' : 'Add and move here'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity className="h-10 px-4 rounded-xl border border-brand-border items-center justify-center" onPress={() => { setAdding(false); setName('') }}>
                                    <Text className="text-brand-muted text-sm">Cancel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity className="flex-row items-center px-4 py-3.5 gap-x-2 border-t border-brand-border" onPress={() => setAdding(true)}>
                            <Plus size={15} color={colors.accent} />
                            <Text className="text-brand-accent text-sm font-medium">New group</Text>
                        </TouchableOpacity>
                    )}
                    <Text className="text-brand-muted text-xs px-4 py-4">
                        Each group shows as its own choice in the scope picker, has its own dashboards and is shared separately.
                    </Text>
                </ScrollView>
            </SafeAreaView>
        </Modal>
    )
}
