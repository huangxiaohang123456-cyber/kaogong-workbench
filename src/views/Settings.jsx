import { useState, useEffect } from 'react'
import { defaultState, MAX_NAME, today, STUDY_SUBJECTS } from '../data'

// 触发浏览器下载（文本/二进制通用）
function downloadBlob(content, filename, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove() }, 1000)
}

// CSV 单元格转义：含逗号/引号/换行时加引号，内部引号翻倍
function csvCell(v) {
  const x = v == null ? '' : String(v)
  return /[",\n\r]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x
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

  const exportData = () => {
    downloadBlob(JSON.stringify(s, null, 2), 'kaogong-backup-' + today() + '.json', 'application/json')
    toast('已导出 JSON 备份')
  }

  // 学习日志行：日期 + 总时长 + 各科分钟（Excel / CSV 共用）
  const studyLogRows = () => Object.keys(s.studyLog || {}).sort().map((d) => {
    const secs = s.studyLog[d] || 0
    const subMap = (s.studyLogBySubject || {})[d] || {}
    const row = { 日期: d, 学习分钟: Math.round(secs / 60) }
    STUDY_SUBJECTS.forEach((k) => { if (subMap[k] > 0) row[k + '(分钟)'] = Math.round(subMap[k] / 60) })
    return row
  })

  // 导出 Excel：每个模块一个 sheet，便于用表格软件自行分析
  const exportExcel = async () => {
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.book_new()
      const addSheet = (name, rows) => {
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 提示: '暂无数据' }])
        // 列宽自适应（中文按 2 个字符宽算）
        const keys = rows.length ? Object.keys(rows[0]) : ['提示']
        ws['!cols'] = keys.map((k) => ({
          wch: Math.min(40, Math.max(10, [...k, ...rows.map((r) => String(r[k] ?? ''))]
            .reduce((a, x) => Math.max(a, [...x].reduce((n, ch) => n + (ch.charCodeAt(0) > 127 ? 2 : 1), 0)), 0) + 2)),
        }))
        XLSX.utils.book_append_sheet(wb, ws, name)
      }

      addSheet('今日日程', (s.today || []).map((i) => ({
        事项: i.text, 状态: i.done ? '已完成' : '未完成', 来源: i.libId ? '事项库' : '手动添加',
      })))
      addSheet('事项库', (s.library || []).map((i) => ({
        名称: i.name, 分类: i.cat, 优先级: i.pri, 默认分钟: i.defaultMinutes,
      })))
      addSheet('题本进度', (s.exams || []).map((e) => ({
        名称: e.name, 分类: e.cat, 总题数: e.totalQ, 已完成: e.completed,
        错题数: e.wrong,
        正确率: e.completed > 0 ? Math.round(((e.completed - e.wrong) / e.completed) * 100) + '%' : '—',
        完成度: e.totalQ > 0 ? Math.round((e.completed / e.totalQ) * 100) + '%' : '—',
      })))
      addSheet('网课进度', (s.courses || []).map((c) => ({
        名称: c.name, 分类: c.cat, 总课时: c.totalLessons, 已完成课时: c.completedLessons,
        完成度: c.totalLessons > 0 ? Math.round((c.completedLessons / c.totalLessons) * 100) + '%' : '—',
      })))
      addSheet('错题本', (s.wrongs || []).map((w) => ({
        日期: w.date, 科目: w.subject, 题目: w.q, 错因: w.reason,
        掌握: w.master ? '已掌握' : '未掌握', 笔记: w.note, 图片数: (w.images || []).length,
      })))
      addSheet('学习日志', studyLogRows())
      addSheet('倒计时', (s.countdowns || []).map((c) => ({ 名称: c.name, 考试日期: c.examDate })))
      addSheet('资料库', (s.materials || []).map((m) => ({
        名称: m.name, 用途: m.purpose, 考试: m.exam, 科目: m.subject, 上传时间: m.createdAt,
      })))

      XLSX.writeFile(wb, '考公工作台数据-' + today() + '.xlsx')
      toast('已导出 Excel（8 个表）')
    } catch (e) {
      toast('Excel 导出失败：' + (e && e.message ? e.message : '未知错误'))
    }
  }

  // 导出 CSV：学习日志（日期 + 总时长 + 各科分钟），可直接丢进任何表格软件
  const exportCsv = () => {
    const rows = studyLogRows()
    if (rows.length === 0) { toast('还没有学习记录可导出'); return }
    const allKeys = []
    rows.forEach((r) => Object.keys(r).forEach((k) => { if (!allKeys.includes(k)) allKeys.push(k) }))
    const lines = [allKeys.map(csvCell).join(',')]
    rows.forEach((r) => lines.push(allKeys.map((k) => csvCell(r[k] ?? '')).join(',')))
    // ﻿ BOM：保证 Excel 打开中文不乱码
    downloadBlob('﻿' + lines.join('\r\n'), '学习日志-' + today() + '.csv', 'text/csv;charset=utf-8')
    toast('已导出学习日志 CSV')
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
        <h3>📊 导出表格（自己分析用）</h3>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn-primary" onClick={exportExcel}>导出 Excel</button>
          <button className="btn-ghost" onClick={exportCsv}>导出学习日志 CSV</button>
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginTop: 12, lineHeight: 1.75 }}>
          <b>Excel</b>：一次性导出 8 张表（今日日程 / 事项库 / 题本 / 网课 / 错题 / 学习日志 / 倒计时 / 资料库），
          可以用 Excel、WPS、Numbers 打开，自己筛选排序做透视。<br />
          <b>CSV</b>：只导学习日志（日期 + 总时长 + 每个科目各多少分钟），文件小、任何软件都能开。<br />
          手机上导出表格可能直接进「文件」App，建议在电脑上操作。
        </p>
      </div>

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
          换手机、换账号、误删前的救命稻草，重要节点务必导一份。<br />
          上面的 Excel / CSV 只是导出来看的，不能用它恢复数据。
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
