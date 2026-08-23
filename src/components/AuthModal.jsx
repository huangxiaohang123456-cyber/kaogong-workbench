import { useState, useEffect, useRef } from 'react'
import { Modal } from './Modal'
import { loadLocal } from '../data'
import { listAccounts, forgetAccount } from '../useAuth'

// ────────── Supabase 英文错误 → 中文 ──────────
function translateAuthError(e) {
  const raw = (e && e.message) ? e.message : (e ? String(e) : '')
  const code = e && e.code
  const rules = [
    // 登录相关
    [/invalid login credentials/i, '邮箱或密码不正确，请重新输入'],
    [/email not confirmed/i, '该邮箱尚未完成验证，请先到邮箱点击验证链接后再登录'],
    [/email logins are disabled/i, '当前未开启邮箱登录'],
    [/user not found/i, '该邮箱尚未注册，请先注册账号'],
    // 注册相关
    [/user already registered/i, '该邮箱已经注册过，请直接登录；若忘记密码可用「忘记密码」'],
    [/email already registered/i, '该邮箱已经注册过，请直接登录；若忘记密码可用「忘记密码」'],
    [/signups? (are )?not allowed/i, '当前未开放注册，请联系管理员'],
    [/password should be at least 6/i, '密码至少需要 6 位，请重新设置'],
    [/unable to validate email/i, '邮箱格式不正确，请检查后重新输入'],
    [/unable to parse/i, '邮箱格式不正确，请检查后重新输入'],
    // 找回 / 修改密码
    [/for security purposes, you can only request this after/i, '操作过于频繁，请稍后再试'],
    [/email rate limit exceeded/i, '邮件发送过于频繁，请稍后再试'],
    [/same password/i, '新密码不能与旧密码相同'],
    // 网络 / 通用
    [/network/i, '网络异常，请检查网络后重试'],
    [/failed to fetch/i, '网络异常，请检查网络后重试'],
    [/timeout/i, '请求超时，请稍后重试'],
    [/rate limit/i, '请求过于频繁，请稍后再试'],
  ]
  for (const [re, cn] of rules) if (re.test(raw) || (code && re.test(String(code)))) return cn
  // 兜底：控制台保留原始英文便于排查，界面给友好中文
  if (raw) console.error('[auth-error]', raw)
  return '操作出错，请稍后重试；若反复出现可联系管理员'
}

// ────────── 全屏登录页 ──────────
// props:
//   mode:        'normal' | 'switcher'（切换账号 overlay 模式，弹在已登录主界面之上）
//   currentEmail:string —— 进入切换器时正在用的账号（用于显示"当前"标记 + 检测是否切换成功）
//   onCancel:    用户点关闭时回调（仅 switcher 模式）
//   onAfterAuth: 切换成功后回调（仅 switcher 模式）——此时 auth.user 已变
export function LoginPage({ auth, SUPABASE_OK, mode = 'normal', currentEmail, onCancel, onAfterAuth }) {
  const wsName = (loadLocal().workspaceName) || '备考工作台'
  const [tab, setTab] = useState('login')
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [sentReset, setSentReset] = useState(false)
  const [accounts, setAccounts] = useState(() => listAccounts())
  const [fromEmail, setFromEmail] = useState(currentEmail || null)

  useEffect(() => {
    if (mode !== 'switcher') return
    // 切换器模式：监听 auth.user.email 变化 → 切换成功 → 通知父组件关闭
    // （不直接调 onAfterAuth 是为了避免初次挂载就触发关掉 overlay）
    const cur = auth.user?.email || null
    if (fromEmail === null) {
      setFromEmail(cur)
      return
    }
    // 用户变成 null —— 比如登出了 —— 也关掉
    if (!cur) {
      onAfterAuth && onAfterAuth()
      return
    }
    // 用户邮箱变了 —— 切换成功
    if (cur !== fromEmail) {
      onAfterAuth && onAfterAuth()
    }
  }, [auth.user, mode, fromEmail, onAfterAuth])

  // 一键切换：用记住的会话令牌直接登录，免输密码
  // 失败原因通常是 signOut 把 refresh_token 撤销了 —— 把这条失效项清掉，
  // 并把邮箱自动填到下面的表单里，让用户直接输密码登录。
  const handleSwitch = async (acct) => {
    setErr(''); setBusy(true)
    try {
      await auth.switchToSession(acct)
      // 成功后 auth.user 变化 → 上面 useEffect 会自动关闭 overlay / 切到主界面
    } catch (e) {
      console.error('[switch-account]', e)
      // useAuth 已经把这条从 saved list 清掉了；同步本地 state
      setAccounts(listAccounts())
      setErr(`「${acct.email}」的快捷登录已失效，请用密码重新登录。`)
      setEmail(acct.email)
      setPwd('')
    } finally { setBusy(false) }
  }
  const handleForget = (mail) => {
    forgetAccount(mail)
    setAccounts(listAccounts())
  }

  const submit = async () => {
    setErr(''); setBusy(true)
    try {
      if (tab === 'login') {
        await auth.signIn(email.trim(), pwd)
      } else {
        await auth.signUp(email.trim(), pwd)
        setErr('✅ 注册成功！如开启了邮箱验证，请先到邮箱点验证链接；若未开启验证，已自动登录。')
      }
    } catch (e) {
      setErr(translateAuthError(e))
    } finally { setBusy(false) }
  }

  const forgot = async () => {
    setErr('')
    if (!email) { setErr('请先在上方输入你的邮箱'); return }
    setBusy(true)
    try {
      await auth.resetPassword(email.trim(), window.location.origin + window.location.pathname)
      setSentReset(true)
    } catch (e) { setErr(translateAuthError(e)) } finally { setBusy(false) }
  }

  const logoSvg = `<svg width="56" height="56" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
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

  return (
    <div className="login-page">
      <div className="login-bg-deco" aria-hidden="true">
        <span className="deco-c c1" />
        <span className="deco-c c2" />
        <span className="deco-c c3" />
      </div>

      {/* 切换账号 overlay 专用顶栏：标明当前正在用哪个账号，方便点错时取消 */}
      {mode === 'switcher' && (
        <div className="switcher-bar">
          <div className="switcher-bar-left">
            🔄 <strong>切换账号</strong>
            <span className="switcher-bar-cur">当前：{currentEmail || auth.user?.email || '?'}</span>
          </div>
          <button className="switcher-bar-x" onClick={() => { onCancel && onCancel() }} aria-label="取消切换">✕</button>
        </div>
      )}

      <div className="login-card">
        <div className="login-brand">
          <div className="login-logo" dangerouslySetInnerHTML={{ __html: logoSvg }} />
          <h2>{wsName}</h2>
          <p className="login-sub">备考数据独立空间 · 随时随地同步</p>
        </div>

        {!SUPABASE_OK && (
          <div className="login-warn">
            ⚠️ 云端未配置（环境变量未设置），当前仅本机模式，无法注册 / 登录。
          </div>
        )}

        {/* 已记住的账号：一键切换，免去重输密码 */}
        {accounts.length > 0 && (
          <div className="acct-switcher">
            <p className="acct-switcher-title">快速切换账号</p>
            {accounts.map((a) => {
              const isCurrent = mode === 'switcher' && a.email === (currentEmail || auth.user?.email)
              return (
                <div key={a.email} className={'acct-row' + (isCurrent ? ' is-current' : '')}>
                  <button className="acct-btn" disabled={busy || isCurrent} onClick={() => handleSwitch(a)}>
                    <span className="acct-avatar">{a.email.slice(0, 2).toUpperCase()}</span>
                    <span className="acct-email" title={a.email}>{a.email}</span>
                    {isCurrent ? (
                      <span className="acct-go acct-go-cur">当前</span>
                    ) : (
                      <span className="acct-go">切换 →</span>
                    )}
                  </button>
                  <button className="acct-del" title="移除该账号" disabled={busy}
                          onClick={() => handleForget(a.email)}>✕</button>
                </div>
              )
            })}
            <div className="acct-divider"><span>{mode === 'switcher' ? '或登录其他账号' : '或使用其他账号'}</span></div>
          </div>
        )}

        <div className="tabs" style={{ marginTop: 24 }}>
          <div className={'tab' + (tab === 'login' ? ' active' : '')}
               onClick={() => { if (SUPABASE_OK) { setTab('login'); setErr(''); setSentReset(false) } }}>登录</div>
          <div className={'tab' + (tab === 'signup' ? ' active' : '')}
               onClick={() => { if (SUPABASE_OK) { setTab('signup'); setErr(''); setSentReset(false) } }}>注册</div>
        </div>

        {sentReset ? (
          <div className="sent-reset">
            <div style={{ fontSize: 28, marginBottom: 10 }}>📬</div>
            <p style={{ fontSize: 14, color: 'var(--brand-d)', fontWeight: 600 }}>重置邮件已发送</p>
            <p style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 8, lineHeight: 1.7 }}>
              请到 <b>{email}</b> 的邮箱查收，点击邮件中的链接即可设置新密码。
            </p>
          </div>
        ) : (
          <>
            <div className="field">
              <label>邮箱</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                     placeholder="you@example.com" disabled={!SUPABASE_OK || busy}
                     onKeyDown={(e) => e.key === 'Enter' && submit()} />
            </div>
            <div className="field">
              <label>密码（至少 6 位）</label>
              <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)}
                     placeholder={tab === 'signup' ? '设置你的登录密码' : '输入登录密码'}
                     disabled={!SUPABASE_OK || busy} autoComplete="current-password"
                     onKeyDown={(e) => e.key === 'Enter' && submit()} />
            </div>

            {tab === 'login' && (
              <div style={{ textAlign: 'right', marginTop: -4, marginBottom: 10 }}>
                <a href="#" onClick={(e) => { e.preventDefault(); forgot() }}
                   style={{ fontSize: 12.5, color: 'var(--muted)' }}>忘记密码？</a>
              </div>
            )}

            <div className="login-err">{err}</div>

            <button className="btn-primary btn-block" disabled={busy || !SUPABASE_OK} onClick={submit}
                    style={{ padding: '12px 16px', fontSize: 14 }}>
              {busy ? '处理中…' : (tab === 'login' ? '登 录' : '注 册 并 登 录')}
            </button>

            <div className="login-foot">
              <p>注册即代表同意账号数据独立权限（数据凭密码隔离，换设备登录自动同步）</p>
              <p className="muted">支持「添加到主屏幕」当 App 使用</p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ────────── 旧 Modal 形态登录入口（保留兼容） ──────────
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
      setErr(translateAuthError(e))
    } finally { setBusy(false) }
  }

  const forgot = async () => {
    setErr('')
    if (!email) { setErr('请先在上方输入你的邮箱'); return }
    setBusy(true)
    try {
      await auth.resetPassword(email, window.location.origin + window.location.pathname)
      setSentReset(true)
    } catch (e) { setErr(translateAuthError(e)) } finally { setBusy(false) }
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
    try { await auth.updatePassword(p1); onClose(); } catch (e) { setErr(translateAuthError(e)) } finally { setBusy(false) }
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
