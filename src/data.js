// 业务数据初始结构 + 工具函数（精简版：仅保留计时器+打卡所需字段）
export const KEY = 'kg_state_v2'
export const MAX_NAME = 20          // 工作台名称最大字数

export function today() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

// 简单 ID 生成
export function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
}

// 清洗脏日期：清掉所有不可见字符 / 字母 / 空格，
// 只保留数字和日期分隔符（- / .），并把 YYYYMMDD / YYYY/MM/DD 统一成 YYYY-MM-DD
export function cleanDate(s) {
  if (s == null) return ''
  if (typeof s === 'number' && s > 0 && !isNaN(s)) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) {
      return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0')
    }
    return ''
  }
  if (typeof s !== 'string') return ''
  let x = s.replace(/[^/.\d-]/g, '')
  if (!x) return ''
  if (/^\d{8}$/.test(x)) x = x.slice(0, 4) + '-' + x.slice(4, 6) + '-' + x.slice(6, 8)
  return x.replace(/[/\.]/g, '-')
}

// 倒计时天数（保留：便于旧云端数据中的倒计时字段被导入后仍能算）
export function daysTo(date) {
  const cleaned = cleanDate(date)
  if (!cleaned) return null
  const m = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const [, ys, ms, ds] = m
  const y = Number(ys), mo = Number(ms), d = Number(ds)
  if (!y || !mo || !d || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const target = Date.UTC(y, mo - 1, d, 12)
  const now = new Date()
  const todayMid = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12)
  if (isNaN(target) || isNaN(todayMid)) return null
  return Math.round((target - todayMid) / 86400000)
}

// 精简后的初始状态：只保留计时器+打卡的必要字段
export function defaultState() {
  return {
    profile: { name: '', target: '公务员', startedAt: today() },
    workspaceName: '备考工作台',
    today: [
      { id: 1, text: '做 30 道行测真题', done: false },
      { id: 2, text: '申论范文抄写 1 篇', done: false },
      { id: 3, text: '复盘昨日错题', done: false }
    ],
    studyLog: {},
    studyLogSec: true,
    // 按「日期 → 科目 → 秒数」记录，用于今日已学清单
    studyLogBySubject: {},
    // 最长连续打卡天数（每次算出新 streak 时取 max 写回）
    bestStreak: 0,
    // 上次计时选择的科目（下次打开默认沿用）
    timerSubject: '其他',
    // 用户自定义的计时科目（下拉「📝 自定义」时写入，下回自动出现在列表里）
    customSubjects: []
  }
}

// 计时科目（基础列表；aggregateSubjects 会再合并你自定义的科目）
export const STUDY_SUBJECTS = ['言语', '判断', '资料', '数量', '常识', '申论', '公基', '其他']

// 聚合所有「可能用于计时归属」的科目标签（去重），作为计时器下拉的来源。
// 精简版：只用基础列表 + 你自定义的科目（其他模块已下线，无需再聚合它们）。
export function aggregateSubjects(s) {
  const set = new Set(STUDY_SUBJECTS)
  ;(s.customSubjects || []).forEach((x) => { if (x && String(x).trim()) set.add(String(x).trim()) })
  return [...set]
}

// 把秒数格式化成「X 小时 Y 分 / Y 分 Z 秒 / Z 秒」
export function fmtDur(sec) {
  sec = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m >= 60) return Math.floor(m / 60) + ' 小时 ' + (m % 60) + ' 分'
  if (m > 0) return m + ' 分 ' + s + ' 秒'
  return s + ' 秒'
}

// 旧数据 studyLog 存的是「分钟」，转换为「秒」一次（幂等）
export function migrateStudyLog(state) {
  if (state.studyLogSec) return state
  const log = {}
  Object.keys(state.studyLog || {}).forEach((k) => { log[k] = (state.studyLog[k] || 0) * 60 })
  return { ...state, studyLog: log, studyLogSec: true }
}

// 取本机存的 state；拿不到或解析失败就返回默认。
// 保留宽容：旧用户云端可能还有 library/exams/courses/wrongs 等历史字段，导入时一并保留（不渲染而已），保证 JSON 备份往返完整。
export function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const migrated = migrateStudyLog(parsed)
      // 写回迁移后的版本（如果需要）
      const final = migrated
      if (final !== parsed) {
        try { localStorage.setItem(KEY, JSON.stringify(final)) } catch (e) {}
      }
      // Object.assign 让 defaultState 提供所有新字段，旧字段（如 library）保留在 final 里不会丢
      return Object.assign(defaultState(), final)
    }
  } catch (e) {}
  return defaultState()
}

export function saveLocal(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch (e) {}
}
