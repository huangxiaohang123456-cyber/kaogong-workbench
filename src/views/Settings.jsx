import { useState, useEffect } from 'react'
import { defaultState, MAX_NAME } from '../data'

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

      <div className="card">
        <h3>💾 数据备份与清理</h3>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn-primary" onClick={exportData}>导出备份</button>
          <button className="btn-ghost" onClick={() => document.getElementById('importFile').click()}>导入备份</button>
          <button className="btn-ghost" onClick={check}>数据自检</button>
          <button className="btn-danger" onClick={reset}>重置示例</button>
          <input id="importFile" type="file" accept="application/json" style={{ display: 'none' }} onChange={(e) => importData(e.target.files[0])} />
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 12 }}>
          导出为 JSON 文件存到本地；导入会覆盖当前数据。建议重要节点都导一份。
        </p>
      </div>

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
