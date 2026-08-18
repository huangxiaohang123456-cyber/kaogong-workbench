import { useState } from 'react'
import { defaultState } from '../data'

export function Settings({ s, up, toast, user, cloudState, onLogin, onLogout }) {
  const [file, setFile] = useState(null)
  const exportData = () => {
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'kaogong-backup.json'
    a.click()
    toast('已导出 JSON 备份')
  }
  const importData = (f) => {
    if (!f) return
    const r = new FileReader()
    r.onload = (ev) => {
      try { up(Object.assign({}, defaultState(), JSON.parse(ev.target.result))); toast('已导入') }
      catch (e) { toast('文件格式不对') }
    }
    r.readAsText(f)
  }
  const reset = () => { if (!confirm('确定重置全部数据为初始示例？建议先导出备份')) return; up(defaultState()); toast('已重置') }
  const check = () => {
    let bad = 0; const lines = []
    s.exams.forEach((e) => { if (e.completed > e.totalQ || e.wrong > e.completed) { bad++; lines.push('题本「' + e.name + '」数据异常') } })
    s.courses.forEach((c) => { if (c.completedLessons > c.totalLessons) { bad++; lines.push('网课「' + c.name + '」数据异常') } })
    if (bad) alert('⚠️ 发现 ' + bad + ' 处异常：\n' + lines.join('\n'))
    else alert('✅ 全部数据一致')
  }

  return (
    <>
      <div className="card">
        <h3>👤 账号</h3>
        {user ? (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{user.email}</div>
              <div className="muted" style={{ fontSize: 12.5 }}>已登录 · 云端同步状态：<span className="tag">{cloudState}</span></div>
            </div>
            <button className="btn-ghost" onClick={onLogout}>退出登录</button>
          </div>
        ) : (
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div className="muted" style={{ fontSize: 13 }}>当前为仅本机模式，数据不上云。</div>
            <button className="btn-primary" onClick={onLogin}>登录 / 注册</button>
          </div>
        )}
      </div>

      <div className="card">
        <h3>💾 数据备份与清理</h3>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn-primary" onClick={exportData}>导出备份</button>
          <button className="btn-ghost" onClick={() => document.getElementById('importFile').click()}>导入备份</button>
          <button className="btn-ghost" onClick={check}>数据自检</button>
          <button className="btn-danger" onClick={reset}>重置示例</button>
          <input id="importFile" type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => importData(e.target.files[0])} />
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>导出为 JSON 文件存到本地；导入会覆盖当前数据。建议重要节点都导一份。</p>
      </div>
    </>
  )
}
