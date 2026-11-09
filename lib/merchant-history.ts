import type { MerchantSeries } from '@/lib/types'

// The same small helpers the website's Top Payees report uses (lib/merchant-history.ts there). The server does
// the heavy lifting (refunds netted, splits counted once, spellings of a store combined); this only reads it.

const norm = (s: string) => s.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()

/** Every word typed must appear in the name or one of its spellings; names starting with the text come first. */
export function searchMerchants(list: MerchantSeries[], query: string): MerchantSeries[] {
    const q = norm(query)
    if (!q) return list
    const words = q.split(' ')
    const hits: { m: MerchantSeries; starts: boolean }[] = []
    for (const m of list) {
        const names = [m.name, ...m.variants].map(norm)
        if (!names.some(n => words.every(w => n.includes(w)))) continue
        hits.push({ m, starts: names.some(n => n.startsWith(q)) })
    }
    return hits.sort((a, b) => Number(b.starts) - Number(a.starts) || b.m.total - a.m.total).map(h => h.m)
}

export function merchantStats(m: MerchantSeries, from: number, to: number) {
    let spent = 0
    let visits = 0
    let largest = 0
    for (let i = from; i <= to; i++) {
        spent += m.amounts[i] ?? 0
        visits += m.visits[i] ?? 0
        largest = Math.max(largest, m.largest[i] ?? 0)
    }
    return { spent: Math.round(spent * 100) / 100, visits, average: visits > 0 ? spent / visits : null, largest }
}

export function percentChange(now: number, before: number): number | null {
    if (before <= 0.005) return null
    return ((now - before) / before) * 100
}
