import axios from 'axios'
import { useAuthStore } from './auth-store'

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000'

export const apiClient = axios.create({
    baseURL: `${API_BASE_URL}/api/mobile`,
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
})

apiClient.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

function processQueue(error: unknown, token: string | null = null) {
    failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token!)))
    failedQueue = []
}

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config
        const is401 = error.response?.status === 401
        const isRefreshEndpoint = originalRequest?.url?.includes('/auth/refresh')

        if (is401 && !originalRequest._retry && !isRefreshEndpoint) {
            if (isRefreshing) {
                return new Promise<string>((resolve, reject) => {
                    failedQueue.push({ resolve, reject })
                }).then((token) => {
                    originalRequest.headers.Authorization = `Bearer ${token}`
                    return apiClient(originalRequest)
                })
            }

            originalRequest._retry = true
            isRefreshing = true

            try {
                const res = await authApi.refresh()
                const { token, user, expiresAt } = res.data
                useAuthStore.getState().setAuth(token, user, expiresAt)
                processQueue(null, token)
                originalRequest.headers.Authorization = `Bearer ${token}`
                return apiClient(originalRequest)
            } catch (refreshErr) {
                processQueue(refreshErr, null)
                useAuthStore.getState().clearAuth()
                return Promise.reject(refreshErr)
            } finally {
                isRefreshing = false
            }
        }

        return Promise.reject(error)
    }
)

export const authApi = {
    login: (email: string, password: string, totpCode?: string, mfaVia?: string) =>
        apiClient.post('/auth/token', { email, password, totpCode, mfaVia }),
    refresh: () =>
        apiClient.post('/auth/refresh'),
    sendEmailMfa: (email: string) =>
        axios.post(`${API_BASE_URL}/api/auth/mfa/email/send`, { email }),
}
