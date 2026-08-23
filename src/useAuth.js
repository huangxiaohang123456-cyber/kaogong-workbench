import { useEffect, useState, useCallback } from 'react'
import { supabase, SUPABASE_OK } from './supabaseClient'

// 记住已登录账号（仅存会话令牌，用于一键切换，免去重输密码）
// 说明：Supabase 默认也会把"当前"会话令牌存到本地 localStorage，风险相当；这里只是多存几个。
const ACCOUNTS_KEY = 'kg_accounts'

function readAccounts() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}
function writeAccounts(arr) {
  try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(arr)) } catch { /* ignore */ }
}

// 记住 / 列出 / 遗忘账号（导出给 LoginPage 与 App 使用）
export function rememberAccount(email, session) {
  if (!email || !session) return
  const arr = readAccounts().filter((a) => a.email !== email)
  arr.unshift({ email, session })
  writeAccounts(arr.slice(0, 6)) // 最多记住 6 个
}
export function listAccounts() {
  return readAccounts()
}
export function forgetAccount(email) {
  writeAccounts(readAccounts().filter((a) => a.email !== email))
}

export function useAuth() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!SUPABASE_OK) { setLoading(false); setReady(true); return }
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setUser(data.session?.user || null)
      if (data.session) rememberAccount(data.session.user.email, data.session)
      setLoading(false); setReady(true)
    }).catch(() => {
      if (!active) return
      setLoading(false); setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      // 会话刷新或登录时，用最新令牌更新记住的账号（refresh token 会轮换，必须同步）
      if (session) rememberAccount(session.user.email, session)
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  const signUp = useCallback(async (email, pwd) => {
    const { data, error } = await supabase.auth.signUp({ email, password: pwd })
    if (error) throw error
    if (data.session) rememberAccount(email, data.session)
  }, [])
  const signIn = useCallback(async (email, pwd) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pwd })
    if (error) throw error
    if (data.session) rememberAccount(email, data.session)
  }, [])
  // 退出当前登录（仅清本地会话，保留记住的账号列表，方便稍后一键切回）
  const signOut = useCallback(async () => {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
    setUser(null)
  }, [])
  // 一键切换：用已记住的会话令牌直接登录，无需重新输入密码
  const switchToSession = useCallback(async (session) => {
    const { error } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
    if (error) throw error
  }, [])
  const resetPassword = useCallback(async (email, redirectTo) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) throw error
  }, [])
  const updatePassword = useCallback(async (pwd) => {
    const { error } = await supabase.auth.updateUser({ password: pwd })
    if (error) throw error
  }, [])

  return { user, loading, ready, SUPABASE_OK, signUp, signIn, signOut, switchToSession, resetPassword, updatePassword }
}
