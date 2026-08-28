import { useEffect, useRef, useState } from 'react'
import { today, fmtDur, uid, daysTo, cleanDate, LIB_CATS, BOOK_CATS, COURSE_CATS, PRI_OPTIONS, MAX_IMAGES_PER_WRONG, aggregateSubjects, isWrongDue, MASTERY_LABELS, MASTERY_INTERVALS } from './data'
import { useStudyTimer, commitPending } from './useStudyTimer'
import { uploadWrongImage, deleteWrongImage } from './supabaseClient'

const fmt = (n) => String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0')

/* ============ 今日计划 + 计时器 + 倒计时 ============ */
// 本地日期字符串（与 data.yoday 一致，基于本地时区）
function fmtDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0')
}
// 连续学习天数：从今天往前数连续有学习记录（studyLog>0）的天数；今天尚未学习则从昨天起算（不视为断）
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

// 完成度圆环：pct=0~100
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

export function Dashboard({ s, up, toast, user }) {
  const timer = useStudyTimer()
  const [editingCountdowns, setEditingCountdowns] = useState(false)
  const [subject, setSubject] = useState(s.timerSubject || '其他')
  const [tplText, setTplText] = useState('')
  const [tplRepeat, setTplRepeat] = useState('daily')
  // 自定义科目：下拉选「📝 自定义…」时展开小输入框
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
    toast('已添加科目：' + v + '（下回自动出现在列表）')
  }

  // 把「本次已跑但未记账」的秒数记到今日总时长 + 今日科目分布
  const commitTo = (sub) => {
    const p = commitPending()
    if (p <= 0) return 0
    const t = today()
    const log = { ...s.studyLog, [t]: (s.studyLog[t] || 0) + p }
    const bySub = { ...(s.studyLogBySubject || {}) }
    const daySub = { ...(bySub[t] || {}) }
    daySub[sub] = (daySub[sub] || 0) + p
    bySub[t] = daySub
    up({ studyLog: log, studyLogBySubject: bySub, timerSubject: sub })
    return p
  }

  const add = (text) => { if (!text.trim()) return; up({ today: [...s.today, { id: uid(), text, done: false }] }) }
  const toggle = (id) => up({ today: s.today.map((i) => i.id === id ? { ...i, done: !i.done } : i) })
  const del = (id) => up({ today: s.today.filter((i) => i.id !== id) })
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

  // 番茄钟阶段切换提示：专注结束自动结算这一段并提示休息；休息结束提示回来
  const handledPhaseAt = useRef(0)
  const phaseAt = timer.phaseEvent ? timer.phaseEvent.at : 0
  useEffect(() => {
    if (!phaseAt || phaseAt === handledPhaseAt.current) return
    handledPhaseAt.current = phaseAt
    if (timer.phaseEvent.type === 'break') {
      const got = commitTo(subject)
      toast(got > 0
        ? '🍅 专注完成，已记录 ' + fmtDur(got) + '（' + subject + '）· 休息 5 分钟'
        : '🍅 专注时段结束，休息 5 分钟')
    } else {
      toast('☕ 休息结束，开始下一轮专注')
    }
  }, [phaseAt])
  const addFromLib = (libId) => {
    const item = s.library.find((i) => i.id === libId)
    if (!item) return
    up({ today: [...s.today, { id: uid(), text: item.name + (item.defaultMinutes ? '（' + item.defaultMinutes + ' 分钟）' : ''), done: false, libId }] })
    toast('已加入今日：' + item.name)
  }
  const delCd = (id) => {
    up({ countdowns: s.countdowns.filter((c) => c.id !== id) })
    toast('已删除倒计时')
  }
  // 循环事项：新增模板（每天/工作日自动出现在今日日程）
  const addTemplate = (text, repeat) => {
    const t = (text || '').trim()
    if (!t) return
    const id = uid()
    const T = today()
    const dow = new Date().getDay()
    const isWeekday = dow >= 1 && dow <= 5
    const tpl = { id, text: t, repeat }
    const patch = { templates: [...(s.templates || []), tpl] }
    if (repeat !== 'weekday' || isWeekday) {
      patch.today = [...s.today, { id: uid(), text: t, done: false, tplId: id, day: T }]
    }
    up(patch)
    toast('已添加循环事项')
  }
  // 循环事项：删除模板 + 同步移除今日日程里它生成的项
  const delTemplate = (id) => {
    up({
      templates: (s.templates || []).filter((t) => t.id !== id),
      today: s.today.filter((i) => i.tplId !== id),
    })
    toast('已删除循环事项')
  }
  // 自愈：渲染前把 countdowns 里 examDate 含不可见字符 / 格式异常的条目清洗一次，写回 state 后下次云端同步就是干净的
  const dirtyCds = (s.countdowns || []).filter((c) => c.examDate && cleanDate(c.examDate) !== c.examDate)
  if (dirtyCds.length > 0) {
    const fixed = (s.countdowns || []).map((c) =>
      c.examDate && cleanDate(c.examDate) !== c.examDate ? { ...c, examDate: cleanDate(c.examDate) } : c
    )
    queueMicrotask(() => up({ countdowns: fixed }))
    if (typeof console !== 'undefined') console.log('[kaogong] 清洗脏倒计时日期:', dirtyCds.map((c) => c.examDate).join(', '))
  }
  const done = s.today.filter((i) => i.done).length
  const todaySecs = s.studyLog[today()] || 0
  const cdList = (s.countdowns || []).slice(0, 3)
  const totalCd = (s.countdowns || []).length
  // 考试节点提醒：收集每场考试设置的「报名/准考证/查分」节点中尚未过期的，按剩余天数升序
  const NODE_DEFS = [
    { key: 'registerDate', label: '报名截止' },
    { key: 'admitDate', label: '准考证' },
    { key: 'scoreDate', label: '查分' },
  ]
  const examNodes = []
  ;(s.countdowns || []).forEach((c) => {
    NODE_DEFS.forEach((n) => {
      const d = c[n.key]
      if (!d) return
      const raw = daysTo(d)
      if (raw == null || raw < 0) return
      examNodes.push({ exam: c.name, label: n.label, date: d, days: raw })
    })
  })
  examNodes.sort((a, b) => a.days - b.days)
  const hasNodeDates = (s.countdowns || []).some((c) => c.registerDate || c.admitDate || c.scoreDate)

  // 学习打卡：连续天数 + 当月日历热力图（紧凑+年月+周表头）
  const WEEK_LABELS = ['日', '一', '二', '三', '四', '五', '六']
  const streak = calcStreak(s.studyLog)
  const now = new Date()
  const y = now.getFullYear(), mIdx = now.getMonth(), todayNum = now.getDate()
  const todayKey = fmtDate(now)
  const firstWeekday = new Date(y, mIdx, 1).getDay()
  const todayWeekdayCN = WEEK_LABELS[now.getDay()]
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

  // 本周（周一为起点）7 天打卡条
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

  // 最长连续纪录：当前连续天数刷新纪录时写回存档
  const bestStreak = Math.max(Number(s.bestStreak) || 0, streak)
  useEffect(() => {
    if (streak > (Number(s.bestStreak) || 0)) up({ bestStreak: streak })
  }, [streak])

  // 循环事项：挂载时把模板项注入今日日程，并清理「非今天」的过期循环项（保留当天与一次性事项）
  useEffect(() => {
    const T = today()
    const dow = new Date().getDay()
    const isWeekday = dow >= 1 && dow <= 5
    let changed = false
    const next = s.today.slice()
    const pruned = next.filter((i) => !(i.tplId && i.day && i.day !== T))
    if (pruned.length !== next.length) { next.length = 0; pruned.forEach((i) => next.push(i)); changed = true }
    ;(s.templates || []).forEach((tpl) => {
      if (tpl.repeat === 'weekday' && !isWeekday) return
      if (!next.some((i) => i.tplId === tpl.id)) {
        next.push({ id: uid(), text: tpl.text, done: false, tplId: tpl.id, day: T })
        changed = true
      }
    })
    if (changed) up({ today: next })
  }, [])

  // 今日各科目时长分布
  const todaySubMap = (s.studyLogBySubject || {})[todayKey] || {}
  const todaySubList = Object.entries(todaySubMap)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
  const todaySubTotal = todaySubList.reduce((a, [, v]) => a + v, 0)
  // 计时下拉：基础 8 项 + 自动聚合题本/网课/事项库/错题/资料库的分类 + 自定义科目
  const subjectOptions = aggregateSubjects(s)
  // 近 7 天（含今天）各科目累计时长，用于计时器旁「该科目近 7 天」与独立卡
  const week7Days = []
  const week7SubMap = {}
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = fmtDate(d)
    week7Days.push(key)
    const m = (s.studyLogBySubject || {})[key]
    if (m) Object.entries(m).forEach(([k, v]) => { week7SubMap[k] = (week7SubMap[k] || 0) + (v || 0) })
  }
  const week7List = Object.entries(week7SubMap).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const week7Max = Math.max(1, ...week7List.map(([, v]) => v))
  const week7Total = week7List.reduce((a, [, v]) => a + v, 0)
  const curSubWeek7 = week7SubMap[subject] || 0
  // 近 7 天卡：展开某科目查看每天明细
  const [expandedSub, setExpandedSub] = useState(null)
  const donePct = Math.round((done / Math.max(1, s.today.length)) * 100)
  // 待重做错题（驱动首页提醒；实际加入今日计划在「错题复盘」里一键操作）
  const dueWrongs = (s.wrongs || []).filter((w) => isWrongDue(w, today()))

  return (
    <>
      {/* 全部等宽长条纵向堆叠：数据条 → 倒计时 → 计时器 → 今日日程 */}
      <div className="dashboard-stack">

        {/* 学习打卡：紧凑版 + 完整年月日 + 周表头 */}
        <div className="card streak-card">
          <div className="card-head-row">
            <div>
              <h3>🔥 学习打卡</h3>
              <p className="streak-date">📅 {y} 年 {mIdx + 1} 月 {todayNum} 日 · 周{todayWeekdayCN}　·　今日{ todayStudiedSecs > 0 ? '已学 ' + fmtDur(todayStudiedSecs) : '尚未学习'}</p>
            </div>
            <div className="streak-big">{streak}<span>天</span></div>
          </div>

          {/* 本周 7 天打卡条 */}
          <div className="week-strip">
            {weekCells.map((c, i) => (
              <div key={i} className={'week-dot' + (c.secs > 0 ? ' on' : '') + (c.isToday ? ' today' : '') + (c.isFuture ? ' future' : '')}
                title={c.k + (c.secs > 0 ? ' · 已学 ' + fmtDur(c.secs) : c.isFuture ? ' · 未到' : ' · 未学习')}>
                <span className="wd-label">{'一二三四五六日'[i]}</span>
                <span className="wd-num">{c.day}</span>
              </div>
            ))}
          </div>

          {/* 三档统计：当前连续 / 最长纪录 / 本周打卡 */}
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
            <div className="ring-cap">今日完成度<br /><b>{done}</b> / {s.today.length} 项</div>
          </div>
          <div className="grid cols-3 stat-row" style={{ marginBottom: 0, flex: 1, minWidth: 0 }}>
            <div className="stat"><b>{fmtDur(todaySecs)}</b><span>今日学习</span></div>
            <div className="stat"><b style={{ fontSize: 16 }}>{timer.running ? '⏱ 运行中' : '⏸ 未开始'}</b><span>计时器</span></div>
            <div className="stat"><b>{weekDoneDays}/7</b><span>本周打卡</span></div>
          </div>
        </div>

        {/* 待重做错题提醒 */}
        {dueWrongs.length > 0 && (
          <div className="card due-remind-card">
            <span className="due-remind-text">🔁 有 <b>{dueWrongs.length}</b> 道错题到了该重做的日子</span>
            <span className="muted" style={{ fontSize: 12 }}>去「错题复盘」一键加入今日计划</span>
          </div>
        )}

        {/* 今日各科目时长分布卡已升级为「近 7 天科目时长」并移至计时器下方（见 timer-strip 之后） */}

        {/* 倒计时区 */}
        <div className="card">
          <div className="card-head-row">
            <div>
              <h3>⏰ 备考倒计时 <span className="tag">{totalCd} 场</span></h3>
              <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>添加你的考试日期，首页可一眼看到还剩多少天。</p>
            </div>
            <button className="btn-primary btn-sm" onClick={() => setEditingCountdowns(true)}>📝 设置倒计时</button>
          </div>
          {cdList.length === 0 ? (
            <p className="muted" style={{ fontSize: 13, textAlign: 'center', padding: 24 }}>还没有倒计时，点右上「设置倒计时」添加你的考试目标。</p>
          ) : (
            <div className="countdown-grid">
              {cdList.map((c) => {
                const raw = daysTo(c.examDate)
                // 锁底 0：过去日期不再继续倒数，显示 0（不出现负数 / 「天前已过」）
                const d = raw == null ? null : Math.max(0, raw)
                let label
                if (d == null) label = c.examDate ? '日期无效' : '未设日期'
                else if (raw > 0) label = '天后'
                else if (raw === 0) label = '就是今天'
                else label = '已开考' // raw < 0，按用户要求不再往下减
                return (
                  <div key={c.id} className="countdown-card">
                    <button className="cd-del" onClick={() => delCd(c.id)} aria-label="删除倒计时" title="删除这场倒计时">×</button>
                    <div className="cd-num">{d != null ? d : '—'}</div>
                    <div className="cd-label">{label}</div>
                    <div className="cd-name">{c.name}</div>
                    <div className="cd-date">{c.examDate || '未设日期'}</div>
                  </div>
                )
              })}
            </div>
          )}
          {/* 考试节点提醒：报名/准考证/查分 等尚未过期的节点 */}
          {hasNodeDates && (
            <div className="exam-nodes">
              <div className="exam-nodes-title">📌 考试节点提醒</div>
              {examNodes.length === 0 ? (
                <p className="muted" style={{ fontSize: 12.5 }}>已设的节点都已过期，可点「设置倒计时」更新节点日期。</p>
              ) : (
                examNodes.map((n, i) => (
                  <div key={i} className="exam-node-row">
                    <span className="en-exam">{n.exam}</span>
                    <span className="en-label">{n.label}</span>
                    <span className={'en-days' + (n.days === 0 ? ' today' : '')}>{n.days === 0 ? '就是今天' : '还剩 ' + n.days + ' 天'}</span>
                    <span className="muted en-date">{n.date}</span>
                  </div>
                ))
              )}
            </div>
          )}
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

          {/* B1：计时器内实时展示今日已记录 + 当前科目近 7 天累计 */}
          <div className="timer-recorded">
            <div className="tr-head">
              <span>⏱️ 今日已记录</span>
              <span className="muted" style={{ fontSize: 11.5 }}>{todaySubTotal > 0 ? fmtDur(todaySubTotal) : '还没开始'}</span>
            </div>
            {todaySubList.length === 0 ? (
              <p className="muted" style={{ fontSize: 12, margin: '4px 0 0' }}>选好科目点「开始」，结束会自动记到这里</p>
            ) : (
              <div className="tr-chips">
                {todaySubList.map(([k, v]) => (
                  <span key={k} className={'tr-chip' + (k === subject ? ' cur' : '')}>{k} {fmtDur(v)}</span>
                ))}
              </div>
            )}
            {curSubWeek7 > 0 && (
              <p className="muted" style={{ fontSize: 11.5, margin: '6px 0 0' }}>📈 「{subject}」近 7 天累计 {fmtDur(curSubWeek7)}</p>
            )}
          </div>

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

        {/* B2：近 7 天科目时长分布（移到计时器下方，更显眼）+ 点击科目展开每日明细 */}
        {week7List.length > 0 && (
          <div className="card sub-dist-card">
            <h3>📊 近 7 天科目时长 <span className="tag">共 {fmtDur(week7Total)}</span></h3>
            <p className="muted" style={{ fontSize: 12, margin: '0 0 10px' }}>各科目最近 7 天（含今天）累计学习时长，点任一科目可看每天明细。</p>
            {week7List.map(([k, v]) => (
              <div key={k} className="sub-dist-wrap">
                <div className={'sub-dist-row clickable' + (expandedSub === k ? ' open' : '')}
                  onClick={() => setExpandedSub(expandedSub === k ? null : k)}>
                  <span className="sub-dist-name">{k}</span>
                  <div className="sub-dist-bar"><i style={{ width: Math.max(4, Math.round((v / week7Max) * 100)) + '%' }} /></div>
                  <span className="sub-dist-val">{fmtDur(v)}</span>
                  <span className="sub-expand">{expandedSub === k ? '▲' : '▼'}</span>
                </div>
                {expandedSub === k && (
                  <div className="sub-day-detail">
                    {week7Days.map((d) => {
                      const dv = ((s.studyLogBySubject || {})[d] || {})[k] || 0
                      return (
                        <div key={d} className="sub-day-row">
                          <span className="sub-day-lab">{d.slice(5)}</span>
                          <div className="sub-day-bar"><i style={{ width: (v > 0 ? Math.max(3, Math.round((dv / v) * 100)) : 0) + '%' }} /></div>
                          <span className="sub-day-val">{dv > 0 ? fmtDur(dv) : '—'}</span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 循环事项：每天/工作日自动出现在今日日程，不用重复添加 */}
        <div className="card" style={{ marginBottom: 0 }}>
          <h3>🔁 循环事项 <span className="tag">{(s.templates || []).length} 个</span></h3>
          <p className="muted" style={{ fontSize: 12.5, margin: '0 0 10px' }}>设置后每天（或仅工作日）自动出现在下方今日日程，勾掉当天会自动刷新，不用重复添加。</p>
          {(s.templates || []).length === 0 ? (
            <p className="muted" style={{ fontSize: 13, padding: '4px 0 10px' }}>还没有循环事项，下面加一个试试（如：背 30 个成语、晨读申论范文）。</p>
          ) : (
            (s.templates || []).map((t) => (
              <div key={t.id} className="list-item">
                <span className="tpl-repeat">{t.repeat === 'weekday' ? '工作日' : '每天'}</span>
                <div className="txt">{t.text}</div>
                <button className="btn-ghost btn-sm" onClick={() => delTemplate(t.id)}>删</button>
              </div>
            ))
          )}
          <div className="row" style={{ marginTop: 10, gap: 8 }}>
            <input placeholder="如：背 30 个成语" value={tplText} onChange={(e) => setTplText(e.target.value)} style={{ flex: 1 }}
              onKeyDown={(e) => { if (e.key === 'Enter') { addTemplate(tplText, tplRepeat); setTplText('') } }} />
            <select value={tplRepeat} onChange={(e) => setTplRepeat(e.target.value)} style={{ width: 96 }}>
              <option value="daily">每天</option>
              <option value="weekday">工作日</option>
            </select>
            <button className="btn-primary btn-sm" onClick={() => { addTemplate(tplText, tplRepeat); setTplText('') }}>添加</button>
          </div>
        </div>

        {/* 今日日程：横条 */}
        <div className="card" style={{ marginBottom: 0 }}>
          <h3>📅 今日日程 <span className="tag">{done}/{s.today.length} 已完成</span></h3>
          {s.today.map((i) => (
            <div key={i.id} className={'list-item' + (i.done ? ' done' : '')}>
              <div className={'chk' + (i.done ? ' on' : '')} onClick={() => toggle(i.id)}>{i.done ? '✓' : ''}</div>
              <div className="txt" onClick={() => toggle(i.id)}>{i.tplId && <span className="tpl-dot" title="循环事项">🔁</span>}{i.text}</div>
              <button className="btn-ghost btn-sm" onClick={() => del(i.id)}>删</button>
            </div>
          ))}
          <div className="row" style={{ marginTop: 10 }}>
            <input id="newToday" placeholder="添加今日任务…" onKeyDown={(e) => { if (e.key === 'Enter') { add(e.target.value); e.target.value = '' } }} />
            <button className="btn-primary btn-sm" onClick={() => { const el = document.getElementById('newToday'); add(el.value); el.value = '' }}>添加</button>
          </div>
          {s.library.length > 0 && (
            <details style={{ marginTop: 10 }}>
              <summary style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: 12.5 }}>📚 从事项库添加…</summary>
              <div className="lib-pick-list">
                {s.library.map((i) => (
                  <button key={i.id} className="lib-pick" onClick={() => addFromLib(i.id)}>
                    {i.name} <span className="muted">· {i.defaultMinutes} 分钟</span>
                  </button>
                ))}
              </div>
            </details>
          )}
        </div>

      </div>

      {editingCountdowns && (
        <CountdownModal list={s.countdowns || []} onClose={() => setEditingCountdowns(false)}
          onSave={(list) => { up({ countdowns: list }); toast('已保存'); setEditingCountdowns(false) }} />
      )}
    </>
  )
}

function CountdownModal({ list, onClose, onSave }) {
  const [items, setItems] = useState(list.map((i) => ({ ...i })))
  const update = (id, patch) => setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i))
  const add = () => setItems((prev) => [...prev, { id: uid(), name: '', examDate: '' }])
  const del = (id) => setItems((prev) => prev.filter((i) => i.id !== id))
  const save = () => {
    const cleaned = items.filter((i) => i.name.trim() && i.examDate)
    onSave(cleaned.slice(0, 3))
  }
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>⏰ 备考倒计时</h3>
          <button className="btn-ghost btn-sm" onClick={onClose}>关闭</button>
        </div>
        <p className="muted" style={{ fontSize: 12.5, marginBottom: 10 }}>最多 3 场考试，首页会显示倒计时天数。</p>
        {items.map((i) => (
          <div key={i.id} className="cd-edit-block">
            <div className="row" style={{ marginBottom: 6, gap: 8 }}>
              <input value={i.name} onChange={(e) => update(i.id, { name: e.target.value })} placeholder="考试名（如国考）" style={{ flex: 1 }} />
              <input type="date" value={i.examDate} onChange={(e) => update(i.id, { examDate: e.target.value })} style={{ width: 150 }} title="考试日期" />
              <button className="btn-ghost btn-sm" onClick={() => del(i.id)}>删</button>
            </div>
            <div className="cd-nodes">
              <label>报名截止<input type="date" value={i.registerDate || ''} onChange={(e) => update(i.id, { registerDate: e.target.value })} /></label>
              <label>准考证<input type="date" value={i.admitDate || ''} onChange={(e) => update(i.id, { admitDate: e.target.value })} /></label>
              <label>查分<input type="date" value={i.scoreDate || ''} onChange={(e) => update(i.id, { scoreDate: e.target.value })} /></label>
            </div>
          </div>
        ))}
        <button className="btn-ghost btn-sm" onClick={add} disabled={items.length >= 3}>+ 添加一场</button>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn-primary btn-block" onClick={save}>保存</button>
        </div>
      </div>
    </div>
  )
}

/* ============ 事项库（卡片化 + 加入今天 + 默认时长） ============ */
export function Library({ s, up, toast }) {
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const del = (id) => {
    const affected = s.today.filter((i) => i.libId === id).length
    up({
      library: s.library.filter((i) => i.id !== id),
      // 级联删除：只移除「从事项库加入今日日程」的关联项（带 libId 且等于被删事项）
      today: s.today.filter((i) => i.libId !== id),
    })
    toast(affected > 0 ? '已删除事项，并从今日日程移除 ' + affected + ' 条关联事项' : '已删除事项')
  }
  const addToToday = (item) => {
    up({ today: [...s.today, { id: uid(), text: item.name + (item.defaultMinutes ? '（' + item.defaultMinutes + ' 分钟）' : ''), done: false, libId: item.id }] })
    toast('已加入今日：' + item.name)
  }
  return (
    <div className="card">
      <div className="card-head-row">
        <div>
          <h3>📚 事项库 <span className="tag">{s.library.length} 条</span></h3>
          <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>把想刷的知识点、笔记、资料记下来，随时可加入今日计划。</p>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setAdding(true)}>➕ 添加自定义事项</button>
      </div>
      {s.library.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, textAlign: 'center', padding: 30 }}>还没有事项，点右上「添加自定义事项」开始记录。</p>
      ) : (
        <div className="lib-grid">
          {s.library.map((i) => (
            <div key={i.id} className="lib-card">
              <div className="lib-card-name">{i.name}</div>
              <div className="lib-card-meta">
                <span className="chip">{i.cat}</span>
                <span className="muted">默认时长 {i.defaultMinutes} 分钟</span>
              </div>
              <div className="lib-card-actions">
                <button className="btn-primary btn-sm" onClick={() => addToToday(i)}>加入今天</button>
                <button className="btn-ghost btn-sm" onClick={() => setEditing(i)}>修改</button>
                <button className="btn-ghost btn-sm" onClick={() => del(i.id)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && <LibItemModal item={editing} existedCats={Array.from(new Set(s.library.map((i) => i.cat).filter(Boolean)))} onClose={() => setEditing(null)}
        onSave={(item) => { up({ library: s.library.map((i) => i.id === item.id ? item : i) }); toast('已保存'); setEditing(null) }} />}
      {adding && <LibItemModal item={{ name: '', cat: '其他', pri: '中', defaultMinutes: 30 }} isNew existedCats={Array.from(new Set(s.library.map((i) => i.cat).filter(Boolean)))}
        onClose={() => setAdding(false)}
        onSave={(item) => { up({ library: [...s.library, { ...item, id: uid() }] }); toast('已添加'); setAdding(false) }} />}
    </div>
  )
}

function LibItemModal({ item, isNew, existedCats, onClose, onSave }) {
  const [name, setName] = useState(item.name || '')
  const [cat, setCat] = useState(item.cat || '其他')
  const [pri, setPri] = useState(item.pri || '中')
  const [defaultMinutes, setDefaultMinutes] = useState(item.defaultMinutes || 30)
  // 合并内置分类 + 已有事项的自定义分类，去重
  const allCats = Array.from(new Set([...LIB_CATS, ...(existedCats || [])]))
  const submit = () => { if (!name.trim()) return; onSave({ ...item, name: name.trim(), cat: (cat || '').trim() || '其他', pri, defaultMinutes: Number(defaultMinutes) || 30 }) }
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{isNew ? '➕ 添加事项' : '✏️ 修改事项'}</h3>
          <button className="btn-ghost btn-sm" onClick={onClose}>关闭</button>
        </div>
        <div className="field"><label>事项名称</label><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
        <div className="field">
          <label>分类（可输入自定义）</label>
          <input list="lib-cats-list" value={cat} onChange={(e) => setCat(e.target.value)} placeholder="如：方法 / 记忆 / 刷题，或自己输入新分类" />
          <datalist id="lib-cats-list">
            {allCats.map((c) => <option key={c} value={c} />)}
          </datalist>
          <div className="cat-chips">
            {allCats.map((c) => (
              <button key={c} type="button" className={'cat-chip' + (c === cat ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>点上面的标签快速选择，或直接在输入框里打字新建分类。</p>
        </div>
        <div className="field">
          <label>优先级</label>
          <select value={pri} onChange={(e) => setPri(e.target.value)}>{PRI_OPTIONS.map((c) => <option key={c}>{c}</option>)}</select>
        </div>
        <div className="field"><label>默认时长（分钟）</label><input type="number" min="5" max="600" value={defaultMinutes} onChange={(e) => setDefaultMinutes(e.target.value)} /></div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn-primary btn-block" onClick={submit}>保存</button>
        </div>
      </div>
    </div>
  )
}

/* ============ 题本进度（卡片化） ============ */
export function Books({ s, up, toast }) {
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const del = (id) => up({ exams: s.exams.filter((e) => e.id !== id) })
  const rate = (e) => e.completed ? Math.round(((e.completed - e.wrong) / e.completed) * 100) : 0
  // 最近的未来倒计时（用于「计划 vs 实际」落后预警）
  const near = (s.countdowns || [])
    .map((c) => ({ c, d: daysTo(c.date) }))
    .filter((x) => x.d != null && x.d >= 0)
    .sort((a, b) => a.d - b.d)[0]
  return (
    <div className="card">
      <div className="card-head-row">
        <div>
          <h3>✍️ 题本进度 <span className="tag">{s.exams.length} 本</span></h3>
          <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>记录题本刷题量、错题数、正确率，按时复盘。</p>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setAdding(true)}>➕ 添加题本</button>
      </div>
      {near && (
        <div className="pace-warn">
          <div className="pace-warn-head">📊 进度预警 · 距「{near.c.name}」还有 <b>{near.d}</b> 天</div>
          {s.exams.map((e) => {
            const remaining = (e.totalQ || 0) - (e.completed || 0)
            if (remaining <= 0) return null
            const req = Math.ceil(remaining / near.d)
            const set = Number(e.dailyTarget) || 0
            const status = set <= 0 ? 'neutral' : (set >= req ? 'ok' : 'behind')
            const gap = status === 'behind' ? (req - set) * near.d : 0
            return (
              <div key={e.id} className={'pace-row pace-' + status}>
                <span className="pace-name">{e.name}</span>
                <span className="pace-info">剩 {remaining} 题 · 建议每天 {req} 题</span>
                <span className="pace-tag">{status === 'neutral' ? '未设目标' : status === 'ok' ? '✅ 充足' : '⚠️ 落后约 ' + gap + ' 题'}</span>
              </div>
            )
          })}
        </div>
      )}
      {!near && s.exams.some((e) => (e.totalQ || 0) > (e.completed || 0)) && (
        <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>💡 在首页设置考试倒计时后，这里会自动算出「建议每天做多少题」的进度预警。</p>
      )}
      {s.exams.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, textAlign: 'center', padding: 30 }}>还没有题本，点右上「添加题本」开始记录。</p>
      ) : (
        <div className="lib-grid">
          {s.exams.map((e) => {
            const pct = e.totalQ ? Math.round((e.completed / e.totalQ) * 100) : 0
            return (
              <div key={e.id} className="lib-card">
                <div className="lib-card-name">{e.name}</div>
                <div className="lib-card-meta"><span className="chip">{e.cat}</span></div>
                <div className="lib-card-stat">
                  <span><b>{e.completed}</b>/{e.totalQ} 题</span>
                  <span className="muted">{pct}% 进度</span>
                  <span style={{ color: 'var(--brand-d)', fontWeight: 600 }}>{rate(e)}% 正确</span>
                </div>
                <div className="bar"><i style={{ width: pct + '%' }} /></div>
                <div className="lib-card-actions">
                  <button className="btn-ghost btn-sm" onClick={() => setEditing(e)}>修改数据</button>
                  <button className="btn-ghost btn-sm" onClick={() => del(e.id)}>删除</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {editing && <BookEditModal item={editing} existedCats={Array.from(new Set(s.exams.map((e) => e.cat).filter(Boolean)))} onClose={() => setEditing(null)}
        onSave={(item) => { up({ exams: s.exams.map((i) => i.id === item.id ? item : i) }); toast('已保存'); setEditing(null) }} />}
      {adding && <BookEditModal item={{ name: '', cat: '其他', totalQ: 50, completed: 0, wrong: 0 }} isNew existedCats={Array.from(new Set(s.exams.map((e) => e.cat).filter(Boolean)))}
        onClose={() => setAdding(false)}
        onSave={(item) => { up({ exams: [...s.exams, { ...item, id: uid() }] }); toast('已添加'); setAdding(false) }} />}
    </div>
  )
}

function BookEditModal({ item, isNew, existedCats, onClose, onSave }) {
  const [name, setName] = useState(item.name || '')
  const [cat, setCat] = useState(item.cat || '其他')
  const [totalQ, setTotalQ] = useState(item.totalQ || 50)
  const [completed, setCompleted] = useState(item.completed || 0)
  const [wrong, setWrong] = useState(item.wrong || 0)
  const [dailyTarget, setDailyTarget] = useState(item.dailyTarget || 0)
  // 合并内置分类 + 已有题本的自定义分类，去重
  const allCats = Array.from(new Set([...BOOK_CATS, ...(existedCats || [])]))
  const submit = () => {
    if (!name.trim()) return
    onSave({ ...item, name: name.trim(), cat: (cat || '').trim() || '其他', totalQ: Number(totalQ) || 0, completed: Number(completed) || 0, wrong: Math.min(Number(wrong) || 0, Number(completed) || 0), dailyTarget: Number(dailyTarget) || 0 })
  }
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{isNew ? '➕ 添加题本' : '✏️ 修改题本'}</h3>
          <button className="btn-ghost btn-sm" onClick={onClose}>关闭</button>
        </div>
        <div className="field"><label>题本名称</label><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
        <div className="field">
          <label>分类（可输入自定义）</label>
          <input list="book-cats-list" value={cat} onChange={(e) => setCat(e.target.value)} placeholder="如：言语 / 判断 / 资料，或自己输入新分类" />
          <datalist id="book-cats-list">
            {allCats.map((c) => <option key={c} value={c} />)}
          </datalist>
          <div className="cat-chips">
            {allCats.map((c) => (
              <button key={c} type="button" className={'cat-chip' + (c === cat ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>点上面的标签快速选择，或直接在输入框里打字新建分类。</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}><label>总题数</label><input type="number" min="0" value={totalQ} onChange={(e) => setTotalQ(e.target.value)} /></div>
          <div className="field" style={{ flex: 1 }}><label>已完成</label><input type="number" min="0" value={completed} onChange={(e) => setCompleted(e.target.value)} /></div>
          <div className="field" style={{ flex: 1 }}><label>错题数</label><input type="number" min="0" value={wrong} onChange={(e) => setWrong(e.target.value)} /></div>
        </div>
        <div className="field" style={{ marginTop: 8 }}><label>每日目标（题/天，0 表示不设目标）</label><input type="number" min="0" value={dailyTarget} onChange={(e) => setDailyTarget(e.target.value)} placeholder="如：30" /></div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn-primary btn-block" onClick={submit}>保存</button>
        </div>
      </div>
    </div>
  )
}

/* ============ 网课进度（URL + 打开课程） ============ */
export function Courses({ s, up, toast }) {
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const del = (id) => up({ courses: s.courses.filter((c) => c.id !== id) })
  const openCourse = (c) => {
    if (c.url) { window.open(c.url, '_blank', 'noopener') }
    else { toast('该课程还未设置链接，点「修改」添加') }
  }
  // 最近的未来倒计时（用于「计划 vs 实际」落后预警）
  const near = (s.countdowns || [])
    .map((c) => ({ c, d: daysTo(c.date) }))
    .filter((x) => x.d != null && x.d >= 0)
    .sort((a, b) => a.d - b.d)[0]
  return (
    <div className="card">
      <div className="card-head-row">
        <div>
          <h3>🎬 网课进度 <span className="tag">{s.courses.length} 门</span></h3>
          <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>新建课程可填课程链接，点「打开课程」一键跳转。</p>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setAdding(true)}>➕ 添加网课</button>
      </div>
      {near && (
        <div className="pace-warn">
          <div className="pace-warn-head">📊 进度预警 · 距「{near.c.name}」还有 <b>{near.d}</b> 天</div>
          {s.courses.map((c) => {
            const remaining = (c.totalLessons || 0) - (c.completedLessons || 0)
            if (remaining <= 0) return null
            const req = Math.ceil(remaining / near.d)
            const set = Number(c.dailyTarget) || 0
            const status = set <= 0 ? 'neutral' : (set >= req ? 'ok' : 'behind')
            const gap = status === 'behind' ? (req - set) * near.d : 0
            return (
              <div key={c.id} className={'pace-row pace-' + status}>
                <span className="pace-name">{c.name}</span>
                <span className="pace-info">剩 {remaining} 节 · 建议每天 {req} 节</span>
                <span className="pace-tag">{status === 'neutral' ? '未设目标' : status === 'ok' ? '✅ 充足' : '⚠️ 落后约 ' + gap + ' 节'}</span>
              </div>
            )
          })}
        </div>
      )}
      {!near && s.courses.some((c) => (c.totalLessons || 0) > (c.completedLessons || 0)) && (
        <p className="muted" style={{ fontSize: 12.5, margin: '8px 0 0' }}>💡 在首页设置考试倒计时后，这里会自动算出「建议每天学多少节」的进度预警。</p>
      )}
      {s.courses.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, textAlign: 'center', padding: 30 }}>还没有网课，点右上「添加网课」开始记录。</p>
      ) : (
        <div className="lib-grid">
          {s.courses.map((c) => {
            const pct = c.totalLessons ? Math.round((c.completedLessons / c.totalLessons) * 100) : 0
            return (
              <div key={c.id} className="lib-card">
                <div className="lib-card-name">{c.name}</div>
                <div className="lib-card-meta"><span className="chip">{c.cat}</span></div>
                <div className="lib-card-stat">
                  <span><b>{c.completedLessons}</b>/{c.totalLessons} 节</span>
                  <span style={{ color: 'var(--brand-d)', fontWeight: 600 }}>{pct}% 进度</span>
                </div>
                <div className="bar"><i style={{ width: pct + '%' }} /></div>
                <div className="lib-card-actions">
                  <button className="btn-primary btn-sm" onClick={() => openCourse(c)}>🔗 打开课程</button>
                  <button className="btn-ghost btn-sm" onClick={() => setEditing(c)}>修改</button>
                  <button className="btn-ghost btn-sm" onClick={() => del(c.id)}>删除</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {editing && <CourseEditModal item={editing} existedCats={Array.from(new Set(s.courses.map((c) => c.cat).filter(Boolean)))} onClose={() => setEditing(null)}
        onSave={(item) => { up({ courses: s.courses.map((i) => i.id === item.id ? item : i) }); toast('已保存'); setEditing(null) }} />}
      {adding && <CourseEditModal item={{ name: '', cat: '其他', totalLessons: 60, completedLessons: 0, url: '' }} isNew existedCats={Array.from(new Set(s.courses.map((c) => c.cat).filter(Boolean)))}
        onClose={() => setAdding(false)}
        onSave={(item) => { up({ courses: [...s.courses, { ...item, id: uid() }] }); toast('已添加'); setAdding(false) }} />}
    </div>
  )
}

function CourseEditModal({ item, isNew, existedCats, onClose, onSave }) {
  const [name, setName] = useState(item.name || '')
  const [cat, setCat] = useState(item.cat || '其他')
  const [totalLessons, setTotalLessons] = useState(item.totalLessons || 60)
  const [completedLessons, setCompletedLessons] = useState(item.completedLessons || 0)
  const [url, setUrl] = useState(item.url || '')
  const [dailyTarget, setDailyTarget] = useState(item.dailyTarget || 0)
  // 合并内置科目 + 已有网课的自定义科目，去重
  const allCats = Array.from(new Set([...COURSE_CATS, ...(existedCats || [])]))
  const submit = () => {
    if (!name.trim()) return
    onSave({ ...item, name: name.trim(), cat: (cat || '').trim() || '其他', totalLessons: Number(totalLessons) || 0, completedLessons: Number(completedLessons) || 0, url: url.trim(), dailyTarget: Number(dailyTarget) || 0 })
  }
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{isNew ? '➕ 添加网课' : '✏️ 修改网课'}</h3>
          <button className="btn-ghost btn-sm" onClick={onClose}>关闭</button>
        </div>
        <div className="field"><label>课程名称</label><input value={name} onChange={(e) => setName(e.target.value)} autoFocus /></div>
        <div className="field">
          <label>科目（可输入自定义）</label>
          <input list="course-cats-list" value={cat} onChange={(e) => setCat(e.target.value)} placeholder="如：言语 / 判断 / 资料，或自己输入新分类" />
          <datalist id="course-cats-list">
            {allCats.map((c) => <option key={c} value={c} />)}
          </datalist>
          <div className="cat-chips">
            {allCats.map((c) => (
              <button key={c} type="button" className={'cat-chip' + (c === cat ? ' on' : '')} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>点上面的标签快速选择，或直接在输入框里打字新建分类。</p>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}><label>总课时</label><input type="number" min="0" value={totalLessons} onChange={(e) => setTotalLessons(e.target.value)} /></div>
          <div className="field" style={{ flex: 1 }}><label>已学课时</label><input type="number" min="0" value={completedLessons} onChange={(e) => setCompletedLessons(e.target.value)} /></div>
        </div>
        <div className="field"><label>课程链接（URL，可选）</label><input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></div>
        <div className="field" style={{ marginTop: 8 }}><label>每日目标（节/天，0 表示不设目标）</label><input type="number" min="0" value={dailyTarget} onChange={(e) => setDailyTarget(e.target.value)} placeholder="如：2" /></div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn-primary btn-block" onClick={submit}>保存</button>
        </div>
      </div>
    </div>
  )
}

/* ============ 错题复盘（图片 + 灯箱） ============ */
export function Wrongs({ s, up, toast, user }) {
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const del = (id) => up({ wrongs: s.wrongs.filter((w) => w.id !== id) })
  // 三态掌握度：标记时同步更新 lastReview（驱动艾宾浩斯重做节奏）
  const setMastery = (id, level) => up({ wrongs: s.wrongs.map((w) => w.id === id ? { ...w, mastery: level, lastReview: today() } : w) })
  // 在错题弹窗里快速新建题本，返回新题本 id（供下拉自动选中）
  const addBookQuick = (name) => {
    const id = uid()
    up({ exams: [...s.exams, { id, name: name.trim(), cat: '其他', totalQ: 0, completed: 0, wrong: 0, dailyTarget: 0 }] })
    toast('已新建题本：' + name.trim())
    return id
  }

  const t = today()
  const dueList = s.wrongs.filter((w) => isWrongDue(w, t))
  const [filter, setFilter] = useState('all')
  const filtered = filter === 'all' ? s.wrongs
    : filter === 'due' ? dueList
    : s.wrongs.filter((w) => (w.mastery || 'unset') === filter)

  // 按题本分组
  const bookMap = {}
  s.exams.forEach((b) => { bookMap[b.id] = b })
  const grouped = {}
  filtered.forEach((w) => {
    const key = (w.bookId && bookMap[w.bookId]) ? bookMap[w.bookId].name : (w.subject || '未分类')
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(w)
  })
  const groups = Object.entries(grouped).map(([k, v]) => ({ name: k, items: v }))

  const onUpload = async (id, files) => {
    if (!files || !files.length) return
    if (!user) { toast('请先登录后再上传错题图片'); return }
    const w = s.wrongs.find((x) => x.id === id)
    if (!w) return
    const remain = MAX_IMAGES_PER_WRONG - (w.images || []).length
    if (remain <= 0) { toast('已达 ' + MAX_IMAGES_PER_WRONG + ' 张上限，请先删除'); return }
    const toUpload = Array.from(files).slice(0, remain)
    toast('正在上传 ' + toUpload.length + ' 张图片…')
    const uploaded = []
    for (const f of toUpload) {
      try {
        const r = await uploadWrongImage(user.id, f)
        uploaded.push(r)
      } catch (e) {
        toast('上传失败：' + (e.message || e))
      }
    }
    if (uploaded.length) {
      const newImages = [...(w.images || []), ...uploaded]
      up({ wrongs: s.wrongs.map((x) => x.id === id ? { ...x, images: newImages } : x) })
      toast('已上传 ' + uploaded.length + ' 张')
    }
  }

  const onDeleteImg = async (id, img) => {
    if (!confirm('删除这张图片？')) return
    try { await deleteWrongImage(img.path) } catch (e) {}
    up({ wrongs: s.wrongs.map((w) => w.id === id ? { ...w, images: (w.images || []).filter((i) => i.path !== img.path) } : w) })
    toast('已删除')
  }

  return (
    <div className="card">
      <div className="card-head-row">
        <div>
          <h3>❌ 错题复盘 <span className="tag">{dueList.length} 待重做 · {s.wrongs.filter((w) => (w.mastery || 'unset') === 'mastered').length}/{s.wrongs.length} 已掌握</span></h3>
          <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>点击图片可放大查看，按题本归档、定期复盘更高效。</p>
        </div>
        <button className="btn-primary btn-sm" onClick={() => setAdding(true)}>➕ 添加错题</button>
      </div>
      <p className="privacy-note">🔒 错题图片同样存于<b>公开存储桶</b>：链接不外露即安全，请勿上传含个人信息的证件照。</p>

      <div className="wrong-filter">
        {['all', 'unset', 'fuzzy', 'mastered', 'due'].map((k) => (
          <button key={k} className={'wf-tab' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>
            {k === 'all' ? '全部' : k === 'due' ? '待重做' : MASTERY_LABELS[k]}
            {k === 'due' && dueList.length ? ' (' + dueList.length + ')' : ''}
          </button>
        ))}
      </div>
      {dueList.length > 0 && (
        <div className="wrong-due-banner">
          <span>🔁 有 <b>{dueList.length}</b> 道错题到了该重做的日子（按艾宾浩斯节奏自动计算）</span>
          <button className="btn-primary btn-sm" onClick={() => {
            const adds = dueList.map((w) => ({ id: uid(), text: '重做错题：' + (w.subject || '') + '·' + (w.q || ''), done: false, libId: null }))
            up({ today: [...s.today, ...adds] })
            toast('已把 ' + adds.length + ' 道待重做错题加入今日计划')
          }}>一键加入今日计划</button>
        </div>
      )}

      {s.wrongs.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, textAlign: 'center', padding: 30 }}>还没有错题，点右上「添加错题」开始记录，可附图片。</p>
      ) : groups.map((g) => (
        <div key={g.name} className="wrong-group">
          <div className="wrong-group-head">{g.name} <span className="tag">{g.items.length} 条</span></div>
          {g.items.map((w) => (
            <div key={w.id} className={'wrong-card' + ((w.mastery || 'unset') === 'mastered' ? ' done' : '')}>
              <div className="wrong-card-main">
                <div className="wrong-card-info">
                  <div className="wrong-card-q"><b>{w.subject}</b> · {w.q}</div>
                  {w.reason && <div className="muted" style={{ fontSize: 12 }}>原因：{w.reason}</div>}
                  {w.note && <div className="muted" style={{ fontSize: 12 }}>备注：{w.note}</div>}
                  <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>记录：{w.date} · 上次复习：{w.lastReview}</div>
                </div>
              </div>
              <div className="wrong-mastery">
                {Object.keys(MASTERY_LABELS).map((lv) => (
                  <button key={lv} className={'mst mst-' + lv + ((w.mastery || 'unset') === lv ? ' on' : '')} onClick={() => setMastery(w.id, lv)}>{MASTERY_LABELS[lv]}</button>
                ))}
              </div>
              {(w.images && w.images.length > 0) && (
                <div className="wrong-imgs">
                  {w.images.map((img, idx) => (
                    <div key={img.path} className="wrong-img-wrap">
                      <img src={img.url} alt="" onClick={() => setLightbox({ images: w.images, index: idx, title: w.q })} />
                      <button className="wrong-img-del" onClick={() => onDeleteImg(w.id, img)} title="删除">×</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="wrong-card-actions">
                <label className="btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>
                  📷 拍照补充
                  <input type="file" accept="image/*" capture="environment" multiple style={{ display: 'none' }} onChange={(e) => { onUpload(w.id, e.target.files); e.target.value = '' }} />
                </label>
                <button className="btn-ghost btn-sm" onClick={() => setEditing(w)}>✏️ 修改</button>
                <button className="btn-ghost btn-sm" onClick={() => del(w.id)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      ))}

      {editing && <WrongEditModal item={editing} books={s.exams} onAddBook={addBookQuick} onClose={() => setEditing(null)}
        onSave={(item) => { up({ wrongs: s.wrongs.map((i) => i.id === item.id ? item : i) }); toast('已保存'); setEditing(null) }} />}
      {adding && <WrongEditModal item={{ subject: '', q: '', reason: '', mastery: 'unset', lastReview: today(), note: '', bookId: (s.exams[0] && s.exams[0].id) || null, date: today() }} isNew books={s.exams} onAddBook={addBookQuick}
        onClose={() => setAdding(false)}
        onSave={(item) => { up({ wrongs: [...s.wrongs, { ...item, id: uid() }] }); toast('已添加'); setAdding(false) }} />}

      {lightbox && <Lightbox images={lightbox.images} index={lightbox.index} title={lightbox.title} onClose={() => setLightbox(null)}
        onChange={(i) => setLightbox({ ...lightbox, index: i })} />}
    </div>
  )
}

/* 自绘下拉：避开 iOS Safari 受控 <select> 选中首项空值后卡死的 bug */
function BookDropdown({ value, options, onChange, placeholder }) {
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.id === value)
  return (
    <div className="book-dropdown">
      <button type="button" className="book-dropdown-btn" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}>
        <span>{current ? current.name : (placeholder || '不归类')}</span>
        <span className="caret">▾</span>
      </button>
      {open && (
        <>
          <div className="book-dropdown-backdrop" onClick={(e) => { e.stopPropagation(); setOpen(false) }} />
          <div className="book-dropdown-list" onClick={(e) => e.stopPropagation()}>
            <div className={'book-opt' + (!current ? ' active' : '')} onClick={() => { onChange(null); setOpen(false) }}>{placeholder || '不归类'}</div>
            {options.map((o) => (
              <div key={o.id} className={'book-opt' + (current && current.id === o.id ? ' active' : '')} onClick={() => { onChange(o.id); setOpen(false) }}>{o.name}</div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function WrongEditModal({ item, isNew, books, onAddBook, onClose, onSave }) {
  const [bookId, setBookId] = useState(item.bookId || '')
  const [subject, setSubject] = useState(item.subject || '')
  const [q, setQ] = useState(item.q || '')
  const [reason, setReason] = useState(item.reason || '')
  const [note, setNote] = useState(item.note || '')
  const [date, setDate] = useState(item.date || today())
  const [newBookName, setNewBookName] = useState('')
  const submit = () => {
    if (!q.trim()) return
    onSave({ ...item, bookId: bookId || null, subject: subject.trim(), q: q.trim(), reason: reason.trim(), note: note.trim(), date, mastery: item.mastery || 'unset', lastReview: item.lastReview || date })
  }
  const quickAddBook = () => {
    const nm = newBookName.trim()
    if (!nm) return
    const id = onAddBook(nm)
    if (id != null) setBookId(id)
    setNewBookName('')
  }
  return (
    <div className="modal-mask" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{isNew ? '➕ 添加错题' : '✏️ 修改错题'}</h3>
          <button className="btn-ghost btn-sm" onClick={onClose}>关闭</button>
        </div>
        <div className="field">
          <label>所属题本（可选）</label>
          <BookDropdown value={bookId || null} options={books} placeholder="不归类" onChange={(id) => setBookId(id)} />
          <div className="quick-add-book">
            <input value={newBookName} onChange={(e) => setNewBookName(e.target.value)} placeholder="没有合适题本？输入名字快速新建" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); quickAddBook() } }} />
            <button className="btn-ghost btn-sm" onClick={quickAddBook}>＋ 新建</button>
          </div>
          {books.length === 0 && <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>还没有题本，输入名字点「新建」即可，会自动选中。</p>}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="field" style={{ flex: 1 }}><label>科目</label><input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="如：资料分析" /></div>
          <div className="field" style={{ width: 150 }}><label>日期</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div className="field"><label>题目 / 考点</label><input value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
        <div className="field"><label>错因（可选）</label><input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
        <div className="field"><label>备注（可选）</label><textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="复盘心得、解题思路..." /></div>
        <div className="row" style={{ marginTop: 14 }}>
          <button className="btn-primary btn-block" onClick={submit}>保存</button>
        </div>
      </div>
    </div>
  )
}

function Lightbox({ images, index, title, onClose, onChange }) {
  const prev = () => onChange((index - 1 + images.length) % images.length)
  const next = () => onChange((index + 1) % images.length)
  return (
    <div className="lightbox-mask" onClick={onClose}>
      <div className="lightbox-card" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-head">
          <div className="lightbox-title">{title} <span className="muted" style={{ fontSize: 12 }}>（{index + 1}/{images.length}）</span></div>
          <button className="btn-ghost btn-sm" onClick={onClose}>关闭 ✕</button>
        </div>
        <div className="lightbox-body">
          {images.length > 1 && <button className="lightbox-nav prev" onClick={prev}>‹</button>}
          <img src={images[index].url} alt="" />
          {images.length > 1 && <button className="lightbox-nav next" onClick={next}>›</button>}
        </div>
      </div>
    </div>
  )
}

/* ============ 总体分析（趋势 + 进度条形图） ============ */
export function Overall({ s }) {
  const totalQ = s.exams.reduce((a, e) => a + (e.totalQ || 0), 0)
  const doneQ = s.exams.reduce((a, e) => a + (e.completed || 0), 0)
  const wrongQ = s.wrongs.length
  const acc = doneQ ? Math.max(0, Math.round(((doneQ - wrongQ) / doneQ) * 100)) : 0
  const totalL = s.courses.reduce((a, c) => a + (c.totalLessons || 0), 0)
  const doneL = s.courses.reduce((a, c) => a + (c.completedLessons || 0), 0)
  const courseRate = totalL ? Math.round((doneL / totalL) * 100) : 0
  const days = Object.keys(s.studyLog).filter((d) => s.studyLog[d] > 0).length
  const totalSecs = Object.values(s.studyLog).reduce((a, b) => a + b, 0)

  // 近 7 天学习时长（按日，0 补齐）
  const last7 = (() => {
    const arr = []
    const today = new Date()
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const k = d.toISOString().slice(0, 10)
      arr.push({ date: k, label: (d.getMonth() + 1) + '/' + d.getDate(), secs: s.studyLog[k] || 0 })
    }
    return arr
  })()

  // 各题本完成进度
  const bookProgress = s.exams
    .filter((e) => (e.totalQ || 0) > 0)
    .map((e) => ({
      name: e.name || '未命名题本',
      cat: e.cat || '其他',
      pct: Math.min(100, Math.round(((e.completed || 0) / (e.totalQ || 1)) * 100)),
      done: e.completed || 0,
      total: e.totalQ || 0,
    }))
    .sort((a, b) => b.pct - a.pct)

  // 各网课完成进度（按课程聚合）
  const courseProgress = s.courses
    .filter((c) => (c.totalLessons || 0) > 0)
    .map((c) => ({
      id: c.id,
      name: c.name || '未命名课程',
      cat: c.cat || '其他',
      pct: Math.min(100, Math.round(((c.completedLessons || 0) / (c.totalLessons || 1)) * 100)),
      done: c.completedLessons || 0,
      total: c.totalLessons || 0,
    }))
    .sort((a, b) => b.pct - a.pct)

  return (
    <>
      <div className="grid cols-4 stat-row" style={{ marginBottom: 16 }}>
        <div className="stat"><b>{acc}%</b><span>题本正确率</span></div>
        <div className="stat"><b>{courseRate}%</b><span>网课完成率</span></div>
        <div className="stat"><b>{days} 天</b><span>累计学习天数</span></div>
        <div className="stat"><b>{fmtDur(totalSecs)}</b><span>累计学习时长</span></div>
      </div>

      <div className="card">
        <h3>📅 近 7 天学习趋势</h3>
        <BarChartDaily data={last7} />
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          最近 7 天共学习 {fmtDur(last7.reduce((a, d) => a + d.secs, 0))}
          {days > 7 && `；累计 ${days} 天有学习记录`}
        </p>
      </div>

      <div className="card">
        <h3>📚 各题本完成进度</h3>
        {bookProgress.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 24, fontSize: 13 }}>
            还没有题本数据。<br />
            去「题本进度」添加题本和总题数，这里就会按题本显示完成进度条。
          </p>
        ) : (
          <div className="hbar-list">
            {bookProgress.map((b) => (
              <div key={b.name} className="hbar-row">
                <div className="hbar-label">
                  <span className="hbar-name">{b.name}</span>
                  <span className="hbar-pct">{b.pct}%</span>
                </div>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: b.pct + '%' }} />
                </div>
                <div className="hbar-meta">
                  <span className="tag">{b.cat}</span>
                  <span className="muted">{b.done} / {b.total} 题</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>🎬 各网课完成进度</h3>
        {courseProgress.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 24, fontSize: 13 }}>
            还没有网课数据。<br />
            去「网课进度」添加课程并填写总课时，这里就会按课程显示完成进度条。
          </p>
        ) : (
          <div className="hbar-list">
            {courseProgress.map((c) => (
              <div key={c.id} className="hbar-row">
                <div className="hbar-label">
                  <span className="hbar-name">{c.name}</span>
                  <span className="hbar-pct">{c.pct}%</span>
                </div>
                <div className="hbar-track">
                  <div className="hbar-fill" style={{ width: c.pct + '%' }} />
                </div>
                <div className="hbar-meta">
                  <span className="tag">{c.cat}</span>
                  <span className="muted">已学 {c.done} / {c.total} 节</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h3>📈 数据汇总</h3>
        <table className="table">
          <tbody>
            <tr><td>题本总量</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{totalQ} 题</td></tr>
            <tr><td>已完成题量</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{doneQ} 题</td></tr>
            <tr><td>错题数</td><td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--danger)' }}>{wrongQ} 题</td></tr>
            <tr><td>网课总课时</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{totalL} 节</td></tr>
            <tr><td>已学课时</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{doneL} 节</td></tr>
          </tbody>
        </table>
      </div>

          </>
  )
}

/* ============ 周期分析（周报/月报自动生成） ============ */
export function Monthly({ s, up, toast }) {
  const [period, setPeriod] = useState('week')
  const [addingScore, setAddingScore] = useState(false)
  const [scoreDraft, setScoreDraft] = useState({ exam: '', date: today(), score: '', full: 100 })
  const saveScore = () => {
    const sc = Number(scoreDraft.score)
    const fu = Number(scoreDraft.full) || 100
    if (!scoreDraft.exam.trim() || !scoreDraft.date || !(sc >= 0)) { toast('请填写考试名、日期和得分'); return }
    up({ mockScores: [...(s.mockScores || []), { id: uid(), exam: scoreDraft.exam.trim(), date: scoreDraft.date, score: sc, full: fu }] })
    setScoreDraft({ exam: '', date: today(), score: '', full: 100 })
    setAddingScore(false)
    toast('已记录模考成绩')
  }
  const delScore = (id) => up({ mockScores: (s.mockScores || []).filter((x) => x.id !== id) })
  const now = new Date()
  const todayKey = fmtDate(now)
  const ymKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0')
  // 周期起点：周=本周一，月=本月1号
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
  const startKey = period === 'week' ? fmtDate(weekStart) : (ymKey + '-01')
  const periodLabel = period === 'week' ? '本周' : '本月'
  const rangeLabel = period === 'week' ? (startKey + ' ~ ' + todayKey) : (ymKey + '-01 ~ ' + todayKey)

  // 周期内学习日志（studyLog 的 key 是日期字符串，可直接比较）
  const periodEntries = Object.entries(s.studyLog || {}).filter(([d]) => d >= startKey && d <= todayKey)
  const periodSecs = periodEntries.reduce((a, [, v]) => a + (v || 0), 0)
  const periodStudyDays = periodEntries.filter(([, v]) => (v || 0) > 0).length
  const periodDailyAvg = periodStudyDays ? periodSecs / periodStudyDays : 0
  // 周期内各科目时长
  const periodSubjects = {}
  periodEntries.forEach(([d]) => {
    const m = (s.studyLogBySubject || {})[d]
    if (m) Object.entries(m).forEach(([k, val]) => { periodSubjects[k] = (periodSubjects[k] || 0) + (val || 0) })
  })
  const subjList = Object.entries(periodSubjects).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const subjMax = Math.max(1, ...subjList.map(([, v]) => v))
  // 周期内新增错题 + 当前待重做
  const periodWrongs = (s.wrongs || []).filter((w) => w.date >= startKey && w.date <= todayKey)
  const dueCount = (s.wrongs || []).filter((w) => isWrongDue(w, today())).length

  const copyReport = () => {
    const text = [
      '【考公工作台·' + periodLabel + '报告】',
      '周期：' + rangeLabel,
      '学习天数：' + periodStudyDays + ' 天',
      '学习时长：' + fmtDur(periodSecs),
      '日均时长：' + fmtDur(periodDailyAvg),
      '科目分布：' + (subjList.length ? subjList.map(([k, v]) => k + ' ' + fmtDur(v)).join('，') : '无'),
      '新增错题：' + periodWrongs.length + ' 道',
      '待重做：' + dueCount + ' 道',
    ].join('\n')
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => alert('已复制' + periodLabel + '报告，可粘贴到微信/备忘录分享')).catch(() => alert(text))
    } else { alert(text) }
  }

  // 累计指标（总体，与周期无关）
  const totalDoneQ = s.exams.reduce((a, e) => a + (e.completed || 0), 0)
  const totalWrongQ = s.wrongs.length
  const totalAcc = totalDoneQ ? Math.max(0, Math.round(((totalDoneQ - totalWrongQ) / totalDoneQ) * 100)) : 0
  const monthSecs = Object.entries(s.studyLog || {}).filter(([d]) => d.startsWith(ymKey)).reduce((a, [, v]) => a + v, 0)

  // 各模块统计
  const catStats = {}
  s.exams.forEach((e) => {
    const c = e.cat || '其他'
    if (!catStats[c]) catStats[c] = { total: 0, completed: 0, wrong: 0 }
    catStats[c].total += (e.totalQ || 0)
    catStats[c].completed += (e.completed || 0)
  })
  s.wrongs.forEach((w) => {
    const b = s.exams.find((e) => e.id === w.bookId)
    const c = b ? (b.cat || '其他') : (w.subject || '其他')
    if (catStats[c]) catStats[c].wrong += 1
  })
  const catList = Object.entries(catStats).map(([k, v]) => ({
    name: k,
    rate: v.completed ? Math.max(0, Math.round(((v.completed - v.wrong) / v.completed) * 100)) : 0,
    count: v.completed,
  }))
  const maxCount = Math.max(1, ...catList.map((c) => c.count))

  // 各网课完成进度
  const courseProgress = s.courses
    .filter((c) => (c.totalLessons || 0) > 0)
    .map((c) => ({
      name: c.name || '未命名课程',
      rate: Math.min(100, Math.round(((c.completedLessons || 0) / (c.totalLessons || 1)) * 100)),
      done: c.completedLessons || 0,
      total: c.totalLessons || 0,
      cat: c.cat || '其他',
    }))
    .sort((a, b) => b.rate - a.rate)

  return (
    <>
      {/* 周报/月报 切换 + 自动生成报告 */}
      <div className="card">
        <div className="card-head-row">
          <h3>📊 {periodLabel}学习报告</h3>
          <div className="mode-switch">
            <button className={'mode-btn' + (period === 'week' ? ' on' : '')} onClick={() => setPeriod('week')}>本周</button>
            <button className={'mode-btn' + (period === 'month' ? ' on' : '')} onClick={() => setPeriod('month')}>本月</button>
          </div>
        </div>
        <p className="muted" style={{ fontSize: 12, margin: '0 0 10px' }}>{rangeLabel}</p>
        <div className="grid cols-3 stat-row" style={{ marginBottom: 12 }}>
          <div className="stat"><b>{fmtDur(periodSecs)}</b><span>{periodLabel}学习时长</span></div>
          <div className="stat"><b>{periodStudyDays}</b><span>学习天数</span></div>
          <div className="stat"><b>{fmtDur(periodDailyAvg)}</b><span>日均时长</span></div>
        </div>
        {subjList.length > 0 && (
          <div className="report-subj">
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>科目时长分布</div>
            {subjList.map(([k, v]) => (
              <div key={k} className="sub-dist-row">
                <span className="sub-dist-name">{k}</span>
                <div className="sub-dist-bar"><i style={{ width: Math.max(4, Math.round((v / subjMax) * 100)) + '%' }} /></div>
                <span className="sub-dist-val">{fmtDur(v)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="report-summary">
          本{period === 'week' ? '周' : '月'}学习 <b>{periodStudyDays}</b> 天、累计 <b>{fmtDur(periodSecs)}</b>，日均 <b>{fmtDur(periodDailyAvg)}</b>；新增错题 <b>{periodWrongs.length}</b> 道，当前 <b>{dueCount}</b> 道待重做。
        </div>
        <button className="btn-primary btn-block" style={{ marginTop: 12 }} onClick={copyReport}>📋 复制{periodLabel}报告（可分享）</button>
      </div>

      <div className="card">
        <h3>📅 累计数据 <span className="tag">总体</span></h3>
        <div className="grid cols-4 stat-row">
          <div className="stat"><b>{fmtDur(monthSecs)}</b><span>本月学习时长</span></div>
          <div className="stat"><b>{totalDoneQ}</b><span>已刷题量</span></div>
          <div className="stat"><b>{totalWrongQ}</b><span>错题总数</span></div>
          <div className="stat"><b>{totalAcc}%</b><span>整体正确率</span></div>
        </div>
      </div>
      <div className="card">
        <h3>📊 各模块正确率</h3>
        <BarChart data={catList} max={100} suffix="%" />
      </div>
      <div className="card">
        <h3>📈 各模块刷题数</h3>
        <BarChart data={catList} max={maxCount} suffix=" 题" />
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>{catList.map((c) => c.name + ' ' + c.count + '题').join('，') || '暂无数据'}</p>
      </div>
      <div className="card">
        <h3>🎬 各网课完成进度</h3>
        {courseProgress.length === 0 ? (
          <p className="muted" style={{ textAlign: 'center', padding: 24, fontSize: 13 }}>
            还没有网课数据。<br />
            去「网课进度」添加课程并填写总课时，这里就会按课程显示完成进度条。
          </p>
        ) : (
          <>
            <BarChart data={courseProgress} max={100} suffix="%" rowClass="bar-row-wide" />
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              {courseProgress.map((c) => c.name + ' ' + c.done + '/' + c.total + '节').join('，')}
            </p>
          </>
        )}
      </div>

      {/* 模考成绩趋势 */}
      <div className="card">
        <div className="card-head-row">
          <div>
            <h3>📈 模考成绩趋势 <span className="tag">{(s.mockScores || []).length} 条</span></h3>
            <p className="muted" style={{ fontSize: 12.5, margin: '4px 0 0' }}>记录每次模考分数，看清自己的提分曲线（按得分率画趋势线）。</p>
          </div>
          <button className="btn-primary btn-sm" onClick={() => setAddingScore((v) => !v)}>{addingScore ? '收起' : '➕ 添加成绩'}</button>
        </div>
        {addingScore && (
          <div className="score-add">
            <input list="score-exam-list" placeholder="考试/科目（如国考行测）" value={scoreDraft.exam} onChange={(e) => setScoreDraft((d) => ({ ...d, exam: e.target.value }))} style={{ flex: 1, minWidth: 120 }} />
            <datalist id="score-exam-list">{(s.countdowns || []).map((c) => <option key={c.id} value={c.name} />)}</datalist>
            <input type="date" value={scoreDraft.date} onChange={(e) => setScoreDraft((d) => ({ ...d, date: e.target.value }))} />
            <input type="number" placeholder="得分" value={scoreDraft.score} onChange={(e) => setScoreDraft((d) => ({ ...d, score: e.target.value }))} style={{ width: 76 }} />
            <input type="number" placeholder="满分" value={scoreDraft.full} onChange={(e) => setScoreDraft((d) => ({ ...d, full: e.target.value }))} style={{ width: 66 }} />
            <button className="btn-primary btn-sm" onClick={saveScore}>保存</button>
          </div>
        )}
        {(s.mockScores || []).length === 0 ? (
          <p className="muted" style={{ fontSize: 13, textAlign: 'center', padding: 24 }}>还没有模考成绩记录，点右上「添加成绩」开始记录。</p>
        ) : (
          <>
            <ScoreTrend scores={s.mockScores} />
            <div className="score-legend">
              {Array.from(new Set(s.mockScores.map((x) => x.exam))).map((ex, i) => (
                <span key={ex} className="score-legend-item"><i style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }} />{ex}</span>
              ))}
            </div>
            <div className="score-summary">
              {Array.from(new Set(s.mockScores.map((x) => x.exam))).map((ex) => {
                const arr = s.mockScores.filter((x) => x.exam === ex).sort((a, b) => a.date.localeCompare(b.date))
                const first = arr[0], last = arr[arr.length - 1]
                const diff = (last.score / last.full * 100) - (first.score / first.full * 100)
                return (
                  <div key={ex} className="score-stat">
                    <b>{ex}</b>
                    <span>最新 {last.score}/{last.full}</span>
                    <span className={diff >= 0 ? 'up' : 'down'}>{diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toFixed(1)} 分</span>
                    <button className="btn-ghost btn-sm score-del" onClick={() => { if (confirm('删除「' + ex + '」这条成绩记录？')) delScore(last.id) }}>删</button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </>
  )
}

/* ============ 图表组件（纯 SVG） ============ */
const CHART_PALETTE = ['#d59a9a', '#a8c79a', '#9eb4c6', '#c4a8c6', '#d6b67a', '#9ab9b9', '#b6b6b6', '#caa78e']

function DonutChart({ data, centerText, legend = true }) {
  const total = data.reduce((a, [, v]) => a + v, 0)
  const R = 70, r = 44, cx = 90, cy = 90
  let acc = 0
  const arcs = data.map(([name, value], i) => {
    const start = (acc / total) * Math.PI * 2
    acc += value
    const end = (acc / total) * Math.PI * 2
    const x1 = cx + R * Math.sin(start), y1 = cy - R * Math.cos(start)
    const x2 = cx + R * Math.sin(end), y2 = cy - R * Math.cos(end)
    const x3 = cx + r * Math.sin(end), y3 = cy - r * Math.cos(end)
    const x4 = cx + r * Math.sin(start), y4 = cy - r * Math.cos(start)
    const large = (end - start) > Math.PI ? 1 : 0
    const d = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r} ${r} 0 ${large} 0 ${x4} ${y4} Z`
    return { name, value, d, color: CHART_PALETTE[i % CHART_PALETTE.length] }
  })
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 180 180" width="180" height="180" style={{ flexShrink: 0 }}>
        {arcs.map((a, i) => <path key={i} d={a.d} fill={a.color} stroke="#fff" strokeWidth="1.5" />)}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="11" fill="#6b6055">累计</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="13" fontWeight="700" fill="#3a3530">{centerText || ''}</text>
      </svg>
      {legend && (
        <ul className="donut-legend">
          {arcs.map((a, i) => (
            <li key={i}>
              <span className="dot" style={{ background: a.color }} />
              <span className="ln">{a.name}</span>
              <span className="muted">{a.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function BarChart({ data, max, suffix = '', rowClass = '' }) {
  if (!data || data.length === 0) return <p className="muted" style={{ fontSize: 13 }}>暂无数据</p>
  return (
    <div className="bar-chart">
      {data.map((d, i) => {
        const pct = max ? (d.rate / max) * 100 : 0
        return (
          <div key={d.name + i} className={'bar-row' + (rowClass ? ' ' + rowClass : '')}>
            <div className="bar-label" title={d.name}>{d.name}</div>
            <div className="bar-track"><i style={{ width: pct + '%', background: CHART_PALETTE[i % CHART_PALETTE.length] }} /></div>
            <div className="bar-val">{d.rate}{suffix}</div>
          </div>
        )
      })}
    </div>
  )
}

/* 近 7 天学习时长：竖向柱状图（纯 SVG） */
function BarChartDaily({ data }) {
  if (!data || data.length === 0) return <p className="muted" style={{ fontSize: 13 }}>暂无数据</p>
  const totalSecs = data.reduce((a, d) => a + d.secs, 0)
  const maxSec = Math.max(1, ...data.map((d) => d.secs))
  const W = 360, H = 160
  const padL = 30, padR = 8, padT = 14, padB = 28
  const chartW = W - padL - padR, chartH = H - padT - padB
  const barW = chartW / data.length
  const todayKey = new Date().toISOString().slice(0, 10)
  // y 轴刻度（3 条：0/中/最大）
  const ticks = [0, maxSec / 2, maxSec]
  return (
    <div className="daily-chart-wrap">
      {totalSecs === 0 ? (
        <div className="daily-chart-empty">
          <div style={{ fontSize: 36, opacity: 0.4 }}>📅</div>
          <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
            近 7 天还没有学习记录<br />
            去「今日计划」开始计时，就会在这里看到每日学习时长。
          </p>
        </div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="170" preserveAspectRatio="xMidYMid meet">
          {ticks.map((t, i) => {
            const y = padT + chartH - (t / maxSec) * chartH
            return (
              <g key={i}>
                <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#e8ede8" strokeDasharray={i === 0 ? '' : '3 3'} />
                <text x={padL - 4} y={y + 3} textAnchor="end" fontSize="9" fill="#9aa">{fmtDurShort(t)}</text>
              </g>
            )
          })}
          {data.map((d, i) => {
            const x = padL + i * barW + barW * 0.18
            const w = barW * 0.64
            const h = (d.secs / maxSec) * chartH
            const y = padT + chartH - h
            const isToday = d.date === todayKey
            return (
              <g key={d.date}>
                  <rect x={x} y={y} width={w} height={h} rx="4"
                    fill={isToday ? '#6fa882' : '#a8c79a'} />
                  {d.secs > 0 && (
                    <text x={x + w / 2} y={y - 3} textAnchor="middle" fontSize="9" fill="#3a3530" fontWeight="600">
                      {fmtDurShort(d.secs)}
                    </text>
                  )}
                  <text x={x + w / 2} y={padT + chartH + 14} textAnchor="middle"
                    fontSize="10" fill={isToday ? '#1f7a44' : '#7a8a7a'} fontWeight={isToday ? '700' : '400'}>
                    {d.label}
                  </text>
                </g>
            )
          })}
        </svg>
      )}
    </div>
  )
}

/* 模考成绩趋势线（纯 SVG）：多条折线，按得分率(0~100%)绘制，X 轴为考试日期 */
function ScoreTrend({ scores }) {
  if (!scores || scores.length === 0) return null
  const exams = Array.from(new Set(scores.map((s) => s.exam))).filter(Boolean)
  const series = exams.map((ex) => ({
    name: ex,
    pts: scores.filter((s) => s.exam === ex).sort((a, b) => a.date.localeCompare(b.date))
      .map((s) => ({ date: s.date, pct: s.full ? (s.score / s.full) * 100 : s.score, score: s.score, full: s.full })),
  }))
  const allDates = Array.from(new Set(scores.map((s) => s.date))).sort()
  const n = allDates.length
  const W = 640, H = 240, padL = 38, padR = 14, padT = 18, padB = 34
  const chartW = W - padL - padR, chartH = H - padT - padB
  const xFor = (date) => n <= 1 ? padL + chartW / 2 : padL + (allDates.indexOf(date) / (n - 1)) * chartW
  const yFor = (pct) => padT + chartH - (Math.max(0, Math.min(100, pct)) / 100) * chartH
  const yTicks = [0, 50, 100]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="240" preserveAspectRatio="xMidYMid meet" className="score-trend">
      {yTicks.map((t) => {
        const y = yFor(t)
        return (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#e8ede8" strokeDasharray={t === 0 ? '' : '3 3'} />
            <text x={padL - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#9aa">{t}%</text>
          </g>
        )
      })}
      {series.map((ser, si) => {
        const color = CHART_PALETTE[si % CHART_PALETTE.length]
        const path = ser.pts.map((p, i) => (i === 0 ? 'M ' : 'L ') + xFor(p.date).toFixed(1) + ' ' + yFor(p.pct).toFixed(1)).join(' ')
        return (
          <g key={ser.name}>
            <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {ser.pts.map((p, i) => (
              <g key={i}>
                <circle cx={xFor(p.date)} cy={yFor(p.pct)} r="4" fill="#fff" stroke={color} strokeWidth="2" />
                <text x={xFor(p.date)} y={yFor(p.pct) - 8} textAnchor="middle" fontSize="9" fill="#5a534c" fontWeight="600">{p.score}</text>
              </g>
            ))}
          </g>
        )
      })}
      {allDates.map((d, i) => {
        if (n > 6 && i % Math.ceil(n / 6) !== 0 && i !== n - 1) return null
        return <text key={d} x={xFor(d)} y={H - 12} textAnchor="middle" fontSize="9" fill="#9aa">{d.slice(5)}</text>
      })}
    </svg>
  )
}

/* 短格式：≥1h 用 "XhYm"，≥1m 用 "Ym"，否则 "Xs" */
function fmtDurShort(secs) {
  if (!secs) return '0'
  if (secs >= 3600) {
    const h = Math.floor(secs / 3600)
    const m = Math.round((secs - h * 3600) / 60)
    return m ? h + 'h' + m + 'm' : h + 'h'
  }
  if (secs >= 60) return Math.round(secs / 60) + 'm'
  return secs + 's'
}

