import { useEffect, useRef, useState } from 'react'
import { MAX_NAME } from '../data'
import { SwitcherPopover } from './SwitcherPopover'

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
  ['materials', '📁', '资料库'],
  ['overall', '📊', '总体分析'],
  ['monthly', '📈', '每月分析'],
  ['settings', '⚙️', '数据与设置']
]

export function Sidebar({ view, setView, days, user, cloudState, auth, onSettings, onLogout, onLogin, mobileOpen, onCloseNav, wsName, onRename, toast }) {
  const [open, setOpen] = useState(false)
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [anchorRect, setAnchorRect] = useState(null)
  const brandRef = useRef(null)
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const commitName = () => {
    const v = nameDraft.trim()
    if (!v) { setEditingName(false); return }
    onRename && onRename(v)
    toast && toast('名称已更新')
    setEditingName(false)
  }

  // 头像品牌卡外点击关闭 brand-menu（但不能误关 switcher-popover；popover 自己有外点击关）
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (brandRef.current && !brandRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // 打开账号切换气泡：拿头像品牌卡的 rect 作为锚点
  const openSwitcher = () => {
    if (!brandRef.current) return
    setAnchorRect(brandRef.current.getBoundingClientRect())
    setSwitcherOpen(true)
  }

  const avatarEmail = user?.email || ''
  const short = avatarEmail ? avatarEmail.slice(0, 2).toUpperCase() : '?'
  const cloudLabel = cloudState || '本机'
  const cloudCls =
    cloudLabel === '已登录' ? 'state-ok' :
    cloudLabel === '同步中…' ? 'state-warn' : 'state-fail'

  return (
    <aside className={'sidebar' + (mobileOpen ? ' mobile-open' : '')}>
      {/* 左上角：品牌 logo + 账户卡（点头像 / 卡 → 弹出菜单） */}
      <div className="brand-wrap" ref={brandRef}>
        <div className={'brand' + (open ? ' open' : '')} onClick={() => setOpen((v) => !v)}
             aria-haspopup="menu" aria-expanded={open}>
          <div className="brand-logo" dangerouslySetInnerHTML={{ __html: brandLogoSvg }} />
          {user ? (
            <div className="brand-init" title={avatarEmail}>{short}</div>
          ) : (
            <div className="brand-init brand-init-grey" title="未登录">?</div>
          )}
          <div className="brand-meta">
            {editingName ? (
              <span className="brand-name-edit" onClick={(e) => e.stopPropagation()}>
                <input
                  className="brand-name-input"
                  value={nameDraft}
                  maxLength={MAX_NAME}
                  autoFocus
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') setEditingName(false) }}
                />
                <button className="brand-name-btn ok" onClick={commitName} aria-label="保存名称">✓</button>
                <button className="brand-name-btn cancel" onClick={() => setEditingName(false)} aria-label="取消">✕</button>
              </span>
            ) : (
              <strong className="brand-name"
                onClick={(e) => { e.stopPropagation(); setOpen(false); setEditingName(true); setNameDraft(wsName) }}
                title="点击修改工作台名称">
                {wsName}<span className="brand-edit-ic">✏️</span>
              </strong>
            )}
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
                {/* 切换账号：直接弹气泡（不是全屏覆盖） */}
                <div className="am-item" role="menuitem" onClick={() => { setOpen(false); openSwitcher() }}>
                  <span className="am-ic">🔄</span>
                  <span>切换账号</span>
                </div>
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

      {/* 账号切换气泡：基于头像品牌卡定位，浮于侧栏之上；手机端同样工作。 */}
      {switcherOpen && user && (
        <SwitcherPopover
          auth={auth}
          anchorRect={anchorRect}
          currentEmail={user.email}
          onClose={() => setSwitcherOpen(false)}
          onAdd={() => { onLogin && onLogin(); onCloseNav && onCloseNav() }}
          onLogout={() => { onLogout && onLogout(); onCloseNav && onCloseNav() }}
        />
      )}

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
