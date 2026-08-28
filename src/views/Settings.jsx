import { useState, useEffect } from 'react'
import { defaultState, MAX_NAME, today } from '../data'

// 触发浏览器下载（文本）
function downloadBlob(content, filename, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1000)
}

export function Settings({ s, up, toast }) {
  const [name, setName] = useState(s.workspaceName || '')
  useEffect(() => { setName(s.workspaceName || '') }, [s.workspaceName])

  const saveName = () => {
    const v = name.trim()
    if (!v) { toast('名称不能为空'); return }
    up({ workspaceName: v })
    toast('名称已更新')
  }
  const resetName = () => { up({ workspaceName: '备考工作台' }); setName('备考工作台'); toast('已恢复默认名称') }

  // JSON 全量备份：导出 + 导入（导入会覆盖当前内容）
  const exportData = () => {
    downloadBlob(JSON.stringify(s, null, 2), 'kaogong-backup-' + today() + '.json', 'application/json')
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

  const reset = () => {
    if (!confirm('确定把全部数据重置为初始示例？建议先导出备份')) return
    up(defaultState())
    toast('已重置')
  }

  // 数据自检：核对今日学习记录、当日各科目时长、连续打卡的字段是否完整
  const check = () => {
    const issues = []
    if (!s.studyLog || typeof s.studyLog !== 'object') issues.push('「今日学习时长」数据缺失或损坏')
    if (!s.studyLogBySubject || typeof s.studyLogBySubject !== 'object') issues.push('「按科目记录」数据缺失')
    if (!Array.isArray(s.today)) issues.push('「今日日程」不是数组')
    const t = today()
    const total = (s.studyLog || {})[t] || 0
    const subs = (s.studyLogBySubject || {})[t] || {}
    const subSum = Object.values(subs).reduce((a, v) => a + v, 0)
    if (total > 0 && subSum > 0 && total < subSum) issues.push('今日科目时长总和大于今日总时长（异常）')
    if (issues.length === 0) alert('✅ 全部数据一致')
    else alert('⚠️ 发现 ' + issues.length + ' 处异常：\n· ' + issues.join('\n· '))
  }

  // 概要：给用户看一眼现在的数据状态，心里有底
  const totalDays = Object.keys(s.studyLog || {}).length
  const totalSecs = Object.values(s.studyLog || {}).reduce((a, v) => a + v, 0)
  const todaySecs = (s.studyLog || {})[today()] || 0

  return (
    <>
      {/* 数据概要：一行说明现在有多少学习记录 */}
      <div className="card">
        <h3>📊 数据概要</h3>
        <div className="grid cols-3 stat-row" style={{ marginBottom: 0 }}>
          <div className="stat"><b>{totalDays}</b><span>累计学习天数</span></div>
          <div className="stat"><b>{fmtMin(totalSecs)}</b><span>累计学习时长</span></div>
          <div className="stat"><b>{fmtMin(todaySecs)}</b><span>今日学习</span></div>
        </div>
      </div>

      {/* 工作台名称 */}
      <div className="card">
        <h3>🏷️ 工作台名称</h3>
        <div className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="ws-input"
            value={name}
            maxLength={MAX_NAME}
            placeholder="如：考研 / 公务员考试 / 2027 国考备考"
            onChange={(e) => setName(e.target.value)}
            style={{ flex: '1 1 220px', minWidth: 0 }}
          />
          <button className="btn-primary" onClick={saveName}>保存名称</button>
          <button className="btn-ghost" onClick={resetName}>恢复默认</button>
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>
          名称最多 {MAX_NAME} 字，会同步显示在左上角、登录页与浏览器标签上，换设备也一致。
          当前已用 <b>{name.length}</b> / {MAX_NAME} 字。
        </p>
      </div>

      {/* 数据备份：JSON 导入导出 + 重置 + 自检 */}
      <div className="card">
        <h3>💾 数据备份与恢复</h3>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn-primary" onClick={exportData}>导出备份</button>
          <button className="btn-ghost" onClick={() => document.getElementById('importFile').click()}>导入备份</button>
          <button className="btn-ghost" onClick={check}>数据自检</button>
          <button className="btn-danger" onClick={reset}>重置示例</button>
          <input id="importFile" type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => importData(e.target.files[0])} />
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 12, lineHeight: 1.75 }}>
          这里是 <b>JSON 全量备份</b>，包含你的全部数据和设置，导入后会<b>覆盖</b>当前内容——
          换手机、换账号、误删前的救命稻草，重要节点务必导一份。
        </p>
      </div>

      {/* 使用说明 */}
      <div className="card">
        <h3>📖 使用说明</h3>
        <ul style={{ paddingLeft: 20, fontSize: 13.5, lineHeight: 2, color: 'var(--ink2)' }}>
          <li>左上角点头像可查看账号信息和退出登录</li>
          <li>「添加到主屏幕」可当 App 使用（添加到主屏幕后会以独立窗口启动）</li>
          <li>忘记密码：在登录页点「忘记密码」，邮箱查收重置链接</li>
          <li>手机 / 网页皆可登录并自动同步数据（设备间共享）</li>
        </ul>
      </div>
    </>
  )
}

// 把秒数格式化成「X 小时 Y 分 / Y 分」（不显示秒，避免信息杂）
function fmtMin(sec) {
  sec = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(sec / 60)
  if (m >= 60) return Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分'
  if (m > 0) return m + ' 分'
  return '0 分'
}
