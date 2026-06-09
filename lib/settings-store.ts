import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import * as SecureStore from 'expo-secure-store'

const secureStorage = {
    getItem: (name: string) => SecureStore.getItemAsync(name),
    setItem: (name: string, value: string) => SecureStore.setItemAsync(name, value),
    removeItem: (name: string) => SecureStore.deleteItemAsync(name),
}

interface SettingsState {
    /** Require Face ID / Touch ID / passcode when the app opens or returns from background */
    appLockEnabled: boolean
    _hasHydrated: boolean
    setAppLockEnabled: (enabled: boolean) => void
    setHasHydrated: (state: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            appLockEnabled: false,
            _hasHydrated: false,
            setAppLockEnabled: (enabled) => set({ appLockEnabled: enabled }),
            setHasHydrated: (state) => set({ _hasHydrated: state }),
        }),
        {
            name: 'affida-settings',
            storage: createJSONStorage(() => secureStorage),
            partialize: (state) => ({ appLockEnabled: state.appLockEnabled }),
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true)
            },
        }
    )
)
