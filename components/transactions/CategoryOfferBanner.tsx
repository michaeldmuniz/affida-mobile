import { useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { X } from 'lucide-react-native'
import { apiClient } from '@/lib/api-client'
import { colors } from '@/lib/colors'
import type { CategoryOffer } from './CategoryOfferSheet'

const plainBankLabel = (k: string) => { const w = k.toLowerCase().split('_').filter(Boolean).join(' '); return w.charAt(0).toUpperCase() + w.slice(1) }
const SHOW_MS = 20000

/**
 * The small notification that offers "file these automatically?" after the same change has been made a few times. It never
 * opens the full sheet by itself: "Review" does. Ignoring it is fine and is never nagged about: letting it go away counts as
 * "Not now" (the question comes back only after 3 more such changes). Same wording as the website's notification.
 */
export function CategoryOfferBanner({ offer, onReview, onGone }: { offer: CategoryOffer | null; onReview: (offer: CategoryOffer) => void; onGone: () => void }) {
    const handled = useRef(false)
    const id = offer?.correctionId

    const notNow = () => {
        if (!offer || handled.current) return
        handled.current = true
        apiClient.post('/category-offer', { correctionId: offer.correctionId, rule: false, mapping: false, past: false }).catch(() => {})
        onGone()
    }
    useEffect(() => {
        handled.current = false
        if (!id) return
        const timer = setTimeout(notNow, SHOW_MS)
        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id])

    if (!offer) return null
    const subject = offer.narrow ? `"${offer.narrow.text}"` : `everything your bank calls "${plainBankLabel(offer.plaidCategory)}"`
    return (
        <View pointerEvents="box-none" style={{ position: 'absolute', left: 16, right: 16, bottom: 16 }}>
            <View className="rounded-2xl border border-brand-border bg-brand-elevated p-3 flex-row items-center">
                <View className="flex-1 pr-3">
                    <Text className="text-brand-text text-sm font-semibold" numberOfLines={2}>File {subject} under {offer.newCategoryName} automatically?</Text>
                    <Text className="text-brand-muted text-xs mt-0.5" numberOfLines={2}>
                        {offer.narrow ? 'Review to make it a rule and choose which past ones to change.' : 'Review to save it as a mapping.'}
                    </Text>
                </View>
                <TouchableOpacity
                    onPress={() => { handled.current = true; onReview(offer) }}
                    activeOpacity={0.8}
                    className="h-9 px-4 rounded-xl bg-brand-accent items-center justify-center mr-2"
                    accessibilityLabel="Review"
                >
                    <Text className="text-white text-sm font-semibold">Review</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={notNow} hitSlop={10} accessibilityLabel="Not now"><X size={18} color={colors.muted} /></TouchableOpacity>
            </View>
        </View>
    )
}
