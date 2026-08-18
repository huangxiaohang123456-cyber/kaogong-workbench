const avatarSvg = () => (
  <svg width="40" height="40" viewBox="0 0 48 48">
    <circle cx="24" cy="28" r="18" fill="#9ec3a3" />
    <ellipse cx="13" cy="13" rx="5.5" ry="6" fill="#9ec3a3" />
    <ellipse cx="35" cy="13" rx="5.5" ry="6" fill="#9ec3a3" />
    <ellipse cx="13" cy="14" rx="2" ry="2.5" fill="#f5d8c0" />
    <ellipse cx="35" cy="14" rx="2" ry="2.5" fill="#f5d8c0" />
    <circle cx="18" cy="26" r="2.4" fill="#2a2520" />
    <circle cx="30" cy="26" r="2.4" fill="#2a2520" />
    <circle cx="19" cy="25" r="0.8" fill="#fff" /><circle cx="31" cy="25" r="0.8" fill="#fff" />
    <ellipse cx="24" cy="34" rx="2.5" ry="1.8" fill="#7a5a3a" />
  </svg>
)

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
        <div className="logo" dangerouslySetInnerHTML={{ __html: avatarSvg() }} />
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

export function Topbar({ title, sub, onAvatar }) {
  return (
    <header className="topbar">
      <div><h1>{title}</h1><div className="sub">{sub}</div></div>
      <div className="avatar" onClick={onAvatar} dangerouslySetInnerHTML={{ __html: avatarSvg() }} />
    </header>
  )
}
