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
    /** Whether we've already applied the one-time "default app lock on if biometrics are enrolled" check */
    appLockDefaultApplied: boolean
    _hasHydrated: boolean
    setAppLockEnabled: (enabled: boolean) => void
    setAppLockDefaultApplied: (applied: boolean) => void
    setHasHydrated: (state: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            appLockEnabled: false,
            appLockDefaultApplied: false,
            _hasHydrated: false,
            setAppLockEnabled: (enabled) => set({ appLockEnabled: enabled }),
            setAppLockDefaultApplied: (applied) => set({ appLockDefaultApplied: applied }),
            setHasHydrated: (state) => set({ _hasHydrated: state }),
        }),
        {
            name: 'affida-settings',
            storage: createJSONStorage(() => secureStorage),
            // v1 added the one-time "App Lock on by default" check. Settings saved by
            // an earlier version belong to an existing install: someone who turned App
            // Lock off chose that, so mark the default as already applied rather than
            // overriding it. Fresh installs have nothing saved, so migrate never runs
            // and the default applies.
            version: 1,
            migrate: (persisted, version) => {
                const state = (persisted ?? {}) as Partial<SettingsState>
                return version < 1 ? { ...state, appLockDefaultApplied: true } : state
            },
            partialize: (state) => ({
                appLockEnabled: state.appLockEnabled,
                appLockDefaultApplied: state.appLockDefaultApplied,
            }),
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true)
            },
        }
    )
)
