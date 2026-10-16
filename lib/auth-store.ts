import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import * as SecureStore from 'expo-secure-store'
import type { MobileUser } from './types'
import { queryClient } from './query-client'

const secureStorage = {
    getItem: (name: string) => SecureStore.getItemAsync(name),
    setItem: (name: string, value: string) => SecureStore.setItemAsync(name, value),
    removeItem: (name: string) => SecureStore.deleteItemAsync(name),
}

interface AuthState {
    token: string | null
    user: MobileUser | null
    expiresAt: string | null
    _hasHydrated: boolean
    setHasHydrated: (state: boolean) => void
    setAuth: (token: string, user: MobileUser, expiresAt: string) => void
    clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            user: null,
            expiresAt: null,
            _hasHydrated: false,
            setHasHydrated: (state) => set({ _hasHydrated: state }),
            setAuth: (token, user, expiresAt) => {
                // Signing in as someone else must not show the previous account's cached data.
                const prev = get().user
                if (prev && prev.id !== user.id) queryClient.clear()
                set({ token, user, expiresAt })
            },
            clearAuth: () => {
                // Drop every cached server response so the next account starts clean.
                queryClient.clear()
                set({ token: null, user: null, expiresAt: null })
            },
        }),
        {
            name: 'affida-auth',
            storage: createJSONStorage(() => secureStorage),
            partialize: (state) => ({
                token: state.token,
                user: state.user,
                expiresAt: state.expiresAt,
            }),
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true)
            },
        }
    )
)
