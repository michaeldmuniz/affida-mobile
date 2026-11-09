import type { Transaction } from '@/lib/types'

/** One line of the transactions list. A split purchase is one unit: a header with the whole purchase, then its parts. */
export type ListRow = {
    key: string
    tx: Transaction
    kind: 'single' | 'header' | 'part'
    /** header: the whole purchase (all parts added up) */
    total?: number
    partCount?: number
    partNo?: number
    /** part: the original it belongs to */
    header?: Transaction
}

/** The original's own part followed by its other parts, each as a full Transaction the edit sheet can open. */
export function splitParts(header: Transaction): Transaction[] {
    const kids = (header.splitChildren ?? []).map<Transaction>(c => ({
        ...header,
        id: c.id,
        amount: c.amount,
        date: c.date,
        description: c.description,
        merchantName: c.merchantName,
        categoryId: c.categoryId,
        categoryName: c.categoryName,
        categoryGroup: c.categoryGroup,
        notes: c.notes,
        flagged: c.flagged,
        pending: c.pending,
        splitFromId: header.id,
        splitChildren: undefined,
    }))
    return [{ ...header, splitChildren: undefined }, ...kids]
}

/**
 * Turns the loaded transactions into list rows: each split's parts sit directly under their original and are not listed
 * again on their own. A part whose original isn't loaded (other page, filtered out) stays a normal row.
 */
export function groupSplits(txs: Transaction[]): ListRow[] {
    const ids = new Set(txs.map(t => t.id))
    const out: ListRow[] = []
    for (const tx of txs) {
        if (tx.splitFromId && ids.has(tx.splitFromId)) continue
        const kids = tx.splitChildren ?? []
        if (kids.length === 0) { out.push({ key: tx.id, tx, kind: 'single' }); continue }
        const parts = splitParts(tx)
        out.push({ key: tx.id, tx, kind: 'header', total: parts.reduce((n, p) => n + p.amount, 0), partCount: parts.length })
        parts.forEach((p, i) => out.push({ key: `${tx.id}:${p.id}`, tx: p, kind: 'part', header: tx, partNo: i + 1, partCount: parts.length }))
    }
    return out
}

/** The split an open transaction belongs to (whole amount and every part), or null when it isn't split or its original isn't loaded. */
export function splitFamily(txs: Transaction[], open: Transaction | null) {
    if (!open) return null
    const header = txs.find(t => t.id === (open.splitFromId ?? open.id))
    if (!header || !(header.splitChildren?.length)) return null
    const parts = splitParts(header)
    return { total: parts.reduce((n, p) => n + p.amount, 0), parts }
}

export function money(n: number): string {
    return `${n < 0 ? '\u2212' : ''}${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n))}`
}
