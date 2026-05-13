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

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            useAuthStore.getState().clearAuth()
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
