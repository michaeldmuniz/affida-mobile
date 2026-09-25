import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Plus, Check, Flame } from 'lucide-react-native'
import type { ChildTask } from '@/lib/types'
import { colors, KID_COLORS } from '@/lib/colors'
import { haptics } from '@/lib/haptics'
import { scheduleLabel } from '@/lib/format'
import { Card } from '@/components/ui/Card'

// Task rows shared by the kid and adult family screens.

const STREAK_COLOR = KID_COLORS['chart-3']

function money(n: number) {
    return `$${n.toFixed(2)}`
}

export function TodayTaskRow({ task: t, busy, onToggle }: { task: ChildTask; busy: boolean; onToggle: () => void }) {
    return (
        <TouchableOpacity activeOpacity={0.7} disabled={busy} onPress={onToggle}>
            <Card className="flex-row items-center gap-x-3 p-4">
                <View className={`w-7 h-7 rounded-full items-center justify-center border-2 ${t.doneOnDay ? 'bg-brand-positive border-brand-positive' : 'border-brand-muted'}`}>
                    {busy
                        ? <ActivityIndicator size="small" color={t.doneOnDay ? '#fff' : colors.muted} />
                        : t.doneOnDay && <Check size={15} color="#fff" strokeWidth={3} />}
                </View>
                <View className="flex-1">
                    <Text className={`text-sm font-medium ${t.doneOnDay ? 'text-brand-muted line-through' : 'text-brand-text'}`} numberOfLines={1}>{t.title}</Text>
                    <Text className="text-brand-muted text-xs mt-0.5" numberOfLines={1}>
                        {t.kind === 'HABIT' ? 'Daily goal' : 'Chore'}
                        {t.nextBonusIn !== null && t.bonusAmount ? ` · ${t.nextBonusIn} more for ${money(t.bonusAmount)}` : ''}
                    </Text>
                </View>
                {t.streak > 1 && (
                    <View className="flex-row items-center gap-x-0.5">
                        <Flame size={13} color={STREAK_COLOR} />
                        <Text className="text-xs font-semibold" style={{ color: STREAK_COLOR }}>{t.streak}</Text>
                    </View>
                )}
                {t.reward > 0 && (
                    <Text className={`text-sm font-semibold ${t.doneOnDay ? 'text-brand-muted' : 'text-brand-positive'}`}>+{money(t.reward)}</Text>
                )}
            </Card>
        </TouchableOpacity>
    )
}

export function TaskSection({ title, empty, tasks, onAdd, onEdit }: {
    title: string
    empty: string
    tasks: ChildTask[]
    onAdd: () => void
    onEdit: (t: ChildTask) => void
}) {
    return (
        <View>
            <View className="flex-row items-center justify-between mb-3 px-1">
                <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest">{title}</Text>
                <TouchableOpacity onPress={() => { haptics.light(); onAdd() }} hitSlop={8} className="flex-row items-center gap-x-1">
                    <Plus size={14} color={colors.accent} strokeWidth={2.2} />
                    <Text className="text-brand-accent text-sm font-semibold">Add</Text>
                </TouchableOpacity>
            </View>
            {tasks.length === 0 ? (
                <Card className="p-4"><Text className="text-brand-muted text-sm">{empty}</Text></Card>
            ) : (
                <Card className="p-0 overflow-hidden">
                    {tasks.map((t, i) => (
                        <TouchableOpacity
                            key={t.id}
                            onPress={() => { haptics.light(); onEdit(t) }}
                            activeOpacity={0.7}
                            className={`flex-row items-center px-4 py-3 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                        >
                            <View className="flex-1">
                                <Text className="text-brand-text text-sm font-medium" numberOfLines={1}>{t.title}</Text>
                                <Text className="text-brand-muted text-xs mt-0.5" numberOfLines={1}>
                                    {scheduleLabel(t)}
                                    {t.frequency === 'ONCE' && t.lastDone ? ` · Done ${new Date(`${t.lastDone}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}
                                    {t.bonusEvery && t.bonusAmount ? ` · +${money(t.bonusAmount)} every ${t.bonusEvery}` : ''}
                                    {t.rewardAccountName && t.reward > 0 ? ` · toward ${t.rewardAccountName}` : ''}
                                </Text>
                            </View>
                            {t.streak > 1 && (
                                <View className="flex-row items-center gap-x-0.5 mr-2">
                                    <Flame size={13} color={STREAK_COLOR} />
                                    <Text className="text-xs font-semibold" style={{ color: STREAK_COLOR }}>{t.streak}</Text>
                                </View>
                            )}
                            <Text className="text-brand-muted text-sm">{t.reward > 0 ? money(t.reward) : 'No reward'}</Text>
                        </TouchableOpacity>
                    ))}
                </Card>
            )}
        </View>
    )
}
