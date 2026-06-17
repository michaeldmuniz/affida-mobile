import { useRef, useState, useCallback } from 'react'
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { ChevronLeft, Sparkles, ArrowUp } from 'lucide-react-native'
import { useRouter } from 'expo-router'
import { streamChat } from '@/lib/chat-api'
import { haptics } from '@/lib/haptics'
import type { ChatMessage } from '@/lib/types'
import { colors } from '@/lib/colors'

const SUGGESTIONS = [
    'How much did I spend on dining this month?',
    'What are my biggest expenses this month?',
    'How are my savings goals doing?',
    'Compare my spending this month vs last month',
]

export default function AssistantScreen() {
    const router = useRouter()
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [isStreaming, setIsStreaming] = useState(false)
    const scrollRef = useRef<ScrollView>(null)
    const scrollPending = useRef(false)

    // Coalesce bursts of scroll requests (one per streaming delta) into a single
    // scroll per frame so the JS thread isn't flooded during fast streams.
    const scrollToEnd = useCallback(() => {
        if (scrollPending.current) return
        scrollPending.current = true
        requestAnimationFrame(() => {
            scrollPending.current = false
            scrollRef.current?.scrollToEnd({ animated: true })
        })
    }, [])

    const send = useCallback(
        async (text: string) => {
            const trimmed = text.trim()
            if (!trimmed || isStreaming) return

            haptics.medium()
            setInput('')

            const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: trimmed }
            const assistantId = `a-${Date.now()}`
            const history = [...messages, userMsg]

            setMessages([...history, { id: assistantId, role: 'assistant', content: '' }])
            setIsStreaming(true)
            scrollToEnd()

            try {
                await streamChat(
                    history.map((m) => ({ role: m.role, content: m.content })),
                    (delta) => {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === assistantId ? { ...m, content: m.content + delta } : m
                            )
                        )
                        scrollToEnd()
                    }
                )
                haptics.light()
            } catch (err: any) {
                haptics.error()
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === assistantId
                            ? { ...m, content: err?.message || 'Something went wrong. Please try again.' }
                            : m
                    )
                )
            } finally {
                setIsStreaming(false)
                scrollToEnd()
            }
        },
        [messages, isStreaming, scrollToEnd]
    )

    return (
        <SafeAreaView className="flex-1 bg-brand-bg" edges={['top', 'bottom']}>
            {/* Header */}
            <View className="flex-row items-center px-4 pt-4 pb-3 border-b border-brand-border">
                <TouchableOpacity onPress={() => router.back()} hitSlop={8} className="w-8">
                    <ChevronLeft size={22} color={colors.muted} />
                </TouchableOpacity>
                <View className="flex-1 flex-row items-center justify-center gap-x-2">
                    <Sparkles size={16} color={colors.accent} strokeWidth={2} />
                    <Text className="text-brand-text text-lg font-bold">Assistant</Text>
                </View>
                <View className="w-8" />
            </View>

            <KeyboardAvoidingView
                className="flex-1"
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                keyboardVerticalOffset={0}
            >
                <ScrollView
                    ref={scrollRef}
                    className="flex-1"
                    contentContainerStyle={{ padding: 20, paddingBottom: 12 }}
                    showsVerticalScrollIndicator={false}
                    onContentSizeChange={scrollToEnd}
                >
                    {messages.length === 0 ? (
                        <View className="pt-10">
                            <View className="items-center mb-8">
                                <View className="w-16 h-16 rounded-3xl bg-brand-accent/15 items-center justify-center mb-4">
                                    <Sparkles size={28} color={colors.accent} strokeWidth={1.8} />
                                </View>
                                <Text className="text-brand-text text-xl font-bold mb-1.5">
                                    Ask me anything
                                </Text>
                                <Text className="text-brand-muted text-sm text-center px-8 leading-relaxed">
                                    I can answer questions about your spending, accounts, budgets, and goals.
                                </Text>
                            </View>
                            <View className="gap-y-2.5">
                                {SUGGESTIONS.map((s) => (
                                    <TouchableOpacity
                                        key={s}
                                        onPress={() => send(s)}
                                        activeOpacity={0.7}
                                        className="bg-brand-surface border border-brand-border rounded-2xl px-4 py-3.5"
                                    >
                                        <Text className="text-brand-text text-sm">{s}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    ) : (
                        <View className="gap-y-4">
                            {messages.map((m) => (
                                <MessageBubble
                                    key={m.id}
                                    message={m}
                                    streaming={isStreaming && m.content === '' && m.role === 'assistant'}
                                />
                            ))}
                        </View>
                    )}
                </ScrollView>

                {/* Input bar */}
                <View className="flex-row items-end gap-x-2 px-4 py-3 border-t border-brand-border bg-brand-bg">
                    <View className="flex-1 bg-brand-surface border border-brand-border rounded-2xl px-4 py-1">
                        <TextInput
                            className="text-brand-text text-base py-2.5 max-h-28"
                            placeholder="Ask about your money…"
                            placeholderTextColor={colors.muted}
                            value={input}
                            onChangeText={setInput}
                            multiline
                            editable={!isStreaming}
                            onSubmitEditing={() => send(input)}
                            returnKeyType="send"
                        />
                    </View>
                    <TouchableOpacity
                        onPress={() => send(input)}
                        disabled={!input.trim() || isStreaming}
                        activeOpacity={0.8}
                        className={`w-11 h-11 rounded-full items-center justify-center ${
                            input.trim() && !isStreaming ? 'bg-brand-accent' : 'bg-brand-elevated'
                        }`}
                    >
                        {isStreaming ? (
                            <ActivityIndicator size="small" color={colors.muted} />
                        ) : (
                            <ArrowUp size={20} color={input.trim() ? '#FFFFFF' : colors.muted} strokeWidth={2.5} />
                        )}
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    )
}

function MessageBubble({ message, streaming }: { message: ChatMessage; streaming: boolean }) {
    if (message.role === 'user') {
        return (
            <View className="items-end">
                <View className="bg-brand-accent rounded-2xl rounded-br-md px-4 py-3 max-w-[85%]">
                    <Text className="text-white text-[15px] leading-relaxed">{message.content}</Text>
                </View>
            </View>
        )
    }

    return (
        <View className="items-start">
            <View className="bg-brand-surface border border-brand-border rounded-2xl rounded-bl-md px-4 py-3 max-w-[90%]">
                {streaming ? (
                    <View className="flex-row items-center gap-x-2 py-1">
                        <ActivityIndicator size="small" color={colors.accent} />
                        <Text className="text-brand-muted text-sm">Looking at your finances…</Text>
                    </View>
                ) : (
                    <Text className="text-brand-text text-[15px] leading-relaxed">{message.content}</Text>
                )}
            </View>
        </View>
    )
}
