import { useEffect, useRef, useState } from 'react'

const brandLogoSvg = `<svg width="36" height="36" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
  <circle cx="24" cy="28" r="18" fill="#9ec3a3"/>
  <ellipse cx="13" cy="13" rx="5.5" ry="6" fill="#9ec3a3"/>
  <ellipse cx="35" cy="13" rx="5.5" ry="6" fill="#9ec3a3"/>
  <ellipse cx="13" cy="14" rx="2" ry="2.5" fill="#f5d8c0"/>
  <ellipse cx="35" cy="14" rx="2" ry="2.5" fill="#f5d8c0"/>
  <circle cx="18" cy="26" r="2.4" fill="#2a2520"/>
  <circle cx="30" cy="26" r="2.4" fill="#2a2520"/>
  <circle cx="19" cy="25" r="0.8" fill="#fff"/><circle cx="31" cy="25" r="0.8" fill="#fff"/>
  <ellipse cx="24" cy="34" rx="2.5" ry="1.8" fill="#7a5a3a"/>
</svg>`

const NAV = [
  ['dashboard', '📋', '今日计划'],
  ['library', '📚', '事项库'],
  ['books', '✍️', '题本进度'],
  ['courses', '🎬', '网课进度'],
  ['wrongs', '❌', '错题盘点'],
  ['overall', '📊', '总体分析'],
  ['monthly', '📈', '每月分析'],
  ['settings', '⚙️', '数据与设置']
]

export function Sidebar({ view, setView, days, user, cloudState, onSettings, onLogout, onLogin, mobileOpen, onCloseNav }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const avatarEmail = user?.email || ''
  const short = avatarEmail ? avatarEmail.slice(0, 2).toUpperCase() : '?'
  const cloudLabel = cloudState || '本机'
  const cloudCls =
    cloudLabel === '已登录' ? 'state-ok' :
    cloudLabel === '同步中…' ? 'state-warn' : 'state-fail'

  return (
    <aside className={'sidebar' + (mobileOpen ? ' mobile-open' : '')}>
      {/* 左上角：品牌 logo + 账户卡（点头像 / 卡 → 弹出菜单） */}
      <div className="brand-wrap" ref={ref}>
        <div className={'brand' + (open ? ' open' : '')} onClick={() => setOpen((v) => !v)}
             aria-haspopup="menu" aria-expanded={open}>
          <div className="brand-logo" dangerouslySetInnerHTML={{ __html: brandLogoSvg }} />
          {user ? (
            <div className="brand-init" title={avatarEmail}>{short}</div>
          ) : (
            <div className="brand-init brand-init-grey" title="未登录">?</div>
          )}
          <div className="brand-meta">
            <strong>备考工作台</strong>
            {user ? (
              <>
                <span className="brand-email" title={avatarEmail}>{avatarEmail}</span>
                <span className="brand-state">
                  <span className="muted">云端</span>
                  <span className={'am-state ' + cloudCls}>{cloudLabel}</span>
                </span>
              </>
            ) : (
              <span className="brand-email muted">累计 {days} 天 · 未登录</span>
            )}
          </div>
          <span className="brand-chev" aria-hidden="true">▾</span>
        </div>

        {open && (
          <div className="brand-menu" role="menu">
            {user ? (
              <>
                <div className="bm-header">
                  <div className="bm-email" title={avatarEmail}>{avatarEmail}</div>
                  <div className="bm-meta">
                    <span className="muted">用户 ID</span>
                    <code>{user.id.slice(0, 8)}…</code>
                  </div>
                </div>
                <div className="am-sep" />
                <div className="am-item" role="menuitem" onClick={() => { setOpen(false); onSettings && onSettings(); onCloseNav && onCloseNav() }}>
                  <span className="am-ic">⚙️</span>
                  <span>数据备份与设置</span>
                </div>
                <div className="am-item am-danger" role="menuitem" onClick={() => { setOpen(false); onLogout && onLogout(); onCloseNav && onCloseNav() }}>
                  <span className="am-ic">🚪</span>
                  <span>退出登录</span>
                </div>
              </>
            ) : (
              <>
                <div className="bm-header">
                  <div className="bm-email muted">未登录</div>
                  <div className="bm-meta"><span className="muted">当前仅本机模式</span></div>
                </div>
                <div className="am-sep" />
                <div className="am-item am-cta" role="menuitem" onClick={() => { setOpen(false); onLogin && onLogin(); onCloseNav && onCloseNav() }}>
                  <span className="am-ic">🔐</span>
                  <span>登录 / 注册</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <nav className="nav">
        {NAV.map(([v, ic, label]) => (
          <div key={v} className={'nav-item' + (view === v ? ' active' : '')} data-view={v}
               onClick={() => { setView(v); onCloseNav && onCloseNav() }}>
            <span className="ic">{ic}</span>{label}
          </div>
        ))}
      </nav>
      <div className="side-foot">注册账号即享独立空间<br />数据凭密码隔离·换设备登录同步<br />可「添加到主屏幕」当 App</div>
    </aside>
  )
}

// Topbar 只剩标题，副标题 + 标题，右上角不再放任何东西
export function Topbar({ title, sub, onMenu }) {
  return (
    <header className="topbar">
      {onMenu && <button className="menu-btn" onClick={onMenu} aria-label="打开导航菜单">☰</button>}
      <div><h1>{title}</h1><div className="sub">{sub}</div></div>
    </header>
  )
}

// 手机端底部 tab 栏：8 个功能模块平铺，点一下直接切换
export function BottomNav({ view, setView }) {
  return (
    <nav className="bottom-nav" aria-label="功能模块">
      {NAV.map(([v, ic, label]) => (
        <div key={v}
             className={'bn-item' + (view === v ? ' active' : '')}
             onClick={() => setView(v)}>
          <span className="bn-ic">{ic}</span>
          <span className="bn-label">{label}</span>
        </div>
      ))}
    </nav>
  )
}