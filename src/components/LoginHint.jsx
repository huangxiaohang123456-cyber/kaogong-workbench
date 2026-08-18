export function LoginHint({ onLogin, message }) {
  return (
    <div className="login-hint" style={{ display: 'flex' }} id="loginHint">
      <span>⚠️ <strong>{message || '未登录'}</strong>：数据只存在你本机浏览器，换设备 / 清缓存就丢了。建议立即注册或登录。</span>
      <span>
        <button className="btn-primary btn-sm" onClick={onLogin} style={{ padding: '6px 16px' }}>🔑 登录 / 注册</button>
      </span>
    </div>
  )
}
