import { Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Check, UploadCloud } from 'lucide-react-native'

type RangeOption = '30d' | '90d' | '180d' | '365d' | 'all'

const RANGE_OPTIONS: Array<{ value: RangeOption; label: string; sub: string }> = [
    { value: '30d',  label: 'Last 30 days',        sub: 'Import 1 month of history' },
    { value: '90d',  label: 'Last 3 months',       sub: 'Import a quarter of history' },
    { value: '180d', label: 'Last 6 months',       sub: 'Recommended for most users' },
    { value: '365d', label: 'Last year',            sub: 'Import 12 months of history' },
    { value: 'all',  label: 'All available history', sub: 'Up to ~2 years from Plaid' },
]

function daysAgo(days: number): string {
    const d = new Date()
    d.setDate(d.getDate() - days)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
}

export function computeSyncStartDate(range: RangeOption): string | undefined {
    if (range === 'all') return undefined
    const days = range === '30d' ? 30 : range === '90d' ? 90 : range === '365d' ? 365 : 180
    return daysAgo(days)
}

interface Props {
    visible: boolean
    institutionName: string
    selected: RangeOption
    onSelect: (v: RangeOption) => void
    onConfirm: () => void
    onCancel: () => void
    isLoading: boolean
}

export function SyncOptionsSheet({ visible, institutionName, selected, onSelect, onConfirm, onCancel, isLoading }: Props) {
    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onCancel}>
            <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
                <View className="px-5 pt-5 pb-4 border-b border-brand-border">
                    <Text className="text-brand-text text-lg font-bold">How far back should we sync?</Text>
                    <Text className="text-brand-muted text-sm mt-1">
                        Connected: <Text className="text-brand-text font-medium">{institutionName}</Text>
                    </Text>
                </View>

                <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                    <View className="px-4 pt-4 gap-y-2 pb-6">
                        {RANGE_OPTIONS.map(opt => {
                            const active = selected === opt.value
                            return (
                                <TouchableOpacity
                                    key={opt.value}
                                    className={`flex-row items-center px-4 py-4 rounded-2xl border ${active ? 'border-brand-accent bg-brand-accent/10' : 'border-brand-border bg-brand-surface'}`}
                                    onPress={() => onSelect(opt.value)}
                                    activeOpacity={0.7}
                                >
                                    <View className="flex-1">
                                        <Text className={`text-sm font-semibold ${active ? 'text-brand-accent' : 'text-brand-text'}`}>
                                            {opt.label}
                                        </Text>
                                        <Text className="text-brand-muted text-xs mt-0.5">{opt.sub}</Text>
                                    </View>
                                    {active && <Check size={16} color="#5B7BF8" />}
                                </TouchableOpacity>
                            )
                        })}
                    </View>
                </ScrollView>

                <View className="px-4 pb-4 pt-2 gap-y-3 border-t border-brand-border">
                    <TouchableOpacity
                        className="h-14 rounded-2xl bg-brand-accent items-center justify-center flex-row gap-x-2"
                        onPress={onConfirm}
                        disabled={isLoading}
                        activeOpacity={0.85}
                    >
                        {isLoading
                            ? <ActivityIndicator color="#fff" />
                            : <>
                                <UploadCloud size={18} color="#fff" />
                                <Text className="text-white font-semibold text-base">Start Syncing</Text>
                            </>
                        }
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onCancel} disabled={isLoading} activeOpacity={0.7}>
                        <Text className="text-brand-muted text-sm text-center">Cancel</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Modal>
    )
}
