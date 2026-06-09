import { fetch as expoFetch } from 'expo/fetch'
import { useAuthStore } from './auth-store'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export interface ChatTurn {
    role: 'user' | 'assistant'
    content: string
}

/**
 * Streams the assistant's reply as plain text chunks. Calls onDelta for each
 * chunk; resolves with the full reply when the stream ends.
 */
export async function streamChat(
    messages: ChatTurn[],
    onDelta: (text: string) => void,
    signal?: AbortSignal
): Promise<string> {
    const token = useAuthStore.getState().token

    const res = await expoFetch(`${API_BASE_URL}/api/mobile/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages }),
        signal,
    })

    if (!res.ok || !res.body) {
        let message = 'Something went wrong. Please try again.'
        try {
            const body = await res.json()
            if (body?.error) message = body.error
        } catch {
            // non-JSON error body — keep the generic message
        }
        throw new Error(message)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let full = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        if (chunk) {
            full += chunk
            onDelta(chunk)
        }
    }

    return full
}
