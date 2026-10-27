// Which account from the bank a person just linked is their manual account. Mirrors
// guessClaimedAccount in the web repo (lib/plaid-account-type.ts): keep them in step.

export interface LinkedAccount { id: string; name: string; mask?: string | null; type?: string | null; subtype?: string | null }

function kindOf(a: Pick<LinkedAccount, 'type' | 'subtype'>): string {
    const type = String(a.type ?? '').toLowerCase()
    const sub = String(a.subtype ?? '').toLowerCase()
    if (type === 'depository') return sub === 'savings' ? 'SAVINGS' : 'CHECKING'
    if (type === 'credit') return sub === 'line of credit' ? 'LINE_OF_CREDIT' : 'CREDIT_CARD'
    if (type === 'investment') return 'INVESTMENT'
    if (type === 'loan') return 'LOAN'
    return 'OTHER'
}

const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 1))

/** The bank account that most likely is `manual`, or null when nothing fits. */
export function guessClaimedAccount(manual: { name: string; type: string }, linked: LinkedAccount[]): LinkedAccount | null {
    if (linked.length === 0) return null
    if (linked.length === 1) return linked[0]
    const sameKind = linked.filter(l => kindOf(l) === manual.type)
    if (sameKind.length === 1) return sameKind[0]
    const mine = words(manual.name)
    let best: { acc: LinkedAccount; score: number } | null = null
    for (const l of sameKind.length ? sameKind : linked) {
        const shared = [...mine].filter(w => words(l.name).has(w)).length
        if (shared > 0 && (!best || shared > best.score)) best = { acc: l, score: shared }
    }
    return best?.acc ?? null
}
