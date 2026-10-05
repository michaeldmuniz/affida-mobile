import { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Plus, X } from 'lucide-react-native'
import { apiClient } from '@/lib/api-client'
import type { CalendarItem, CalendarMember, FamilyCalendar as CalendarData } from '@/lib/types'
import { colors, kidColor } from '@/lib/colors'
import { haptics } from '@/lib/haptics'
import { addDaysTo, localDay } from '@/lib/format'
import { Card } from '@/components/ui/Card'
import { MonthGrid, gridDays, monthOf } from '@/components/family/MonthGrid'

// A month calendar of chores and goals (whole days, like Google Calendar's
// month view). One person's, or the whole household's with a color per person.
// Pick a day to see and check off what's on it; days up to a week back can
// still be checked off, like on Today. Same as the web's FamilyCalendar.

const CATCH_UP_DAYS = 7

const STATUS_LABEL: Record<CalendarItem['status'], string> = {
    done: 'Done', missed: 'Missed', due: 'Today', overdue: 'Overdue', upcoming: 'Upcoming',
}

function money(n: number) {
    return `$${n.toFixed(2)}`
}

function memberName(m: CalendarMember) {
    return m.isYou ? 'You' : m.name.split(' ')[0]
}

interface Props {
    /** One kid, one parent, or omitted for the whole household. */
    owner?: { childId: string } | { adultId: string }
    /** Shows an Add button on a picked day from today on (new task starting that day). */
    onAddOnDay?: (day: string) => void
}

export function FamilyCalendar({ owner, onAddOnDay }: Props) {
    const queryClient = useQueryClient()
    const household = !owner
    const [today] = useState(() => localDay())
    const [month, setMonth] = useState(() => monthOf(today))
    const [selected, setSelected] = useState(today)
    const [hidden, setHidden] = useState<Set<string>>(new Set())

    const days = gridDays(month)
    const from = days[0]
    const to = days[days.length - 1]

    const { data, isLoading } = useQuery<CalendarData>({
        queryKey: ['family', 'calendar', owner ?? 'household', from, to, today],
        queryFn: async () => (await apiClient.get('/family/calendar', { params: { from, to, today, ...owner } })).data.data,
    })

    const members = useMemo(() => new Map((data?.members ?? []).map(m => [m.id, m])), [data])
    const byDay = useMemo(() => {
        const map = new Map<string, CalendarItem[]>()
        for (const item of data?.items ?? []) {
            if (hidden.has(item.ownerId)) continue
            map.set(item.day, [...(map.get(item.day) ?? []), item])
        }
        return map
    }, [data, hidden])

    /** Household: the person's color. One person: by status. */
    const colorOf = (item: CalendarItem) => {
        if (household) return kidColor(members.get(item.ownerId)?.color)
        if (item.status === 'done') return colors.positive
        if (item.status === 'overdue') return colors.negative
        if (item.status === 'missed') return colors.muted
        return colors.accent
    }

    const catchUpFrom = addDaysTo(today, -CATCH_UP_DAYS)
    const canToggle = (item: CalendarItem) =>
        !item.archived && (item.status === 'overdue' || (item.status !== 'upcoming' && item.day >= catchUpFrom && item.day <= today))

    const [busyKey, setBusyKey] = useState<string | null>(null)
    const { mutate: toggle } = useMutation({
        mutationFn: async (item: CalendarItem) => {
            if (item.status === 'done') {
                await apiClient.delete(`/family/tasks/${item.taskId}/complete`, { params: { day: item.day } })
                return null
            }
            // An overdue one-off gets done today, not on the day it was due.
            const day = item.status === 'overdue' ? today : item.day
            return (await apiClient.post(`/family/tasks/${item.taskId}/complete`, { day })).data.data as { earned: number; bonus: number; streak: number }
        },
        onMutate: (item) => setBusyKey(`${item.taskId}:${item.day}`),
        onSuccess: (result) => {
            haptics.success()
            if (result && result.bonus > 0) Alert.alert(`${result.streak} in a row!`, `Includes a ${money(result.bonus)} streak bonus.`)
        },
        onError: (e: any) => {
            haptics.error()
            Alert.alert('Error', e?.response?.data?.error ?? 'Something went wrong.')
        },
        onSettled: async () => {
            await queryClient.invalidateQueries({ queryKey: ['family'] })
            setBusyKey(null)
        },
    })

    const pick = (day: string) => {
        setSelected(day)
        const m = monthOf(day)
        if (m.getMonth() !== month.getMonth()) setMonth(m)
    }

    const toggleMember = (id: string) => setHidden(prev => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
    })

    const selectedItems = byDay.get(selected) ?? []
    const selectedLabel = selected === today
        ? 'Today'
        : new Date(`${selected}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

    return (
        <View className="gap-y-3">
            <Card className="p-4">
                {household && data && data.members.length > 1 && (
                    <View className="flex-row flex-wrap gap-2 mb-4">
                        {data.members.map(m => (
                            <TouchableOpacity
                                key={m.id}
                                onPress={() => { haptics.light(); toggleMember(m.id) }}
                                className={`flex-row items-center gap-x-1.5 border border-brand-border rounded-full px-2.5 py-1 ${hidden.has(m.id) ? 'opacity-40' : ''}`}
                            >
                                <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: kidColor(m.color) }} />
                                <Text className="text-brand-text text-xs">{memberName(m)}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
                <MonthGrid
                    month={month}
                    onMonthChange={setMonth}
                    today={today}
                    selected={selected}
                    onPick={pick}
                    dotsFor={(d) => (byDay.get(d) ?? []).map(colorOf)}
                    headerRight={
                        <TouchableOpacity onPress={() => { haptics.light(); setMonth(monthOf(today)); setSelected(today) }} hitSlop={8} className="border border-brand-border rounded-lg px-2.5 py-1 mr-1">
                            <Text className="text-brand-text text-xs font-medium">Today</Text>
                        </TouchableOpacity>
                    }
                />
                {isLoading && <View className="absolute inset-0 items-center justify-center"><ActivityIndicator color={colors.accent} /></View>}
            </Card>

            <Card className="p-0 overflow-hidden">
                <View className="flex-row items-center justify-between px-4 py-3 border-b border-brand-border">
                    <Text className="text-brand-text text-sm font-semibold">{selectedLabel}</Text>
                    {onAddOnDay && selected >= today && (
                        <TouchableOpacity onPress={() => { haptics.light(); onAddOnDay(selected) }} hitSlop={8} className="flex-row items-center gap-x-1">
                            <Plus size={14} color={colors.accent} strokeWidth={2.2} />
                            <Text className="text-brand-accent text-sm font-semibold">Add</Text>
                        </TouchableOpacity>
                    )}
                </View>
                {selectedItems.length === 0 ? (
                    <Text className="text-brand-muted text-sm text-center py-6">Nothing on this day.</Text>
                ) : selectedItems.map((item, i) => {
                    const key = `${item.taskId}:${item.day}`
                    const done = item.status === 'done'
                    const editable = canToggle(item)
                    const ownerInfo = members.get(item.ownerId)
                    return (
                        <TouchableOpacity
                            key={key}
                            activeOpacity={0.7}
                            disabled={!editable || busyKey === key}
                            onPress={() => toggle(item)}
                            className={`flex-row items-center gap-x-3 px-4 py-3 ${i > 0 ? 'border-t border-brand-border' : ''}`}
                        >
                            <View className={`w-7 h-7 rounded-full items-center justify-center border-2 ${done ? 'bg-brand-positive border-brand-positive' : 'border-brand-muted'} ${editable ? '' : 'opacity-50'}`}>
                                {busyKey === key
                                    ? <ActivityIndicator size="small" color={done ? '#fff' : colors.muted} />
                                    : done ? <Check size={15} color="#fff" strokeWidth={3} />
                                        : item.status === 'missed' ? <X size={12} color={colors.muted} strokeWidth={3} /> : null}
                            </View>
                            <View className="flex-1">
                                <Text className={`text-sm font-medium ${done || item.status === 'missed' ? 'text-brand-muted' : 'text-brand-text'} ${done ? 'line-through' : ''}`} numberOfLines={1}>{item.title}</Text>
                                <View className="flex-row items-center gap-x-1.5 mt-0.5">
                                    {household && ownerInfo && (
                                        <>
                                            <View className="w-2 h-2 rounded-full" style={{ backgroundColor: kidColor(ownerInfo.color) }} />
                                            <Text className="text-brand-muted text-xs">{memberName(ownerInfo)} ·</Text>
                                        </>
                                    )}
                                    <Text className={`text-xs ${item.status === 'overdue' ? 'text-brand-negative' : 'text-brand-muted'}`}>{STATUS_LABEL[item.status]}</Text>
                                    <Text className="text-brand-muted text-xs">· {item.kind === 'HABIT' ? 'Daily goal' : 'Chore'}</Text>
                                </View>
                            </View>
                            {item.reward > 0 && (
                                <Text className={`text-sm font-semibold ${done ? 'text-brand-positive' : 'text-brand-muted'}`}>{done ? '+' : ''}{money(item.reward)}</Text>
                            )}
                        </TouchableOpacity>
                    )
                })}
            </Card>
        </View>
    )
}
