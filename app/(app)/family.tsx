import { useState } from 'react'
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Plus, Users } from 'lucide-react-native'
import { apiClient } from '@/lib/api-client'
import type { Child } from '@/lib/types'
import { colors } from '@/lib/colors'
import { haptics } from '@/lib/haptics'
import { Card } from '@/components/ui/Card'
import { AmountText } from '@/components/ui/AmountText'
import { KidAvatar } from '@/components/family/KidAvatar'
import { ChildEditSheet } from '@/components/family/ChildEditSheet'
import { WalletSheet } from '@/components/family/WalletSheet'

export default function FamilyScreen() {
    const router = useRouter()
    const [editing, setEditing] = useState<Child | 'new' | null>(null)
    const [openChildId, setOpenChildId] = useState<string | null>(null)

    const { data: kids, isLoading, refetch, isRefetching } = useQuery<Child[]>({
        queryKey: ['family'],
        queryFn: async () => (await apiClient.get('/family/children')).data.data,
        staleTime: 60 * 1000,
    })

    // iOS can't present a sheet while another is still animating closed.
    const switchToEdit = (child: Child) => {
        setOpenChildId(null)
        setTimeout(() => setEditing(child), 400)
    }

    const total = kids?.reduce((s, k) => s + k.balance, 0) ?? 0

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.accent} />}
            >
                <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
                    <View className="flex-row items-center gap-x-2">
                        <TouchableOpacity onPress={() => router.back()} hitSlop={8} className="-ml-2">
                            <ChevronLeft size={24} color={colors.muted} />
                        </TouchableOpacity>
                        <Text className="text-brand-text text-2xl font-bold">Family</Text>
                    </View>
                    <TouchableOpacity
                        className="w-9 h-9 rounded-full bg-brand-surface border border-brand-border items-center justify-center"
                        onPress={() => { haptics.medium(); setEditing('new') }}
                    >
                        <Plus size={18} color={colors.accent} strokeWidth={2} />
                    </TouchableOpacity>
                </View>

                <View className="px-6 gap-y-3 pb-8 pt-4">
                    {isLoading ? (
                        [1, 2].map((i) => (
                            <Card key={i} className="flex-row items-center gap-x-3 p-4">
                                <View className="w-11 h-11 rounded-full bg-brand-elevated" />
                                <View className="flex-1 gap-y-2">
                                    <View className="h-3.5 w-24 bg-brand-elevated rounded" />
                                    <View className="h-2.5 w-12 bg-brand-elevated rounded" />
                                </View>
                                <View className="h-4 w-16 bg-brand-elevated rounded" />
                            </Card>
                        ))
                    ) : !kids || kids.length === 0 ? (
                        <View className="items-center py-16">
                            <View className="w-14 h-14 rounded-2xl bg-brand-surface border border-brand-border items-center justify-center mb-4">
                                <Users size={24} color={colors.muted} strokeWidth={1.5} />
                            </View>
                            <Text className="text-brand-text font-semibold mb-1">No kids added yet</Text>
                            <Text className="text-brand-muted text-sm text-center leading-relaxed px-8 mb-5">
                                Give each kid a wallet. Log allowance and gifts, and track what they spend.
                            </Text>
                            <TouchableOpacity
                                onPress={() => { haptics.medium(); setEditing('new') }}
                                className="flex-row items-center gap-x-2 bg-brand-accent rounded-xl px-5 h-11"
                            >
                                <Plus size={16} color="#fff" strokeWidth={2.2} />
                                <Text className="text-white font-semibold">Add your first kid</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <>
                            {kids.length > 1 && (
                                <Card className="p-5 mb-2">
                                    <Text className="text-brand-muted text-xs uppercase tracking-widest mb-2">All wallets</Text>
                                    <AmountText amount={total} size="lg" neutral />
                                </Card>
                            )}
                            {kids.map((kid) => {
                                const age = kid.birthYear ? new Date().getFullYear() - kid.birthYear : null
                                return (
                                    <TouchableOpacity key={kid.id} activeOpacity={0.7} onPress={() => { haptics.light(); setOpenChildId(kid.id) }}>
                                        <Card className="flex-row items-center gap-x-3 p-4">
                                            <KidAvatar name={kid.name} color={kid.color} />
                                            <View className="flex-1">
                                                <Text className="text-brand-text text-base font-semibold" numberOfLines={1}>{kid.name}</Text>
                                                <Text className="text-brand-muted text-xs mt-0.5">{age !== null ? `Age ${age}` : 'Wallet'}</Text>
                                            </View>
                                            <AmountText amount={kid.balance} size="md" neutral className="font-semibold" />
                                            <ChevronRight size={14} color={colors.disabled} style={{ marginLeft: 4 }} />
                                        </Card>
                                    </TouchableOpacity>
                                )
                            })}
                        </>
                    )}
                </View>
            </ScrollView>

            <ChildEditSheet child={editing} onClose={() => setEditing(null)} />
            <WalletSheet childId={openChildId} onClose={() => setOpenChildId(null)} onEdit={switchToEdit} />
        </SafeAreaView>
    )
}
