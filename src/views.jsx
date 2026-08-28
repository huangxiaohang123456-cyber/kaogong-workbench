import { useEffect, useState } from 'react'
import { today, fmtDur, uid, aggregateSubjects } from './data'
import { useStudyTimer } from './useStudyTimer'

const fmt = (n) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0')

/* ============ 工具 ============ */
// 本地日期字符串（YYYY-MM-DD），基于本地时区
function fmtDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
// 连续学习天数：从今天往前数连续有学习记录的天数；今天尚未学习则从昨天起算（不视为断）
function calcStreak(studyLog) {
  const log = studyLog || {}
  let streak = 0
  const d = new Date()
  if (!(log[fmtDate(d)] > 0)) d.setDate(d.getDate() - 1)
  while (true) {
    const k = fmtDate(d)
    if (log[k] > 0) { streak++; d.setDate(d.getDate() - 1) }
    else break
  }
  return streak
}

// 完成度圆环
function Ring({ pct }) {
  const r = 26
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.min(1, Math.max(0, pct / 100)))
  return (
    <svg className="ring" viewBox="0 0 64 64" width="64" height="64" aria-label={'完成度 ' + pct + '%'}>
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
      <circle cx="32" cy="32" r={r} fill="none" stroke="var(--brand)" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={c.toFixed(1)} strokeDashoffset={off.toFixed(1)}
        transform="rotate(-90 32 32)" style={{ transition: 'stroke-dashoffset .5s ease' }} />
      <text x="32" y="37" textAnchor="middle" fontSize="15" fontWeight="700" fill="var(--ink)">{pct}%</text>
    </svg>
  )
}

/* ============ Dashboard：今日计划页（计时器 + 打卡 + 今日日程） ============ */
export function Dashboard({ s, up, toast }) {
  const timer = useStudyTimer()

  // 计时器当前选中的科目 + 自定义输入态
  const [subject, setSubject] = useState(s.timerSubject || '其他')
  const [addingCustom, setAddingCustom] = useState(false)
  const [customInput, setCustomInput] = useState('')
  const confirmCustom = () => {
    const v = customInput.trim()
    if (!v) { setAddingCustom(false); setCustomInput(''); return }
    const next = s.customSubjects.includes(v) ? s.customSubjects : [...s.customSubjects, v]
    up({ customSubjects: next })
    setSubject(v)
    setAddingCustom(false)
    setCustomInput('')
    toast('已添加科目：' + v + '（下回自动出现在列表里）')
  }

  // 计时器结束：把当前会话秒数算进当日总时长 + 该科目
  const stop = () => {
    const finalSecs = timer.stop()
    if (finalSecs > 0) {
      const t = today()
      const log = { ...s.studyLog, [t]: (s.studyLog[t] || 0) + finalSecs }
      const bySub = { ...(s.studyLogBySubject || {}) }
      const daySub = { ...(bySub[t] || {}) }
      daySub[subject] = (daySub[subject] || 0) + finalSecs
      bySub[t] = daySub
      up({ studyLog: log, studyLogBySubject: bySub, timerSubject: subject })
      toast('已记录 ' + fmtDur(finalSecs) + '（' + subject + '）')
    }
  }

  // 今日日程：增删勾
  const add = (text) => {
    if (!text.trim()) return
    up({ today: [...s.today, { id: uid(), text: text.trim(), done: false }] })
  }
  const toggle = (id) => up({ today: s.today.map((i) => i.id === id ? { ...i, done: !i.done } : i) })
  const del = (id) => up({ today: s.today.filter((i) => i.id !== id) })

  /* ===== 打卡数据 ===== */
  const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']
  const streak = calcStreak(s.studyLog)
  const now = new Date()
  const y = now.getFullYear(), mIdx = now.getMonth(), todayNum = now.getDate()
  const todayKey = fmtDate(now)
  const todayWeekdayCN = WEEK_LABELS[now.getDay()]
  const firstWeekday = new Date(y, mIdx, 1).getDay()

  // 当月（到今天）每天学习强度，0=未学 1=<30min 2=<60min 3=<120min 4=≥120min
  const monthCells = []
  for (let day = 1; day <= todayNum; day++) {
    const dd = new Date(y, mIdx, day)
    const k = fmtDate(dd)
    const secs = (s.studyLog || {})[k] || 0
    const mins = secs / 60
    let level = 0
    if (secs > 0) level = mins >= 120 ? 4 : mins >= 60 ? 3 : mins >= 30 ? 2 : 1
    monthCells.push({ day, date: k, secs, level, isToday: day === todayNum, weekday: dd.getDay() })
  }
  const todayStudiedSecs = (s.studyLog || {})[todayKey] || 0
  const monthStudiedDays = monthCells.filter((c) => c.level > 0).length

  // 本周（周一起算）7 天打卡条
  const weekStart = new Date(y, mIdx, todayNum - ((now.getDay() + 6) % 7))
  const weekCells = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + i)
    const k = fmtDate(d)
    return {
      k, day: d.getDate(), secs: (s.studyLog || {})[k] || 0,
      isToday: k === todayKey, isFuture: k > todayKey,
    }
  })
  const weekDoneDays = weekCells.filter((c) => c.secs > 0).length

  // 最长连续纪录：刷新时写回存档
  const bestStreak = Math.max(Number(s.bestStreak) || 0, streak)
  useEffect(() => {
    if (streak > (Number(s.bestStreak) || 0)) up({ bestStreak: streak })
  }, [streak])

  /* ===== 完成度 ===== */
  const todayList = s.today || []
  const done = todayList.filter((i) => i.done).length
  const donePct = Math.round((done / Math.max(1, todayList.length)) * 100)

  // 计时下拉：基础科目 + 你以前加过的自定义科目
  const subjectOptions = aggregateSubjects(s)

  return (
    <div className="dashboard-stack">

      {/* 学习打卡：连续天数 + 本周条 + 当月热力图 */}
      <div className="card streak-card">
        <div className="card-head-row">
          <div>
            <h3>🔥 学习打卡</h3>
            <p className="streak-date">📅 {y} 年 {mIdx + 1} 月 {todayNum} 日 · 周{todayWeekdayCN}　·　今日{ todayStudiedSecs > 0 ? '已学 ' + fmtDur(todayStudiedSecs) : '尚未学习'}</p>
          </div>
          <div className="streak-big">{streak}<span>天</span></div>
        </div>

        <div className="week-strip">
          {weekCells.map((c, i) => (
            <div key={i} className={'week-dot' + (c.secs > 0 ? ' on' : '') + (c.isToday ? ' today' : '') + (c.isFuture ? ' future' : '')}
              title={c.k + (c.secs > 0 ? ' · 已学 ' + fmtDur(c.secs) : c.isFuture ? ' · 未到' : ' · 未学习')}>
              <span className="wd-label">{'一二三四五六日'[i]}</span>
              <span className="wd-num">{c.day}</span>
            </div>
          ))}
        </div>

        <div className="streak-meta">
          <span>🔥 当前连续 <b>{streak}</b> 天</span>
          <span>🏆 最长纪录 <b>{bestStreak}</b> 天</span>
          <span>📆 本周 <b>{weekDoneDays}</b>/7 天</span>
        </div>

        <div className="heatmap-wrap">
          <div className="heatmap-title">{y} 年 {mIdx + 1} 月　·　本月至今天数 {todayNum}，已打卡 {monthStudiedDays} 天</div>
          <div className="heatmap-weekdays">{WEEK_LABELS.map((w) => <span key={w}>周{w}</span>)}</div>
          <div className="heatmap">
            {Array.from({ length: firstWeekday }, (_, i) => <div key={'e' + i} className="heat-cell empty" />)}
            {monthCells.map((c, i) => (
              <div key={i} className={'heat-cell' + (c.level ? ' lv' + c.level : '') + (c.isToday ? ' today' : '')}
                title={c.date + ' 周' + WEEK_LABELS[c.weekday] + (c.secs ? ' · 学习 ' + fmtDur(c.secs) : ' · 未学习')}>{c.day}</div>
            ))}
          </div>
          <div className="heat-legend">
            <span className="muted">学习时长：少</span>
            <i className="lv1" /><i className="lv2" /><i className="lv3" /><i className="lv4" />
            <span className="muted">多</span>
            <span className="muted" style={{ marginLeft: 8 }}>· 今日有边框</span>
          </div>
        </div>
      </div>

      {/* 今日完成度圆环 + 关键数据 */}
      <div className="card today-ring-card">
        <div className="ring-wrap">
          <Ring pct={donePct} />
          <div className="ring-cap">今日完成度<br /><b>{done}</b> / {todayList.length} 项</div>
        </div>
        <div className="grid cols-3 stat-row" style={{ marginBottom: 0, flex: 1, minWidth: 0 }}>
          <div className="stat"><b>{fmtDur(todayStudiedSecs)}</b><span>今日学习</span></div>
          <div className="stat"><b style={{ fontSize: 16 }}>{timer.running ? '⏱ 运行中' : '⏸ 未开始'}</b><span>计时器</span></div>
          <div className="stat"><b>{weekDoneDays}/7</b><span>本周打卡</span></div>
        </div>
      </div>

      {/* 学习计时器：正计时 / 番茄钟 + 按科目记账 */}
      <div className="card timer-strip">
        <div className="card-head-row">
          <h3 style={{ marginBottom: 0 }}>⏱️ 学习计时器</h3>
          <div className="mode-switch">
            <button className={'mode-btn' + (timer.mode === 'stopwatch' ? ' on' : '')} onClick={() => timer.setMode('stopwatch')}>正计时</button>
            <button className={'mode-btn' + (timer.mode === 'pomodoro' ? ' on' : '')} onClick={() => timer.setMode('pomodoro')}>🍅 番茄钟</button>
          </div>
        </div>

        <div className="timer-subject">
          <span className="ts-label">记到科目</span>
          <select value={subject} onChange={(e) => {
            if (e.target.value === '__CUSTOM__') { setAddingCustom(true); return }
            setSubject(e.target.value)
          }} disabled={timer.running}>
            {subjectOptions.map((x) => <option key={x} value={x}>{x}</option>)}
            <option value="__CUSTOM__">📝 自定义…</option>
          </select>
          {timer.running
            ? <span className="muted" style={{ fontSize: 11.5 }}>计时中不可切换</span>
            : <span className="muted" style={{ fontSize: 11.5 }}>结束记录时归入该科目</span>}
        </div>

        {addingCustom && (
          <div className="row custom-subj-row" style={{ gap: 6 }}>
            <input placeholder="输入科目名，如：面试 / 专业课" value={customInput} onChange={(e) => setCustomInput(e.target.value)} style={{ flex: 1, minWidth: 0 }}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmCustom() }} autoFocus />
            <button className="btn-primary btn-sm" onClick={confirmCustom}>确定</button>
            <button className="btn-ghost btn-sm" onClick={() => { setAddingCustom(false); setCustomInput('') }}>取消</button>
          </div>
        )}

        <div className="timer-strip-main">
          <div className={'clock' + (timer.mode === 'pomodoro' && timer.phase === 'break' ? ' is-break' : '')}>
            {timer.mode === 'pomodoro' ? fmt(timer.remain) : fmt(timer.secs)}
          </div>
          <div className="timer-actions">
            {!timer.running
              ? <button className="btn-primary" onClick={timer.start}>开始</button>
              : <button className="btn-ghost" onClick={timer.pause}>暂停</button>}
            {timer.mode === 'pomodoro' && (
              <button className="btn-ghost" onClick={timer.skipPhase}>跳过本段</button>
            )}
            <button className="btn-danger" onClick={stop}>结束并记录</button>
          </div>
        </div>

        {timer.mode === 'pomodoro' && (
          <div className={'pomo-tip' + (timer.phase === 'break' ? ' break' : '')}>
            {timer.phase === 'focus'
              ? '🍅 专注中 · 25 分钟后自动进入 5 分钟休息'
              : '☕ 休息中 · 5 分钟后自动开始下一轮专注'}
          </div>
        )}

        <p className="muted" style={{ fontSize: 11.5, marginTop: 10, lineHeight: 1.6 }}>
          计时每 15 秒自动计入今日总时长；关掉网页 / 划掉手机后台也不会丢失。
          {timer.mode === 'pomodoro' && '番茄钟每完成一段专注，会自动把这段时长归入所选科目。'}
        </p>
      </div>

      {/* 今日日程：添加 / 勾掉 / 删除 */}
      <div className="card" style={{ marginBottom: 0 }}>
        <h3>📅 今日日程 <span className="tag">{done}/{todayList.length} 已完成</span></h3>
        {todayList.map((i) => (
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

    </div>
  )
}

