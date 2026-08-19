import { useEffect, useRef, useState } from 'react'

const avatarSvg = `<svg width="40" height="40" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
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

export function Sidebar({ view, setView, days }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo" dangerouslySetInnerHTML={{ __html: avatarSvg }} />
        <div className="meta"><strong>备考工作台</strong><span>累计 <em>{days}</em> 天</span></div>
      </div>
      <nav className="nav">
        {NAV.map(([v, ic, label]) => (
          <div key={v} className={'nav-item' + (view === v ? ' active' : '')} data-view={v} onClick={() => setView(v)}>
            <span className="ic">{ic}</span>{label}
          </div>
        ))}
      </nav>
      <div className="side-foot">注册账号即享独立空间<br />数据凭密码隔离·换设备登录同步<br />可「添加到主屏幕」当 App</div>
    </aside>
  )
}

export function Topbar({ title, sub, user, cloudState, onSettings, onLogout, onLogin }) {
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

  return (
    <header className="topbar">
      <div><h1>{title}</h1><div className="sub">{sub}</div></div>
      <div className="avatar-wrap" ref={ref}>
        <div className={'avatar' + (open ? ' active' : '')}
             onClick={() => setOpen((v) => !v)}
             title={user ? user.email : '未登录'}
             aria-haspopup="menu"
             aria-expanded={open}>
          {user ? (
            <div className="avatar-init">{short}</div>
          ) : (
            <div dangerouslySetInnerHTML={{ __html: avatarSvg }} />
          )}
          {!user && <span className="avatar-bang">!</span>}
        </div>

        {open && (
          <div className="avatar-menu" role="menu">
            {user ? (
              <>
                <div className="am-header">
                  <div className="am-avatar">{short}</div>
                  <div className="am-info">
                    <div className="am-email" title={avatarEmail}>{avatarEmail}</div>
                    <div className="am-meta">
                      <span>云端</span>
                      <span className={'am-state state-' + (cloudLabel === '已登录' ? 'ok' : cloudLabel === '同步中…' ? 'warn' : 'fail')}>
                        {cloudLabel}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="am-sep" />
                <div className="am-item" role="menuitem" onClick={() => { setOpen(false); onSettings && onSettings() }}>
                  <span className="am-ic">⚙️</span>
                  <span>数据备份与设置</span>
                </div>
                <div className="am-item am-danger" role="menuitem" onClick={() => { setOpen(false); onLogout && onLogout() }}>
                  <span className="am-ic">🚪</span>
                  <span>退出登录</span>
                </div>
              </>
            ) : (
              <>
                <div className="am-header am-empty">
                  <div className="am-avatar am-avatar-grey">?</div>
                  <div className="am-info">
                    <div className="am-email">未登录</div>
                    <div className="am-meta"><span className="muted">当前仅本机模式</span></div>
                  </div>
                </div>
                <div className="am-sep" />
                <div className="am-item am-cta" role="menuitem" onClick={() => { setOpen(false); onLogin && onLogin() }}>
                  <span className="am-ic">🔐</span>
                  <span>登录 / 注册</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
