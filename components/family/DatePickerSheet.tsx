import { useEffect, useState } from 'react'
import { Modal, View, Text, TouchableOpacity, Pressable } from 'react-native'
import { localDay } from '@/lib/format'
import { haptics } from '@/lib/haptics'
import { MonthGrid, monthOf } from '@/components/family/MonthGrid'

interface Props {
    visible: boolean
    title: string
    value: string | null
    onPick: (day: string) => void
    onClose: () => void
    /** Days before this can't be picked. */
    minDay?: string
    /** Shows a button that clears the date (e.g. "Any day"). */
    clearLabel?: string
    onClear?: () => void
}

// A day picker built on the calendar's month grid (no native picker needed).
export function DatePickerSheet({ visible, title, value, onPick, onClose, minDay, clearLabel, onClear }: Props) {
    const today = localDay()
    const [month, setMonth] = useState(() => monthOf(value ?? today))
    useEffect(() => { if (visible) setMonth(monthOf(value ?? today)) }, [visible])

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable className="flex-1 bg-black/60 justify-center px-5" onPress={onClose}>
                <Pressable className="bg-brand-surface border border-brand-border rounded-2xl p-4" onPress={() => {}}>
                    <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-3">{title}</Text>
                    <MonthGrid
                        month={month}
                        onMonthChange={setMonth}
                        today={today}
                        selected={value}
                        minDay={minDay}
                        onPick={(d) => { onPick(d); onClose() }}
                    />
                    <View className="flex-row justify-between mt-3">
                        {onClear && clearLabel ? (
                            <TouchableOpacity onPress={() => { haptics.light(); onClear(); onClose() }} hitSlop={8}>
                                <Text className="text-brand-accent text-sm font-medium">{clearLabel}</Text>
                            </TouchableOpacity>
                        ) : <View />}
                        <TouchableOpacity onPress={onClose} hitSlop={8}>
                            <Text className="text-brand-muted text-sm font-medium">Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    )
}
