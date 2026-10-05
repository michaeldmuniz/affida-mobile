import { View, Text, TouchableOpacity } from 'react-native'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { colors } from '@/lib/colors'
import { haptics } from '@/lib/haptics'
import { localDay } from '@/lib/format'

// A month of days, Sunday first, six weeks so every month is the same height.
// Used by the family calendar (with dots for what's on each day) and the date
// picker in the task sheet.

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

/** First of the month as a Date (local). */
export function monthOf(day: string): Date {
    const d = new Date(`${day}T12:00:00`)
    return new Date(d.getFullYear(), d.getMonth(), 1, 12)
}

export function shiftMonth(month: Date, n: number): Date {
    return new Date(month.getFullYear(), month.getMonth() + n, 1, 12)
}

/** The 42 days (YYYY-MM-DD) shown for a month. */
export function gridDays(month: Date): string[] {
    const first = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay(), 12)
    return Array.from({ length: 42 }, (_, i) => localDay(new Date(first.getFullYear(), first.getMonth(), first.getDate() + i, 12)))
}

interface Props {
    month: Date
    onMonthChange: (m: Date) => void
    today: string
    selected: string | null
    onPick: (day: string) => void
    /** Dot colors to show under a day (calendar). */
    dotsFor?: (day: string) => string[]
    /** Days before this can't be picked (date picker). */
    minDay?: string
    /** Extra control in the header, e.g. a Today button. */
    headerRight?: React.ReactNode
}

export function MonthGrid({ month, onMonthChange, today, selected, onPick, dotsFor, minDay, headerRight }: Props) {
    const days = gridDays(month)
    const weeks = Array.from({ length: 6 }, (_, w) => days.slice(w * 7, w * 7 + 7))
    const title = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    return (
        <View>
            <View className="flex-row items-center mb-3">
                <Text className="flex-1 text-brand-text text-base font-semibold">{title}</Text>
                {headerRight}
                <TouchableOpacity onPress={() => { haptics.light(); onMonthChange(shiftMonth(month, -1)) }} hitSlop={8} className="w-9 h-9 items-center justify-center" accessibilityLabel="Previous month">
                    <ChevronLeft size={20} color={colors.muted} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { haptics.light(); onMonthChange(shiftMonth(month, 1)) }} hitSlop={8} className="w-9 h-9 items-center justify-center" accessibilityLabel="Next month">
                    <ChevronRight size={20} color={colors.muted} />
                </TouchableOpacity>
            </View>
            <View className="flex-row mb-1">
                {WEEKDAY_LETTERS.map((l, i) => (
                    <Text key={i} className="flex-1 text-center text-brand-muted text-[11px] font-semibold">{l}</Text>
                ))}
            </View>
            {weeks.map((week, w) => (
                <View key={w} className="flex-row">
                    {week.map(day => {
                        const inMonth = new Date(`${day}T12:00:00`).getMonth() === month.getMonth()
                        const disabled = !!minDay && day < minDay
                        const isSelected = day === selected
                        const isToday = day === today
                        const dots = dotsFor?.(day) ?? []
                        return (
                            <TouchableOpacity
                                key={day}
                                disabled={disabled}
                                onPress={() => { haptics.light(); onPick(day) }}
                                className="flex-1 items-center py-1"
                                style={{ height: dotsFor ? 48 : 40 }}
                                accessibilityLabel={new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                                accessibilityState={{ selected: isSelected, disabled }}
                            >
                                <View
                                    className={`w-8 h-8 rounded-full items-center justify-center ${isSelected ? 'bg-brand-accent' : isToday ? 'border border-brand-accent' : ''}`}
                                >
                                    <Text className={`text-sm ${isSelected ? 'text-white font-semibold' : disabled ? 'text-brand-muted opacity-40' : inMonth ? 'text-brand-text' : 'text-brand-muted'} ${isToday && !isSelected ? 'font-semibold' : ''}`}>
                                        {Number(day.slice(8))}
                                    </Text>
                                </View>
                                {dots.length > 0 && (
                                    <View className="flex-row gap-x-0.5 mt-0.5">
                                        {dots.slice(0, 4).map((c, i) => (
                                            <View key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />
                                        ))}
                                    </View>
                                )}
                            </TouchableOpacity>
                        )
                    })}
                </View>
            ))}
        </View>
    )
}
