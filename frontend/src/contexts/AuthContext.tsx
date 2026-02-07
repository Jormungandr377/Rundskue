import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { authApi, setAccessToken, type AuthUser } from '../services/api'

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string, rememberMe?: boolean, totpCode?: string) => Promise<LoginResult>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

interface LoginResult {
  success: boolean
  requires2FA?: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Try to restore session on mount (using refresh token cookie)
  useEffect(() => {
    const initAuth = async () => {
      try {
        const tokens = await authApi.refresh()
        setAccessToken(tokens.access_token)
        const userData = await authApi.me()
        setUser(userData)
      } catch {
        // No valid session - user needs to login
        setAccessToken(null)
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    initAuth()
  }, [])

  const login = useCallback(async (
    email: string,
    password: string,
    rememberMe = false,
    totpCode?: string
  ): Promise<LoginResult> => {
    try {
      const tokens = await authApi.login({
        email,
        password,
        remember_me: rememberMe,
        totp_code: totpCode,
      })
      setAccessToken(tokens.access_token)
      const userData = await authApi.me()
      setUser(userData)
      return { success: true }
    } catch (error: any) {
      // Check if 2FA is required
      if (error.response?.status === 401 && error.response?.data?.detail === '2FA code required') {
        return { success: false, requires2FA: true }
      }
      throw error
    }
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const tokens = await authApi.register({ email, password })
    setAccessToken(tokens.access_token)
    const userData = await authApi.me()
    setUser(userData)
  }, [])

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Even if logout API fails, clear local state
    }
    setAccessToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const userData = await authApi.me()
      setUser(userData)
    } catch {
      // If me() fails, session is likely expired
      setAccessToken(null)
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
