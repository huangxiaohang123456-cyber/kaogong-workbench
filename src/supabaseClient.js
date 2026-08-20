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

// ===== 错题图片：Supabase Storage =====
// 桶名（需在 Supabase Dashboard 手动创建 public 桶，名字一致）
const BUCKET = 'wrong-images'
const IMG_MAX_SIZE = 800
const IMG_QUALITY = 0.7

// 把 File 压缩到指定尺寸内，返回 Blob
function compressImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      if (width > maxSize || height > maxSize) {
        if (width >= height) { height = Math.round(height * maxSize / width); width = maxSize }
        else { width = Math.round(width * maxSize / height); height = maxSize }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('压缩失败')), 'image/jpeg', quality)
    }
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = URL.createObjectURL(file)
  })
}

// 上传错题图片，返回 { path, url }
export async function uploadWrongImage(userId, file) {
  if (!userId) throw new Error('未登录，无法上传图片')
  const compressed = await compressImage(file, IMG_MAX_SIZE, IMG_QUALITY)
  const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
    contentType: 'image/jpeg',
    upsert: false,
    cacheControl: '3600',
  })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { path, url: data.publicUrl }
}

// 删除错题图片
export async function deleteWrongImage(path) {
  if (!path) return
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  if (error) console.warn('[storage] 删除失败', error)
}
