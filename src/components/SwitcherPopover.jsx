import { useEffect, useRef, useState } from 'react'
import { listAccounts, forgetAccount } from '../useAuth'

// ────────── 账号切换气泡（常见 App 形式）──────────
// props:
//   auth:          useAuth 返回值（含 switchToSession）
//   anchorRect:    定位用——通常传触发它的元素的 getBoundingClientRect()
//   currentEmail:  当前账号（高亮/禁用）
//   onClose:       点外面 / Esc 时回调
//   onAdd:         点"+ 添加账号"——通常打开普通登录/注册弹窗
//   onLogout:      退出当前登录
export function SwitcherPopover({ auth, anchorRect, currentEmail, onClose, onAdd, onLogout }) {
  const ref = useRef(null)
  const [list, setList] = useState(() => listAccounts())
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose && onClose() }
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const pos = computePos(anchorRect)

  const handle = async (acct) => {
    setBusy(true); setErr('')
    try {
      await auth.switchToSession(acct)
      // 成功：父级 user 会切换，整个 UI 会刷新；气泡由父级关掉（这里再点 close 也行）
      onClose && onClose()
    } catch (e) {
      // useAuth 失败时已经把这条失效记录清掉了；同步本地 state
      setList(listAccounts())
      setErr(`「${acct.email}」的快捷登录已失效，请点下方"添加账号"用密码登录。`)
    } finally {
      setBusy(false)
    }
  }
  const del = (mail) => {
    forgetAccount(mail)
    setList(listAccounts())
  }

  return (
    <div className="switcher-popover" ref={ref} style={pos} role="menu" aria-label="切换账号">
      <span className="sp-arrow" style={pos.arrowStyle} aria-hidden="true" />
      <div className="sp-head">
        <span className="sp-title">🔄 切换账号</span>
        {currentEmail && <span className="sp-current" title={currentEmail}>当前：{currentEmail}</span>}
      </div>
      {list.length === 0 ? (
        <div className="sp-empty">
          <p>还没有记住其他账号</p>
          <p className="muted">用密码登录一次后就会自动记住</p>
        </div>
      ) : (
        <ul className="sp-list">
          {list.map((a) => {
            const isCur = a.email === currentEmail
            return (
              <li key={a.email} className={'sp-row' + (isCur ? ' is-current' : '')}>
                <button className="sp-row-btn" disabled={busy || isCur} onClick={() => handle(a)}>
                  <span className="sp-avatar" aria-hidden="true">{a.email.slice(0, 2).toUpperCase()}</span>
                  <span className="sp-email" title={a.email}>{a.email}</span>
                  <span className={'sp-tag' + (isCur ? ' is-cur' : '')}>{isCur ? '当前' : '切换'}</span>
                </button>
                <button className="sp-del" title="从这台设备移除此账号" disabled={busy} onClick={() => del(a.email)}>✕</button>
              </li>
            )
          })}
        </ul>
      )}
      {err && <div className="sp-err">{err}</div>}
      <div className="sp-foot">
        <button className="sp-btn sp-btn-primary" disabled={busy} onClick={() => { onAdd && onAdd(); onClose && onClose() }}>
          ＋ 添加 / 登录其他账号
        </button>
        {currentEmail && (
          <button className="sp-btn sp-btn-ghost" disabled={busy} onClick={() => { onLogout && onLogout(); onClose && onClose() }}>
            退出当前账号
          </button>
        )}
      </div>
    </div>
  )
}

// 默认锚点是触发元素；把气泡放到它正下/正上，
// 视口边缘会自适应翻转，不超出屏幕。
function computePos(rect) {
  if (!rect) {
    return { top: 80, left: 24, arrowStyle: { display: 'none' } }
  }
  const POP_W = 320 // 与 css 的 .switcher-popover max-width 对齐
  const POP_H = 360 // 估算
  const margin = 10
  const vw = window.innerWidth
  const vh = window.innerHeight
  // 水平：先尝试与触发元素左边对齐，超出则改为右侧紧贴
  let left = rect.left
  if (left + POP_W + margin > vw) left = Math.max(margin, rect.right - POP_W)
  if (left < margin) left = margin
  // 垂直：优先放下方，再不行放上方
  let top, placeBelow
  const spaceBelow = vh - rect.bottom
  if (spaceBelow >= POP_H + 12 || rect.top < spaceBelow) {
    top = rect.bottom + 12
    placeBelow = true
  } else {
    top = rect.top - POP_H - 12
    placeBelow = false
  }
  if (top < margin) top = margin

  // 箭头位置：相对 popover 的左偏移，指回触发元素中线
  const centerX = rect.left + rect.width / 2 - left
  const arrowLeft = Math.max(18, Math.min(POP_W - 18, centerX))
  return {
    top,
    left,
    width: POP_W,
    arrowStyle: {
      left: arrowLeft - 6,
      top: placeBelow ? -6 : 'auto',
      bottom: placeBelow ? 'auto' : -6,
      transform: placeBelow ? 'rotate(45deg)' : 'rotate(225deg)'
    }
  }
}
