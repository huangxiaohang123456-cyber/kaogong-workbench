// 业务数据初始结构 + 工具函数
export const KEY = 'kg_state_v2'
export const MAX_NAME = 20          // 工作台名称最大字数

// 错题图片相关
export const IMG_BUCKET = 'wrong-images'
export const MAX_IMAGES_PER_WRONG = 5
export const IMG_MAX_SIZE = 800
export const IMG_QUALITY = 0.7

export function today() {
  const d = new Date()
  // 修复：月份与日之间必须有 '-' 分隔符（之前漏写导致今天=2026-0825，所有倒计时都失效）
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

// 简单 ID 生成（与 views.jsx 的 uid 保持一致风格）
export function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
}

// 倒计时天数：返回 examDate 距离今天的天数（examDate 当天为 0；< today 为负数；非法输入返回 null）
// 完全不依赖 today() 解析（之前 today 函数本身有 bug 把今天=2026-0825，导致全部 NaN）
export function daysTo(date) {
  const cleaned = cleanDate(date)
  if (!cleaned) return null
  // 解析 examDate 的 YYYY-MM-DD（兼容 / / . 分隔符）
  const m = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const [, ys, ms, ds] = m
  const y = Number(ys), mo = Number(ms), d = Number(ds)
  if (!y || !mo || !d || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  // 直接构造 UTC 中午的时刻（避开时区带来的 ±1 天误差）
  const target = Date.UTC(y, mo - 1, d, 12)
  // 今天的 0 点（按本地时区）
  const now = new Date()
  const todayMid = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12)
  if (isNaN(target) || isNaN(todayMid)) return null
  return Math.round((target - todayMid) / 86400000)
}

// 清洗脏日期：清掉所有不可见字符 / Unicode 控制符 / 字母 / 空格，
// 只保留数字和日期分隔符（- / .），并把 YYYYMMDD / YYYY/MM/DD / YYYY.MM.DD 统一成 YYYY-MM-DD。
// 覆盖零宽 / BOM / 软连字 / 双向控制符 / word joiner / 中文空格等
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
  // 只保留数字、/、-、.
  let x = s.replace(/[^/.\d-]/g, '')
  if (!x) return ''
  // YYYYMMDD → YYYY-MM-DD
  if (/^\d{8}$/.test(x)) x = x.slice(0, 4) + '-' + x.slice(4, 6) + '-' + x.slice(6, 8)
  // YYYY/MM/DD / YYYY.MM.DD → YYYY-MM-DD
  return x.replace(/[/\.]/g, '-')
}

export function defaultState() {
  return {
    profile: { name: '', target: '公务员', startedAt: today() },
    workspaceName: '备考工作台',
    today: [
      { id: 1, text: '做 30 道行测真题', done: false },
      { id: 2, text: '申论范文抄写 1 篇', done: false },
      { id: 3, text: '复盘昨日错题', done: false }
    ],
    library: [
      { id: 1, name: '整理资料分析速算公式', cat: '方法', pri: '高', defaultMinutes: 30 },
      { id: 2, name: '背诵常识高频考点', cat: '记忆', pri: '中', defaultMinutes: 20 }
    ],
    // exams 字段名沿用：存储"题本"数据（与 Books 视图对应）
    exams: [
      { id: 1, name: '行测·言语理解', cat: '言语', totalQ: 40, completed: 40, wrong: 6, dailyTarget: 0 },
      { id: 2, name: '行测·资料分析', cat: '资料', totalQ: 20, completed: 12, wrong: 2, dailyTarget: 0 },
      { id: 3, name: '申论', cat: '申论', totalQ: 5, completed: 1, wrong: 1, dailyTarget: 0 }
    ],
    courses: [
      { id: 1, name: '系统班·判断推理', cat: '判断', totalLessons: 60, completedLessons: 22, url: '', dailyTarget: 0 },
      { id: 2, name: '冲刺班·模考讲解', cat: '冲刺', totalLessons: 12, completedLessons: 4, url: '', dailyTarget: 0 }
    ],
    wrongs: [
      { id: 1, bookId: 2, subject: '资料分析', q: '增长率比较题', reason: '没注意基期量', mastery: 'unset', lastReview: '2026-08-15', note: '', images: [], date: '2026-08-15' },
      { id: 2, bookId: 1, subject: '逻辑判断', q: '加强削弱题', reason: '混淆论点和论据', mastery: 'unset', lastReview: '2026-08-16', note: '', images: [], date: '2026-08-16' }
    ],
    // 资料库文件元数据（原件存 Supabase Storage materials 桶，元数据随账号云端同步）
    materials: [],
    // 倒计时考试（Dashboard 顶部卡片）
    countdowns: [],
    studyLog: {},
    studyLogSec: true,
    timers: {},
    // 按「日期 → 科目 → 秒数」记录，用于今日科目分布图
    studyLogBySubject: {},
    // 最长连续打卡天数（每次算出新 streak 时取 max 写回）
    bestStreak: 0,
    // 上次计时选择的科目（下次打开默认沿用）
    timerSubject: '其他',
    // 循环事项模板：每天/工作日自动出现在今日日程（避免天天手动加）
    templates: []
  }
}

// 计时科目（与题本/网课分类保持一致，方便对照）
export const STUDY_SUBJECTS = ['言语', '判断', '资料', '数量', '常识', '申论', '公基', '其他']

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

// 数据结构升级：补齐所有新字段，向后兼容
export function migrateShape(state) {
  const lib = (state.library || []).map((i) => ({
    name: i.name || i.text || '未命名事项',
    cat: i.cat || '其他',
    pri: i.pri || '中',
    defaultMinutes: Number(i.defaultMinutes) > 0 ? Number(i.defaultMinutes) : 30,
    id: i.id,
  }))
  const exms = (state.exams || []).map((e) => ({ cat: e.cat || '其他', dailyTarget: Number(e.dailyTarget) > 0 ? Number(e.dailyTarget) : 0, ...e }))
  const crs = (state.courses || []).map((c) => ({ cat: c.cat || '其他', url: c.url || '', dailyTarget: Number(c.dailyTarget) > 0 ? Number(c.dailyTarget) : 0, ...c }))
  const w = (state.wrongs || []).map((x) => {
    // 老数据用 master 布尔，新数据用 mastery 三态；兼容转换
    const mastery = x.mastery || (x.master ? 'mastered' : 'unset')
    return {
      bookId: x.bookId || null,
      note: x.note || '',
      images: Array.isArray(x.images) ? x.images : [],
      date: x.date || today(),
      mastery,
      lastReview: x.lastReview || x.date || today(),
      ...x,
    }
  })
  return {
    ...state,
    library: lib,
    exams: exms,
    courses: crs,
    wrongs: w,
    materials: state.materials || [],
    countdowns: state.countdowns || [],
    // 新增字段向后兼容：老数据没有这些键时补空值，不会渲染崩
    studyLogBySubject: state.studyLogBySubject || {},
    bestStreak: Number(state.bestStreak) > 0 ? Number(state.bestStreak) : 0,
    timerSubject: state.timerSubject || '其他',
    templates: Array.isArray(state.templates) ? state.templates : [],
  }
}

// 资料库「用途」预设（第一级标签，最醒目）。颜色与卡片色标一致。
export const MAT_PURPOSES = [
  { key: '题本资料', color: '#185FA5' },
  { key: '计划表', color: '#3B6D11' },
  { key: '网课本', color: '#854F0B' },
  { key: '题目电子版', color: '#534AB7' },
  { key: '笔记', color: '#993556' },
  { key: '讲义', color: '#0F6E56' },
  { key: '其他', color: '#5F5E5A' },
]
// 考试 / 科目 预设（二级、三级标签，可选）
export const MAT_EXAMS = ['国考', '省考', '事业单位', '教资', '其他']
export const MAT_SUBJECTS = ['言语', '判断', '资料', '数量', '常识', '申论', '公基', '其他']

// 取用途对应的色值（未知用途回退灰色）
export function matPurposeColor(key) {
  const f = MAT_PURPOSES.find((p) => p.key === key)
  return f ? f.color : '#5F5E5A'
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      const migrated = migrateStudyLog(parsed)
      const final = migrateShape(migrated)
      if (final !== parsed) {
        try { localStorage.setItem(KEY, JSON.stringify(final)) } catch (e) {}
      }
      return Object.assign(defaultState(), final)
    }
  } catch (e) {}
  return defaultState()
}

export function saveLocal(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch (e) {}
}

// 分类预设
export const LIB_CATS = ['方法', '记忆', '刷题', '其他']
export const BOOK_CATS = ['言语', '判断', '资料', '数量', '常识', '申论', '其他']
export const COURSE_CATS = ['言语', '判断', '资料', '数量', '常识', '申论', '冲刺', '其他']
export const PRI_OPTIONS = ['高', '中', '低']

// 错题掌握度三态 + 艾宾浩斯重做间隔（天）
export const MASTERY_LABELS = { unset: '未掌握', fuzzy: '模糊', mastered: '已掌握' }
export const MASTERY_INTERVALS = { unset: 1, fuzzy: 3, mastered: 15 }

// 返回 b 距离 a 的天数（b 在 a 之后为正；解析失败返回 null）
export function daysBetween(a, b) {
  const ca = cleanDate(a), cb = cleanDate(b)
  if (!ca || !cb) return null
  const ma = ca.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const mb = cb.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!ma || !mb) return null
  const ta = Date.UTC(+ma[1], +ma[2] - 1, +ma[3], 12)
  const tb = Date.UTC(+mb[1], +mb[2] - 1, +mb[3], 12)
  if (isNaN(ta) || isNaN(tb)) return null
  return Math.round((tb - ta) / 86400000)
}

// 该题是否到了该重做的日子（按 lastReview + 掌握度间隔判断）
export function isWrongDue(w, t) {
  const m = w.mastery || 'unset'
  const interval = MASTERY_INTERVALS[m]
  const since = daysBetween(w.lastReview || w.date, t)
  if (since == null) return false
  return since >= interval
}
