import { useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth'
import { cloudLoad, cloudSave, migrateFromLegacy, SUPABASE_OK } from './supabaseClient'
import { loadLocal, saveLocal, defaultState } from './data'
import { Sidebar, Topbar } from './components/Sidebar'
import { LoginHint } from './components/LoginHint'
import { AuthModal, ResetPwdModal } from './components/AuthModal'
import { Dashboard, Library, Books, Courses, Wrongs, Overall, Monthly } from './views'
import { Settings } from './views/Settings'

const TITLES = {
  dashboard: ['今日计划', '开始今天的学习之旅'],
  library: ['事项库', '收集要做的备考事项'],
  books: ['题本进度', '记录每本题本的正确率'],
  courses: ['网课进度', '跟踪课程学习节奏'],
  wrongs: ['错题盘点', '把错题啃透'],
  overall: ['总体分析', '看清自己的强弱项'],
  monthly: ['每月分析', '回顾每月投入'],
  settings: ['数据与设置', '账号、备份与清理']
}

export default function App() {
  const auth = useAuth()
  const { user } = auth
  const [s, setS] = useState(loadLocal)
  const [view, setView] = useState('dashboard')
  const [cloudState, setCloudState] = useState('本机')
  const [showAuth, setShowAuth] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [toastMsg, setToastMsg] = useState('')
  const initRef = useRef(false)
  const saveTimer = useRef(null)

  const toast = (m) => { setToastMsg(m); setTimeout(() => setToastMsg(''), 2400) }
  const up = (patch) => setS((prev) => (typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }))

  // 首次会话：从云端拉取（或迁移旧数据），覆盖本地
  useEffect(() => {
    if (!user) { setCloudState('未登录'); initRef.current = false; return }
    let cancel = false
    ;(async () => {
      setCloudState('同步中…')
      try {
        let remote = await cloudLoad(user.id)
        if (!remote) { const ok = await migrateFromLegacy(user.id); if (ok) remote = await cloudLoad(user.id) }
        if (remote && !cancel) setS(Object.assign(defaultState(), remote))
        if (!cancel) { initRef.current = true; setCloudState('已登录') }
      } catch (e) {
        if (!cancel) { initRef.current = true; setCloudState('同步失败'); toast('云端读取失败：' + (e.message || e)) }
      }
    })()
    return () => { cancel = true }
  }, [user])

  // 保存：本机 + 云端（防抖）
  useEffect(() => {
    saveLocal(s)
    if (user && initRef.current) {
      clearTimeout(saveTimer.current)
      setCloudState('同步中…')
      saveTimer.current = setTimeout(() => {
        cloudSave(user.id, s).then(() => setCloudState('已登录')).catch(() => setCloudState('同步失败'))
      }, 800)
    }
  }, [s, user])

  // 邮箱重置回链
  useEffect(() => {
    if (location.hash.includes('type=recovery')) setShowReset(true)
  }, [])

  const days = Math.max(1, Math.ceil((Date.now() - new Date(s.profile.startedAt || Date.now()).getTime()) / 86400000))

  return (
    <div className="app">
      <Sidebar view={view} setView={setView} days={days} />
      <main className="main">
        {!user && SUPABASE_OK && (
          <LoginHint onLogin={() => setShowAuth(true)} message={auth.loading ? '正在检查登录…' : '未登录'} />
        )}
        {!user && !SUPABASE_OK && (
          <div className="login-hint" style={{ display: 'flex', background: '#fdecec', color: '#b5503f', borderColor: '#f5cfcf' }}>
            <span>⚠️ 云端未连接（环境变量未配置），当前仅本机模式。</span>
          </div>
        )}
        <Topbar title={TITLES[view][0]} sub={TITLES[view][1]} onAvatar={() => user ? setView('settings') : setShowAuth(true)} />

        <div className="content">
          {view === 'dashboard' && <Dashboard s={s} up={up} toast={toast} />}
          {view === 'library' && <Library s={s} up={up} />}
          {view === 'books' && <Books s={s} up={up} />}
          {view === 'courses' && <Courses s={s} up={up} />}
          {view === 'wrongs' && <Wrongs s={s} up={up} />}
          {view === 'overall' && <Overall s={s} />}
          {view === 'monthly' && <Monthly s={s} />}
          {view === 'settings' && <Settings s={s} up={up} toast={toast} user={user} cloudState={cloudState} onLogin={() => setShowAuth(true)} onLogout={auth.signOut} />}
        </div>
      </main>

      {showAuth && <AuthModal auth={auth} onClose={() => setShowAuth(false)} onAfterAuth={() => setShowAuth(false)} />}
      {showReset && <ResetPwdModal auth={auth} onClose={() => { setShowReset(false); location.hash = '' }} />}
      <div className={'toast' + (toastMsg ? ' show' : '')}>{toastMsg}</div>
    </div>
  )
}
