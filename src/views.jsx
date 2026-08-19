import { useState } from 'react'
import { today, fmtDur } from './data'
import { useStudyTimer } from './useStudyTimer'

const fmt = (n) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0')
const uid = () => Math.random().toString(36).slice(2, 9)

/* ============ 今日计划 + 计时器 ============ */
export function Dashboard({ s, up, toast }) {
  const timer = useStudyTimer()

  const add = (text) => { if (!text.trim()) return; up({ today: [...s.today, { id: uid(), text, done: false }] }) }
  const toggle = (id) => up({ today: s.today.map((i) => i.id === id ? { ...i, done: !i.done } : i) })
  const del = (id) => up({ today: s.today.filter((i) => i.id !== id) })
  const stop = () => {
    const finalSecs = timer.stop()
    if (finalSecs > 0) {
      const t = today()
      const log = { ...s.studyLog, [t]: (s.studyLog[t] || 0) + finalSecs }
      up({ studyLog: log })
      toast('已记录 ' + fmtDur(finalSecs) + '学习时长')
    }
  }

  const done = s.today.filter((i) => i.done).length
  return (
    <>
      <div className="card">
        <h3>学习计时器 <span className="tag">后台运行</span></h3>
        <div className="timer">
          <div className="clock">{fmt(timer.secs)}</div>
          {!timer.running
            ? <button className="btn-primary" onClick={timer.start}>开始</button>
            : <button className="btn-ghost" onClick={timer.pause}>暂停</button>}
          <button className="btn-danger" onClick={stop}>结束并记录</button>
          <span className="muted" style={{ fontSize: 12.5 }}>切到别的模块也会继续计时，结束即按秒计入今日学习时长</span>
        </div>
      </div>

      <div className="card">
        <h3>今日计划 <span className="tag">{done}/{s.today.length} 已完成</span></h3>
        {s.today.map((i) => (
          <div key={i.id} className={'list-item' + (i.done ? ' done' : '')}>
            <div className={'chk' + (i.done ? ' on' : '')} onClick={() => toggle(i.id)}>{i.done ? '✓' : ''}</div>
            <div className="txt" onClick={() => toggle(i.id)}>{i.text}</div>
            <button className="btn-ghost btn-sm" onClick={() => del(i.id)}>删</button>
          </div>
        ))}
        <div className="row" style={{ marginTop: 10 }}>
          <input id="newToday" placeholder="添加今日任务…" onKeyDown={(e) => { if (e.key === 'Enter') { add(e.target.value); e.target.value = '' } }} />
          <button className="btn-primary btn-sm" onClick={() => { const el = document.getElementById('newToday'); add(el.value); el.value = '' }}>添加</button>
        </div>
      </div>
    </>
  )
}

/* ============ 事项库 ============ */
export function Library({ s, up, toast }) {
  const add = (text, cat, pri) => {
    if (!text.trim()) { toast && toast('请先输入事项内容'); return }
    up({ library: [...s.library, { id: uid(), text, cat, pri }] })
    toast && toast('已添加')
  }
  const del = (id) => up({ library: s.library.filter((i) => i.id !== id) })
  const [text, setText] = useState(''); const [cat, setCat] = useState('方法'); const [pri, setPri] = useState('中')
  const prCls = (p) => p === '高' ? 'high' : p === '中' ? 'mid' : 'low'
  return (
    <div className="card">
      <h3>📚 事项库 <span className="tag">{s.library.length} 条</span></h3>
      {s.library.map((i) => (
        <div key={i.id} className="list-item">
          <div className="txt">{i.text}</div>
          <span className={'chip ' + prCls(i.pri)}>{i.pri}</span>
          <span className="muted" style={{ fontSize: 12 }}>{i.cat}</span>
          <button className="btn-ghost btn-sm" onClick={() => del(i.id)}>删</button>
        </div>
      ))}
      <div className="row" style={{ marginTop: 10, gap: 8 }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="新事项…" />
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 110 }}>
          <option>方法</option><option>记忆</option><option>刷题</option><option>其他</option>
        </select>
        <select value={pri} onChange={(e) => setPri(e.target.value)} style={{ width: 90 }}>
          <option>高</option><option>中</option><option>低</option>
        </select>
        <button className="btn-primary btn-sm" onClick={() => { add(text, cat, pri); setText('') }}>添加</button>
      </div>
    </div>
  )
}

/* ============ 题本进度 ============ */
export function Books({ s, up, toast }) {
  const set = (id, patch) => up({ exams: s.exams.map((e) => e.id === id ? { ...e, ...patch } : e) })
  const add = (name) => {
    if (!name.trim()) { toast && toast('请先输入题本名称'); return }
    up({ exams: [...s.exams, { id: uid(), name, totalQ: 50, completed: 0, wrong: 0 }] })
    toast && toast('已添加题本')
  }
  const del = (id) => up({ exams: s.exams.filter((e) => e.id !== id) })
  const rate = (e) => e.completed ? Math.round(((e.completed - e.wrong) / e.completed) * 100) : 0
  return (
    <div className="card">
      <h3>✍️ 题本进度 <span className="tag">{s.exams.length} 本</span></h3>
      {s.exams.map((e) => (
        <div key={e.id} className="list-item" style={{ flexDirection: 'column', gap: 8 }}>
          <div className="row" style={{ width: '100%' }}>
            <div className="txt" style={{ fontWeight: 600 }}>{e.name}</div>
            <span className="tag">{rate(e)}% 正确</span>
            <button className="btn-ghost btn-sm" onClick={() => del(e.id)}>删</button>
          </div>
          <div className="row" style={{ fontSize: 12.5, color: 'var(--ink2)', gap: 14 }}>
            <label>总量<input type="number" value={e.totalQ} style={{ width: 70 }} onChange={(v) => set(e.id, { totalQ: +v.target.value })} /></label>
            <label>已完成<input type="number" value={e.completed} style={{ width: 70 }} onChange={(v) => set(e.id, { completed: +v.target.value })} /></label>
            <label>错题<input type="number" value={e.wrong} style={{ width: 70 }} onChange={(v) => set(e.id, { wrong: +v.target.value })} /></label>
          </div>
          <div className="bar"><i style={{ width: (e.totalQ ? (e.completed / e.totalQ) * 100 : 0) + '%' }} /></div>
        </div>
      ))}
      <div className="row" style={{ marginTop: 10 }}>
        <input id="newBook" placeholder="新题本名称…" />
        <button className="btn-primary btn-sm" onClick={() => { const el = document.getElementById('newBook'); add(el.value); el.value = '' }}>添加题本</button>
      </div>
    </div>
  )
}

/* ============ 网课进度 ============ */
export function Courses({ s, up, toast }) {
  const set = (id, patch) => up({ courses: s.courses.map((c) => c.id === id ? { ...c, ...patch } : c) })
  const add = (name) => {
    if (!name.trim()) { toast && toast('请先输入课程名称'); return }
    up({ courses: [...s.courses, { id: uid(), name, totalLessons: 60, completedLessons: 0 }] })
    toast && toast('已添加课程')
  }
  const del = (id) => up({ courses: s.courses.filter((c) => c.id !== id) })
  const rate = (c) => c.totalLessons ? Math.round((c.completedLessons / c.totalLessons) * 100) : 0
  return (
    <div className="card">
      <h3>🎬 网课进度 <span className="tag">{s.courses.length} 门</span></h3>
      {s.courses.map((c) => (
        <div key={c.id} className="list-item" style={{ flexDirection: 'column', gap: 8 }}>
          <div className="row" style={{ width: '100%' }}>
            <div className="txt" style={{ fontWeight: 600 }}>{c.name}</div>
            <span className="tag">{rate(c)}%</span>
            <button className="btn-ghost btn-sm" onClick={() => del(c.id)}>删</button>
          </div>
          <div className="row" style={{ fontSize: 12.5, color: 'var(--ink2)', gap: 14 }}>
            <label>总课时<input type="number" value={c.totalLessons} style={{ width: 70 }} onChange={(v) => set(c.id, { totalLessons: +v.target.value })} /></label>
            <label>已学<input type="number" value={c.completedLessons} style={{ width: 70 }} onChange={(v) => set(c.id, { completedLessons: +v.target.value })} /></label>
          </div>
          <div className="bar"><i style={{ width: rate(c) + '%' }} /></div>
        </div>
      ))}
      <div className="row" style={{ marginTop: 10 }}>
        <input id="newCourse" placeholder="新课名称…" />
        <button className="btn-primary btn-sm" onClick={() => { const el = document.getElementById('newCourse'); add(el.value); el.value = '' }}>添加课程</button>
      </div>
    </div>
  )
}

/* ============ 错题盘点 ============ */
export function Wrongs({ s, up, toast }) {
  const add = (subject, q, reason) => {
    if (!q.trim()) { toast && toast('请先输入题目/考点'); return }
    up({ wrongs: [...s.wrongs, { id: uid(), subject, q, reason, master: false }] })
    toast && toast('已添加错题')
  }
  const toggle = (id) => up({ wrongs: s.wrongs.map((w) => w.id === id ? { ...w, master: !w.master } : w) })
  const del = (id) => up({ wrongs: s.wrongs.filter((w) => w.id !== id) })
  const [subject, setSubject] = useState(''); const [q, setQ] = useState(''); const [reason, setReason] = useState('')
  const mastered = s.wrongs.filter((w) => w.master).length
  return (
    <div className="card">
      <h3>❌ 错题盘点 <span className="tag">{mastered}/{s.wrongs.length} 已掌握</span></h3>
      {s.wrongs.map((w) => (
        <div key={w.id} className={'list-item' + (w.master ? ' done' : '')}>
          <div className={'chk' + (w.master ? ' on' : '')} onClick={() => toggle(w.id)}>{w.master ? '✓' : ''}</div>
          <div className="txt">
            <b>{w.subject}</b> · {w.q}
            {w.reason && <div className="muted" style={{ fontSize: 12 }}>原因：{w.reason}</div>}
          </div>
          <button className="btn-ghost btn-sm" onClick={() => del(w.id)}>删</button>
        </div>
      ))}
      <div className="row" style={{ marginTop: 10, gap: 8 }}>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="科目" style={{ width: 110 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="题目/考点" />
        <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="错因（可选）" />
        <button className="btn-primary btn-sm" onClick={() => { add(subject, q, reason); setSubject(''); setQ(''); setReason('') }}>添加</button>
      </div>
    </div>
  )
}

/* ============ 总体分析 ============ */
export function Overall({ s }) {
  const totalQ = s.exams.reduce((a, e) => a + e.totalQ, 0)
  const doneQ = s.exams.reduce((a, e) => a + e.completed, 0)
  const wrongQ = s.exams.reduce((a, e) => a + e.wrong, 0)
  const acc = doneQ ? Math.round(((doneQ - wrongQ) / doneQ) * 100) : 0
  const totalL = s.courses.reduce((a, c) => a + c.totalLessons, 0)
  const doneL = s.courses.reduce((a, c) => a + c.completedLessons, 0)
  const courseRate = totalL ? Math.round((doneL / totalL) * 100) : 0
  const days = Object.keys(s.studyLog).filter((d) => s.studyLog[d] > 0).length
  const totalSecs = Object.values(s.studyLog).reduce((a, b) => a + b, 0)
  return (
    <>
      <div className="grid cols-3" style={{ marginBottom: 16 }}>
        <div className="stat"><b>{acc}%</b><span>题本正确率</span></div>
        <div className="stat"><b>{courseRate}%</b><span>网课完成率</span></div>
        <div className="stat"><b>{days}天</b><span>累计学习天数</span></div>
      </div>
      <div className="card">
        <h3>📊 总体分析</h3>
        <table className="table">
          <tbody>
            <tr><td>题本总量</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{totalQ}</td></tr>
            <tr><td>已完成题量</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{doneQ}</td></tr>
            <tr><td>错题总量</td><td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>{wrongQ}</td></tr>
            <tr><td>网课总课时</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{totalL}</td></tr>
            <tr><td>累计学习时长</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{fmtDur(totalSecs)}</td></tr>
          </tbody>
        </table>
        <div className="bar" style={{ marginTop: 14 }}><i style={{ width: acc + '%' }} /></div>
        <div className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>题本正确率 {acc}%</div>
      </div>
    </>
  )
}

/* ============ 每月分析 ============ */
export function Monthly({ s }) {
  const map = {}
  Object.entries(s.studyLog).forEach(([d, m]) => {
    const mo = d.slice(0, 7)
    map[mo] = (map[mo] || 0) + m
  })
  const rows = Object.entries(map).sort((a, b) => a[0] < b[0] ? 1 : -1)
  const max = Math.max(1, ...rows.map((r) => r[1]))
  return (
    <div className="card">
      <h3>📈 每月分析 <span className="tag">按学习时长</span></h3>
      {rows.length === 0 && <p className="muted">还没有学习时长记录，用「今日计划」里的计时器开始记录吧。</p>}
      {rows.map(([mo, m]) => (
        <div key={mo} style={{ marginBottom: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
            <span>{mo}</span><span className="muted">{fmtDur(m)}</span>
          </div>
          <div className="bar"><i style={{ width: (m / max) * 100 + '%' }} /></div>
        </div>
      ))}
    </div>
  )
}
