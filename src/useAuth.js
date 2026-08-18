import { useEffect, useState, useCallback } from 'react'
import { supabase, SUPABASE_OK } from './supabaseClient'

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
      setLoading(false); setReady(true)
    }).catch(() => {
      if (!active) return
      setLoading(false); setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })
    return () => { active = false; sub.subscription.unsubscribe() }
  }, [])

  const signUp = useCallback(async (email, pwd) => {
    const { error } = await supabase.auth.signUp({ email, password: pwd })
    if (error) throw error
  }, [])
  const signIn = useCallback(async (email, pwd) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pwd })
    if (error) throw error
  }, [])
  const signOut = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {})
    setUser(null)
  }, [])
  const resetPassword = useCallback(async (email, redirectTo) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })
    if (error) throw error
  }, [])
  const updatePassword = useCallback(async (pwd) => {
    const { error } = await supabase.auth.updateUser({ password: pwd })
    if (error) throw error
  }, [])

  return { user, loading, ready, SUPABASE_OK, signUp, signIn, signOut, resetPassword, updatePassword }
}
