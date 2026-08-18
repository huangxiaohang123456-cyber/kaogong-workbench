import { useState } from 'react'
import { Modal } from './Modal'

export function AuthModal({ auth, mode, onClose, onAfterAuth }) {
  const [tab, setTab] = useState(mode || 'login')
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [sentReset, setSentReset] = useState(false)

  const submit = async () => {
    setErr(''); setBusy(true)
    try {
      if (tab === 'login') {
        await auth.signIn(email, pwd)
      } else {
        await auth.signUp(email, pwd)
      }
      if (tab === 'signup') setErr('✅ 注册成功！如开启了邮箱验证，请先到邮箱点验证链接再登录。')
      onAfterAuth && onAfterAuth()
    } catch (e) {
      setErr(e.message || String(e))
    } finally { setBusy(false) }
  }

  const forgot = async () => {
    setErr('')
    if (!email) { setErr('请先在上方输入你的邮箱'); return }
    setBusy(true)
    try {
      await auth.resetPassword(email, window.location.origin + window.location.pathname)
      setSentReset(true)
    } catch (e) { setErr(e.message || String(e)) } finally { setBusy(false) }
  }

  return (
    <Modal title={tab === 'login' ? '🔐 登录账号' : '📝 注册账号'} onClose={onClose}>
      <div className="tabs" style={{ marginBottom: 16 }}>
        <div className={'tab' + (tab === 'login' ? ' active' : '')} onClick={() => { setTab('login'); setErr('') }}>登录</div>
        <div className={'tab' + (tab === 'signup' ? ' active' : '')} onClick={() => { setTab('signup'); setErr('') }}>注册</div>
      </div>

      {sentReset ? (
        <p style={{ fontSize: 13.5, color: 'var(--brand-d)' }}>✅ 重置邮件已发送，请到邮箱查收并点击链接设置新密码。</p>
      ) : (
        <>
          <div className="field"><label>邮箱</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="你的邮箱" /></div>
          <div className="field"><label>密码（至少 6 位）</label><input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="输入密码" autoComplete="current-password" /></div>
          {tab === 'login' && (
            <div style={{ textAlign: 'right', marginBottom: 10 }}>
              <a href="#" onClick={(e) => { e.preventDefault(); forgot() }} style={{ fontSize: 12.5 }}>忘记密码？</a>
            </div>
          )}
          <div style={{ color: 'var(--danger)', fontSize: 12.5, minHeight: 18, marginBottom: 8 }}>{err}</div>
          <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            <button className="btn-primary btn-block" disabled={busy} onClick={submit}>{busy ? '处理中…' : (tab === 'login' ? '登录' : '注册并登录')}</button>
            <button className="btn-ghost btn-block" onClick={onClose}>取消</button>
          </div>
          <p className="muted" style={{ fontSize: 11.5, marginTop: 12, textAlign: 'center' }}>
            注册即代表你拥有该账号数据的独立权限（数据凭密码隔离，换设备登录自动同步）
          </p>
        </>
      )}
    </Modal>
  )
}

// 邮箱回链后的「设置新密码」弹窗
export function ResetPwdModal({ auth, onClose }) {
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setErr('')
    if (p1.length < 6) { setErr('新密码至少 6 位'); return }
    if (p1 !== p2) { setErr('两次输入不一致'); return }
    setBusy(true)
    try { await auth.updatePassword(p1); onClose(); } catch (e) { setErr(e.message || String(e)) } finally { setBusy(false) }
  }
  return (
    <Modal title="🔑 设置新密码" onClose={onClose}>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>你通过邮箱「重置密码」链接进入，请输入新的登录密码。</p>
      <div className="field"><label>新密码（至少 6 位）</label><input type="password" value={p1} onChange={(e) => setP1(e.target.value)} /></div>
      <div className="field"><label>确认新密码</label><input type="password" value={p2} onChange={(e) => setP2(e.target.value)} /></div>
      <div style={{ color: 'var(--danger)', fontSize: 12.5, minHeight: 18, marginBottom: 8 }}>{err}</div>
      <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <button className="btn-primary btn-block" disabled={busy} onClick={submit}>{busy ? '处理中…' : '确认修改'}</button>
        <button className="btn-ghost btn-block" onClick={onClose}>取消</button>
      </div>
    </Modal>
  )
}
