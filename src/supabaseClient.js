import { createClient } from '@supabase/supabase-js'

// 从 Vite 环境变量读取；为空时 fallback 到已配置好的项目（部署到 Vercel 时由环境变量覆盖）
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://vjcjhfvxrjbotnggqzec.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_dPUeA4ArljNDLWkIqJng4g_u1A7kXWo'

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
})

export const SUPABASE_OK = !!(URL && KEY)

// ===== 业务数据云端存取（kg_users 表，RLS 保证每人只看自己行）=====
export async function cloudLoad(userId) {
  const { data, error } = await supabase
    .from('kg_users')
    .select('data')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return data ? data.data : null
}

export async function cloudSave(userId, data) {
  const { error } = await supabase
    .from('kg_users')
    .upsert({ user_id: userId, data, updated_at: new Date().toISOString() })
  if (error) throw error
}

// 从旧版 kg_state（同步码模式）迁移一次
export async function migrateFromLegacy(userId) {
  const code = localStorage.getItem('kg_sync_code') || ''
  if (!code) return false
  try {
    const { data, error } = await supabase
      .from('kg_state')
      .select('data')
      .eq('sync_code', code)
      .maybeSingle()
    if (error) return false
    if (data && data.data) {
      await cloudSave(userId, data.data)
      localStorage.removeItem('kg_sync_code')
      return true
    }
  } catch (e) { /* ignore */ }
  return false
}
