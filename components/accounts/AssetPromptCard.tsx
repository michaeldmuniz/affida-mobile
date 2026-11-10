import { useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Home, Car } from 'lucide-react-native'
import { useAssetPrompt } from '@/hooks/useAssetPrompt'
import { AddAccountSheet } from '@/components/accounts/AddSheet'
import { colors } from '@/lib/colors'

/** "Your home is missing from your net worth": one quiet card per gap, at the top of Accounts. Mirrors the website's card. */
export function AssetPromptCard() {
    const { gaps, answer } = useAssetPrompt()
    const [adding, setAdding] = useState<string | null>(null)
    if (gaps.length === 0 && !adding) return null
    return (
        <>
            {gaps.map((g) => (
                <View key={g.kind} className="rounded-xl border border-brand-border bg-brand-surface p-4">
                    <View className="flex-row gap-x-3">
                        <View className="w-8 h-8 rounded-full bg-brand-accent/10 items-center justify-center mt-0.5">
                            {g.kind === 'home' ? <Home size={16} color={colors.accent} /> : <Car size={16} color={colors.accent} />}
                        </View>
                        <View className="flex-1">
                            <Text className="text-brand-text text-sm font-semibold">{g.title}</Text>
                            <Text className="text-brand-muted text-sm mt-0.5 leading-5">{g.detail}</Text>
                            <View className="flex-row items-center flex-wrap gap-x-4 gap-y-2 mt-3">
                                <TouchableOpacity onPress={() => setAdding(g.choice)} className="bg-brand-accent rounded-lg px-3.5 py-2" accessibilityRole="button">
                                    <Text className="text-white text-sm font-semibold">{g.button}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => answer.mutate({ kind: g.kind, answer: 'later' })} hitSlop={8} accessibilityRole="button">
                                    <Text className="text-brand-text text-sm font-medium">Not now</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => answer.mutate({ kind: g.kind, answer: 'never' })} hitSlop={8} accessibilityRole="button">
                                    <Text className="text-brand-muted text-sm">Don't ask again</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            ))}
            {/* Mounted only while adding, so it opens on the manual form with the home / vehicle type already chosen */}
            {adding && <AddAccountSheet visible initialType={adding} onClose={() => setAdding(null)} />}
        </>
    )
}
