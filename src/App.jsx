import { useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth'
import { cloudLoad, cloudSave, migrateFromLegacy, SUPABASE_OK } from './supabaseClient'
import { loadLocal, saveLocal, defaultState, migrateStudyLog, today } from './data'
import { commitPending } from './useStudyTimer'
import { Sidebar, Topbar, BottomNav } from './components/Sidebar'
import { LoginPage, AuthModal, ResetPwdModal } from './components/AuthModal'
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // 检测到线上部署了新版本（wb-build meta 变化）就自动强制刷新一次，
  // 避免 GitHub Pages + Safari 强缓存导致一直看旧版、功能不出现
  useEffect(() => {
    const meta = document.querySelector('meta[name="wb-build"]')
    const cur = meta ? meta.getAttribute('content') : ''
    const prev = localStorage.getItem('kg_build') || ''
    if (cur && prev && prev !== cur) {
      localStorage.setItem('kg_build', cur)
      window.location.reload(true)
    } else if (cur) {
      localStorage.setItem('kg_build', cur)
    }
  }, [])
  const initRef = useRef(false)
  const saveTimer = useRef(null)

  const toast = (m) => { setToastMsg(m); setTimeout(() => setToastMsg(''), 2400) }
  const up = (patch) => setS((prev) => (typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }))

  // 计时器自动结算：每 15 秒把未记账秒数计入 studyLog（本地+云端都会保存），
  // 并在页面隐藏/卸载时补一次，保证忘点「结束并记录」直接关掉网页/后台也不丢时长
  useEffect(() => {
    const commit = () => {
      const p = commitPending()
      if (p > 0) {
        setS((prev) => {
          const t = today()
          return { ...prev, studyLog: { ...prev.studyLog, [t]: (prev.studyLog[t] || 0) + p } }
        })
      }
    }
    const iv = setInterval(commit, 15000)
    const onHide = () => { if (document.visibilityState === 'hidden') commit() }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', commit)
    return () => {
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', commit)
    }
  }, [])

  // 首次会话：从云端拉取（或迁移旧数据），覆盖本地
  useEffect(() => {
    if (!user) { setCloudState('未登录'); initRef.current = false; return }
    let cancel = false
    ;(async () => {
      setCloudState('同步中…')
      try {
        let remote = await cloudLoad(user.id)
        if (!remote) { const ok = await migrateFromLegacy(user.id); if (ok) remote = await cloudLoad(user.id) }
        if (remote && !cancel) setS(Object.assign(defaultState(), migrateStudyLog(remote)))
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

  // 浏览器标签页标题跟随工作台名称
  useEffect(() => {
    document.title = (s.workspaceName || '备考工作台')
  }, [s.workspaceName])

  // ─── 未登录：直接渲染全屏登录页（路由守卫）───
  if (!user) {
    return (
      <>
        <LoginPage auth={auth} SUPABASE_OK={SUPABASE_OK} />
        {showReset && <ResetPwdModal auth={auth} onClose={() => { setShowReset(false); location.hash = '' }} />}
        <div className={'toast' + (toastMsg ? ' show' : '')}>{toastMsg}</div>
      </>
    )
  }

  // ─── 已登录：主界面 ───
  return (
    <div className="app">
      <Sidebar
        view={view}
        setView={setView}
        days={days}
        user={user}
        cloudState={cloudState}
        onSettings={() => setView('settings')}
        onLogout={() => auth.signOut()}
        onLogin={() => setShowAuth(true)}
        mobileOpen={mobileNavOpen}
        onCloseNav={() => setMobileNavOpen(false)}
        wsName={s.workspaceName || '备考工作台'}
        onRename={(name) => up({ workspaceName: name })}
        toast={toast}
      />
      <main className="main">
        <Topbar
          title={TITLES[view][0]}
          sub={TITLES[view][1]}
          onMenu={() => setMobileNavOpen(true)}
        />

        <div className="content">
          {view === 'dashboard' && <Dashboard s={s} up={up} toast={toast} />}
          {view === 'library' && <Library s={s} up={up} toast={toast} />}
          {view === 'books' && <Books s={s} up={up} toast={toast} />}
          {view === 'courses' && <Courses s={s} up={up} toast={toast} />}
          {view === 'wrongs' && <Wrongs s={s} up={up} toast={toast} />}
          {view === 'overall' && <Overall s={s} />}
          {view === 'monthly' && <Monthly s={s} />}
          {view === 'settings' && <Settings s={s} up={up} toast={toast} />}
        </div>
      </main>

      <BottomNav view={view} setView={setView} />

      {showAuth && <AuthModal auth={auth} onClose={() => setShowAuth(false)} onAfterAuth={() => setShowAuth(false)} />}
      <div className={'nav-backdrop' + (mobileNavOpen ? ' show' : '')} onClick={() => setMobileNavOpen(false)} />
      <div className={'toast' + (toastMsg ? ' show' : '')}>{toastMsg}</div>
    </div>
  )
}
