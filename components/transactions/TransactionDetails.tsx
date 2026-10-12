import { View, Text, Image, TouchableOpacity, Linking } from 'react-native'
import { ExternalLink, MapPin, Landmark, Link2, RotateCcw } from 'lucide-react-native'
import { AmountText } from '@/components/ui/AmountText'
import { colors } from '@/lib/colors'
import { shortDay } from '@/lib/format'
import type { ConnectedTransaction, TransactionDetail } from '@/lib/types'

// Plaid sends codes like FOOD_AND_DRINK_COFFEE: show them as "Food And Drink Coffee"
const titleCase = (s: string) => s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())

const open = (url: string) => { Linking.openURL(url).catch(() => {}) }

function Label({ children }: { children: string }) {
    return <Text className="text-brand-muted text-xs font-semibold uppercase tracking-widest mb-2">{children}</Text>
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <View className="flex-row justify-between gap-x-4 py-1.5">
            <Text className="text-brand-muted text-sm">{label}</Text>
            <Text className="flex-1 text-right text-brand-text text-sm" selectable>{value}</Text>
        </View>
    )
}

function Connected({ tag, tx }: { tag: string; tx: ConnectedTransaction }) {
    return (
        <View className="flex-row items-center px-4 py-3 gap-x-3">
            <View className="flex-1">
                <View className="flex-row items-center gap-x-2">
                    <View className="bg-brand-elevated rounded-full px-2 py-0.5">
                        <Text className="text-brand-muted text-[10px] font-medium">{tag}</Text>
                    </View>
                    <Text className="flex-1 text-brand-text text-sm font-medium" numberOfLines={1}>{tx.label}</Text>
                </View>
                <Text className="text-brand-muted text-xs mt-0.5" numberOfLines={1}>{shortDay(tx.date.slice(0, 10))} · {tx.accountName}</Text>
            </View>
            <AmountText amount={tx.amount} size="sm" showSign />
        </View>
    )
}

function ActionButton({ icon, label, onPress, disabled, quiet }: {
    icon?: React.ReactNode; label: string; onPress: () => void; disabled?: boolean; quiet?: boolean
}) {
    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.7}
            className={`flex-row items-center gap-x-1.5 rounded-lg px-3 h-9 ${quiet ? '' : 'border border-brand-border bg-brand-surface'} ${disabled ? 'opacity-50' : ''}`}
        >
            {icon}
            <Text className={`text-sm font-medium ${quiet ? 'text-brand-muted' : 'text-brand-text'}`}>{label}</Text>
        </TouchableOpacity>
    )
}

interface DetailsProps {
    detail: TransactionDetail
    /** A link/refund change is in flight. */
    busy?: boolean
    onLink: () => void
    onUnlink: () => void
    onMarkRefund: () => void
    onRemoveRefund: () => void
}

/** The bank-synced summary, location, payment, counterparties, links/refunds and splits: the same sections as the web dialog. */
export function TransactionDetails({ detail, busy, onLink, onUnlink, onMarkRefund, onRemoveRefund }: DetailsProps) {
    const loc = detail.location
    const hasLocation = !!(loc.address || loc.city)
    const hasPayment = !!(detail.payment.method || detail.payment.processor || detail.payment.reference)
    const hasBankInfo = !!(
        detail.logoUrl || detail.website || detail.plaidCategory || detail.checkNumber ||
        (detail.currency && detail.currency !== 'USD') || hasLocation || hasPayment || detail.counterparties.length > 0
    )
    const connected: { tag: string; tx: ConnectedTransaction }[] = [
        ...detail.linked.map(tx => ({ tag: 'Linked', tx })),
        ...(detail.refundOf ? [{ tag: 'Refund of', tx: detail.refundOf }] : []),
        ...detail.refundedBy.map(tx => ({ tag: 'Refunded by', tx })),
        ...(detail.splitFrom ? [{ tag: 'Split from', tx: detail.splitFrom }] : []),
        ...detail.splitInto.map(tx => ({ tag: tx.categoryName ?? 'Split', tx })),
    ]

    return (
        <>
            {/* Links, refunds and splits */}
            <View className="px-4 pt-5 pb-2">
                <Label>Links &amp; Refunds</Label>
                {connected.length > 0 ? (
                    <View className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden">
                        {connected.map((c, i) => (
                            <View key={`${c.tag}-${c.tx.id}`} className={i > 0 ? 'border-t border-brand-border' : ''}>
                                <Connected tag={c.tag} tx={c.tx} />
                            </View>
                        ))}
                    </View>
                ) : (
                    <Text className="text-brand-muted text-sm">Not connected to any other transaction.</Text>
                )}
                <View className="flex-row flex-wrap gap-2 mt-3">
                    <ActionButton icon={<Link2 size={14} color={colors.muted} />} label="Link related transaction" onPress={onLink} disabled={busy} />
                    {detail.linked.length > 0 && <ActionButton label="Unlink" onPress={onUnlink} disabled={busy} quiet />}
                    {detail.refundOf
                        ? <ActionButton label="Remove refund link" onPress={onRemoveRefund} disabled={busy} quiet />
                        : <ActionButton icon={<RotateCcw size={14} color={colors.muted} />} label="Mark as refund of…" onPress={onMarkRefund} disabled={busy} />}
                </View>
            </View>

            {/* Bank details */}
            {detail.isSynced && hasBankInfo && (
                <View className="px-4 pt-5 pb-2">
                    <Label>Transaction Details</Label>
                    <View className="bg-brand-surface border border-brand-border rounded-xl px-4 py-2">
                        {(detail.logoUrl || detail.website) && (
                            <View className="flex-row items-center gap-x-3 py-2">
                                {detail.logoUrl && (
                                    <Image source={{ uri: detail.logoUrl }} style={{ width: 32, height: 32, borderRadius: 6 }} resizeMode="contain" />
                                )}
                                {detail.website && (
                                    <TouchableOpacity className="flex-row items-center gap-x-1" onPress={() => open(`https://${detail.website}`)} hitSlop={6}>
                                        <Text className="text-brand-accent text-sm">{detail.website}</Text>
                                        <ExternalLink size={12} color={colors.accent} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                        {detail.plaidCategory && (
                            <Row label="Bank category" value={titleCase(detail.plaidCategory) + (detail.plaidCategoryConfidence ? ` · ${titleCase(detail.plaidCategoryConfidence)}` : '')} />
                        )}
                        {detail.checkNumber && <Row label="Check #" value={detail.checkNumber} />}
                        {detail.currency && detail.currency !== 'USD' && <Row label="Currency" value={detail.currency} />}

                        {hasLocation && (
                            <View className="py-2 border-t border-brand-border mt-1">
                                <Text className="text-brand-muted text-sm mb-1">Location</Text>
                                {loc.address && <Text className="text-brand-text text-sm">{loc.address}</Text>}
                                {(loc.city || loc.region || loc.postalCode) && (
                                    <Text className="text-brand-text text-sm">{[loc.city, loc.region, loc.postalCode].filter(Boolean).join(', ')}</Text>
                                )}
                                {loc.country && loc.country !== 'US' && <Text className="text-brand-text text-sm">{loc.country}</Text>}
                                {loc.storeNumber && <Text className="text-brand-muted text-xs mt-0.5">Store #{loc.storeNumber}</Text>}
                                {loc.lat != null && loc.lon != null && (
                                    <TouchableOpacity className="flex-row items-center gap-x-1 mt-2 self-start" onPress={() => open(`https://maps.google.com/?q=${loc.lat},${loc.lon}`)} hitSlop={6}>
                                        <MapPin size={13} color={colors.accent} />
                                        <Text className="text-brand-accent text-sm">View on map</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}

                        {hasPayment && (
                            <View className="py-2 border-t border-brand-border mt-1">
                                <Text className="text-brand-muted text-sm mb-0.5">Payment</Text>
                                {detail.payment.method && <Row label="Method" value={detail.payment.method} />}
                                {detail.payment.processor && <Row label="Processor" value={detail.payment.processor} />}
                                {detail.payment.reference && <Row label="Reference" value={detail.payment.reference} />}
                            </View>
                        )}

                        {detail.counterparties.length > 0 && (
                            <View className="py-2 border-t border-brand-border mt-1">
                                <Text className="text-brand-muted text-sm mb-1">Counterparties</Text>
                                {detail.counterparties.map((cp, i) => (
                                    <View key={`${cp.name}-${i}`} className="flex-row items-center gap-x-2 py-1">
                                        {cp.logoUrl && <Image source={{ uri: cp.logoUrl }} style={{ width: 20, height: 20, borderRadius: 4 }} resizeMode="contain" />}
                                        <Text className="flex-1 text-brand-text text-sm">
                                            {cp.name}
                                            {cp.type ? <Text className="text-brand-muted text-xs">{`  ${titleCase(cp.type).toLowerCase()}`}</Text> : null}
                                        </Text>
                                        {cp.website && (
                                            <TouchableOpacity onPress={() => open(`https://${cp.website}`)} hitSlop={6}>
                                                <ExternalLink size={13} color={colors.accent} />
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                </View>
            )}
        </>
    )
}

/** Top-of-sheet summary for a bank-synced transaction: the bank owns the amount and date. */
export function SyncedSummary({ detail }: { detail: TransactionDetail }) {
    return (
        <View className="px-4 pt-6 pb-2">
            <View className="bg-brand-surface border border-brand-border rounded-xl px-4 py-3">
                <View className="flex-row items-baseline justify-between">
                    <AmountText amount={detail.amount} size="lg" showSign />
                    <Text className="text-brand-muted text-sm">
                        {shortDay(detail.date.slice(0, 10))}{detail.pending ? ' · Pending' : ''}
                    </Text>
                </View>
                <View className="flex-row items-center gap-x-1.5 mt-2">
                    <Landmark size={12} color={colors.muted} />
                    <Text className="flex-1 text-brand-muted text-xs">
                        Synced from {detail.accountName}. The bank sets the amount; the date below is yours to change.
                    </Text>
                </View>
            </View>
        </View>
    )
}
