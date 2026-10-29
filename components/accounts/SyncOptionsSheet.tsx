import { useEffect, useState } from 'react'
import { Modal, View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Check, UploadCloud } from 'lucide-react-native'
import { colors } from '@/lib/colors'
import { apiClient } from '@/lib/api-client'

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
    /** Converting a manual account: the one whose typed entries the bank's charges will be matched against */
    convertAccount?: { id: string; name: string }
}

interface ManualPreview { total: number; inRange: number }

export function SyncOptionsSheet({ visible, institutionName, selected, onSelect, onConfirm, onCancel, isLoading, convertAccount }: Props) {
    // How many entries the person typed on the account being converted fall in the chosen period
    const [preview, setPreview] = useState<ManualPreview | null>(null)
    const since = computeSyncStartDate(selected)
    useEffect(() => {
        if (!visible || !convertAccount) { setPreview(null); return }
        let stale = false
        apiClient.get(`/accounts/${convertAccount.id}/manual-preview`, { params: since ? { since } : {} })
            .then((r) => { if (!stale) setPreview(r.data.data as ManualPreview) })
            .catch(() => { if (!stale) setPreview(null) }) // an explanation is never worth an error
        return () => { stale = true }
    }, [visible, convertAccount?.id, since])

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
                                    {active && <Check size={16} color={colors.accent} />}
                                </TouchableOpacity>
                            )
                        })}
                        {convertAccount && preview && preview.total > 0 && (
                            <View className="rounded-2xl border border-sky-400/50 bg-sky-400/10 p-4 mt-2 gap-y-1.5">
                                {preview.inRange > 0 ? (
                                    <Text className="text-brand-text text-sm">
                                        You entered {preview.inRange} transaction{preview.inRange === 1 ? '' : 's'} yourself in this period. If this is your “{convertAccount.name}”, the bank’s charges are matched to them like this:
                                    </Text>
                                ) : (
                                    <Text className="text-brand-text text-sm">
                                        None of the {preview.total} transaction{preview.total === 1 ? '' : 's'} you entered fall in this period, so nothing will be matched; they stay exactly as they are.
                                    </Text>
                                )}
                                {preview.inRange > 0 && (
                                    <>
                                        <Text className="text-brand-muted text-xs">• Same amount, a similar description and a date within 3 days: matched to your entry, so it is not added twice.</Text>
                                        <Text className="text-brand-muted text-xs">• A purchase you entered in several parts that adds up exactly to one bank charge: combined into one split.</Text>
                                        <Text className="text-brand-muted text-xs">• Anything else is added as the bank’s own charge. If it was already in your list, the purchase shows twice until you review it. We list the likely ones under “Possible duplicates” on the Accounts screen and you decide.</Text>
                                    </>
                                )}
                                <Text className="text-brand-muted text-xs">Nothing you entered is deleted, and everything we match or combine is written down for you to read afterwards.</Text>
                                {selected !== 'all' && preview.total > preview.inRange && (
                                    <Text className="text-brand-muted text-xs">Your {preview.total - preview.inRange} older entr{preview.total - preview.inRange === 1 ? 'y is' : 'ies are'} outside this period and stay as they are.</Text>
                                )}
                            </View>
                        )}
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
