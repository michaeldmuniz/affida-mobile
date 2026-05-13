import { View, Text, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Plus, ChevronLeft, Zap } from 'lucide-react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useRouter } from 'expo-router'
import { apiClient } from '@/lib/api-client'
import { RuleEditSheet } from '@/components/rules/EditSheet'
import type { Rule } from '@/lib/types'

function ruleDescription(rule: Rule): string {
    const parts: string[] = []
    if (rule.containsText) parts.push(`"${rule.containsText}"`)
    if (rule.amountType === 'DEBIT') parts.push('expense')
    if (rule.amountType === 'CREDIT') parts.push('income')
    if (rule.amountMin != null && rule.amountMax != null) parts.push(`$${rule.amountMin}–$${rule.amountMax}`)
    else if (rule.amountMin != null) parts.push(`over $${rule.amountMin}`)
    else if (rule.amountMax != null) parts.push(`under $${rule.amountMax}`)
    return parts.join(', ') || 'No conditions'
}

export default function RulesScreen() {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [editing, setEditing] = useState<Rule | 'new' | null>(null)

    const { data: rules, isLoading } = useQuery<Rule[]>({
        queryKey: ['rules'],
        queryFn: async () => (await apiClient.get('/rules')).data.data,
    })

    const { mutate: toggleEnabled } = useMutation({
        mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
            await apiClient.patch(`/rules/${id}`, { enabled })
        },
        onMutate: async ({ id, enabled }) => {
            await queryClient.cancelQueries({ queryKey: ['rules'] })
            const prev = queryClient.getQueryData<Rule[]>(['rules'])
            queryClient.setQueryData<Rule[]>(['rules'], old =>
                old?.map(r => r.id === id ? { ...r, enabled } : r)
            )
            return { prev }
        },
        onError: (_e, _v, ctx) => {
            queryClient.setQueryData(['rules'], ctx?.prev)
        },
    })

    const handleDelete = (rule: Rule) => {
        Alert.alert('Delete Rule', `Delete the rule for "${rule.category.name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await apiClient.delete(`/rules/${rule.id}`)
                        queryClient.invalidateQueries({ queryKey: ['rules'] })
                    } catch {
                        Alert.alert('Error', 'Failed to delete rule.')
                    }
                },
            },
        ])
    }

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top']}>
            {/* Header */}
            <View className="flex-row items-center px-4 pt-4 pb-3">
                <TouchableOpacity onPress={() => router.back()} hitSlop={8} className="w-8">
                    <ChevronLeft size={22} color="#6B7280" />
                </TouchableOpacity>
                <Text className="flex-1 text-center text-brand-text text-lg font-bold">Rules</Text>
                <TouchableOpacity onPress={() => setEditing('new')} hitSlop={8} className="w-8 items-end">
                    <Plus size={22} color="#5B7BF8" />
                </TouchableOpacity>
            </View>

            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <View className="px-4 pb-8">
                    {isLoading ? (
                        <View className="items-center py-16">
                            <ActivityIndicator color="#5B7BF8" />
                        </View>
                    ) : !rules?.length ? (
                        <View className="items-center py-16 gap-y-3">
                            <View className="w-14 h-14 rounded-2xl bg-brand-surface border border-brand-border items-center justify-center">
                                <Zap size={24} color="#6B7280" strokeWidth={1.5} />
                            </View>
                            <Text className="text-brand-text font-semibold">No rules yet</Text>
                            <Text className="text-brand-muted text-sm text-center leading-relaxed px-8">
                                Rules automatically categorize transactions when they match your conditions.
                            </Text>
                            <TouchableOpacity
                                className="bg-brand-accent px-6 py-3 rounded-xl mt-2"
                                onPress={() => setEditing('new')}
                                activeOpacity={0.85}
                            >
                                <Text className="text-white font-semibold text-sm">Create your first rule</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <View className="gap-y-2 pt-2">
                            {rules.map(rule => (
                                <TouchableOpacity
                                    key={rule.id}
                                    className="bg-brand-surface border border-brand-border rounded-2xl px-4 py-4"
                                    onPress={() => setEditing(rule)}
                                    onLongPress={() => handleDelete(rule)}
                                    activeOpacity={0.7}
                                >
                                    <View className="flex-row items-start">
                                        <View className="flex-1 pr-3">
                                            {/* Category (action) */}
                                            <View className="flex-row items-center gap-x-1.5 mb-1">
                                                <View className="w-2 h-2 rounded-full bg-brand-accent" />
                                                <Text className="text-brand-text text-sm font-semibold">
                                                    {rule.category.name}
                                                </Text>
                                            </View>
                                            {/* Conditions */}
                                            <Text className="text-brand-muted text-xs leading-relaxed">
                                                {ruleDescription(rule)}
                                            </Text>
                                        </View>
                                        <Switch
                                            value={rule.enabled}
                                            onValueChange={enabled => toggleEnabled({ id: rule.id, enabled })}
                                            trackColor={{ false: '#2A2A38', true: '#5B7BF8' }}
                                            thumbColor="#fff"
                                        />
                                    </View>
                                </TouchableOpacity>
                            ))}
                            <Text className="text-brand-muted text-xs text-center mt-2">
                                Long press a rule to delete it
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            <RuleEditSheet rule={editing} onClose={() => setEditing(null)} />
        </SafeAreaView>
    )
}
