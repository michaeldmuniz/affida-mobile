import { useState, useMemo } from 'react'
import {
    Modal, View, Text, TextInput, TouchableOpacity, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Search, Check } from 'lucide-react-native'
import type { Category } from '@/lib/types'

const GROUP_LABELS: Record<string, string> = {
    INCOME: 'Income',
    EXPENSE: 'Expense',
    TRANSFER: 'Transfer',
}

interface Props {
    visible: boolean
    categories: Category[]
    selectedId: string | null
    onSelect: (id: string | null, name: string | null) => void
    onClose: () => void
}

export function CategoryPicker({ visible, categories, selectedId, onSelect, onClose }: Props) {
    const [search, setSearch] = useState('')

    const filtered = useMemo(() => {
        const q = search.toLowerCase()
        return q ? categories.filter(c => c.name.toLowerCase().includes(q)) : categories
    }, [categories, search])

    const grouped = useMemo(() => {
        const map: Record<string, Category[]> = {}
        for (const c of filtered) {
            if (!map[c.group]) map[c.group] = []
            map[c.group].push(c)
        }
        return map
    }, [filtered])

    const groupOrder = ['INCOME', 'EXPENSE', 'TRANSFER'].filter(g => grouped[g]?.length)

    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView className="flex-1 bg-brand-bg">
                {/* Header */}
                <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                    <Text className="flex-1 text-brand-text text-lg font-semibold">Category</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={8}>
                        <X size={20} color="#6B7280" />
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View className="px-4 py-3">
                    <View className="flex-row items-center bg-brand-surface border border-brand-border rounded-xl px-3 h-10 gap-x-2">
                        <Search size={15} color="#6B7280" />
                        <TextInput
                            className="flex-1 text-brand-text text-sm"
                            placeholder="Search categories..."
                            placeholderTextColor="#6B7280"
                            value={search}
                            onChangeText={setSearch}
                            autoCorrect={false}
                        />
                    </View>
                </View>

                <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
                    {/* Uncategorized option */}
                    {!search && (
                        <TouchableOpacity
                            className="flex-row items-center px-4 py-3.5 border-b border-brand-border"
                            onPress={() => { onSelect(null, null); onClose() }}
                        >
                            <Text className="flex-1 text-brand-muted text-sm">Uncategorized</Text>
                            {selectedId === null && <Check size={16} color="#5B7BF8" />}
                        </TouchableOpacity>
                    )}

                    {groupOrder.map(group => (
                        <View key={group}>
                            <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest px-4 pt-5 pb-2">
                                {GROUP_LABELS[group]}
                            </Text>
                            {grouped[group].map((cat, i) => (
                                <TouchableOpacity
                                    key={cat.id}
                                    className={`flex-row items-center px-4 py-3.5 ${i < grouped[group].length - 1 ? 'border-b border-brand-border' : ''}`}
                                    onPress={() => { onSelect(cat.id, cat.name); onClose() }}
                                >
                                    <Text className="flex-1 text-brand-text text-sm">{cat.name}</Text>
                                    {selectedId === cat.id && <Check size={16} color="#5B7BF8" />}
                                </TouchableOpacity>
                            ))}
                        </View>
                    ))}
                    <View className="h-8" />
                </ScrollView>
            </SafeAreaView>
        </Modal>
    )
}
