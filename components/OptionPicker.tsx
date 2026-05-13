import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { X, Check } from 'lucide-react-native'

interface Option {
    label: string
    value: string
}

interface Props {
    visible: boolean
    title: string
    options: Option[]
    selectedValue: string | null
    onSelect: (value: string | null) => void
    onClose: () => void
    noneLabel?: string
}

export function OptionPicker({ visible, title, options, selectedValue, onSelect, onClose, noneLabel = 'Any' }: Props) {
    return (
        <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
            <SafeAreaView className="flex-1 bg-brand-bg">
                <View className="flex-row items-center px-4 py-3 border-b border-brand-border">
                    <Text className="flex-1 text-brand-text text-lg font-semibold">{title}</Text>
                    <TouchableOpacity onPress={onClose} hitSlop={8}>
                        <X size={20} color="#6B7280" />
                    </TouchableOpacity>
                </View>
                <ScrollView className="flex-1" keyboardShouldPersistTaps="handled">
                    <TouchableOpacity
                        className="flex-row items-center px-4 py-3.5 border-b border-brand-border"
                        onPress={() => { onSelect(null); onClose() }}
                    >
                        <Text className="flex-1 text-brand-muted text-sm">{noneLabel}</Text>
                        {selectedValue === null && <Check size={16} color="#5B7BF8" />}
                    </TouchableOpacity>
                    {options.map((opt, i) => (
                        <TouchableOpacity
                            key={opt.value}
                            className={`flex-row items-center px-4 py-3.5 ${i < options.length - 1 ? 'border-b border-brand-border' : ''}`}
                            onPress={() => { onSelect(opt.value); onClose() }}
                        >
                            <Text className="flex-1 text-brand-text text-sm">{opt.label}</Text>
                            {selectedValue === opt.value && <Check size={16} color="#5B7BF8" />}
                        </TouchableOpacity>
                    ))}
                    <View className="h-8" />
                </ScrollView>
            </SafeAreaView>
        </Modal>
    )
}
