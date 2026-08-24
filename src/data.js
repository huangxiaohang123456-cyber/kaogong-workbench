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
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0')
}

// 简单 ID 生成（与 views.jsx 的 uid 保持一致风格）
export function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)
}

// 倒计时天数（examDate 当天为 0；< today 为已过）
export function daysTo(date) {
  if (!date) return null
  const t = new Date(today() + 'T00:00:00')
  const d = new Date(date + 'T00:00:00')
  return Math.round((d - t) / 86400000)
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
      { id: 1, name: '行测·言语理解', cat: '言语', totalQ: 40, completed: 40, wrong: 6 },
      { id: 2, name: '行测·资料分析', cat: '资料', totalQ: 20, completed: 12, wrong: 2 },
      { id: 3, name: '申论', cat: '申论', totalQ: 5, completed: 1, wrong: 1 }
    ],
    courses: [
      { id: 1, name: '系统班·判断推理', cat: '判断', totalLessons: 60, completedLessons: 22, url: '' },
      { id: 2, name: '冲刺班·模考讲解', cat: '冲刺', totalLessons: 12, completedLessons: 4, url: '' }
    ],
    wrongs: [
      { id: 1, bookId: 2, subject: '资料分析', q: '增长率比较题', reason: '没注意基期量', master: false, note: '', images: [], date: '2026-08-15' },
      { id: 2, bookId: 1, subject: '逻辑判断', q: '加强削弱题', reason: '混淆论点和论据', master: false, note: '', images: [], date: '2026-08-16' }
    ],
    // 资料库文件元数据（原件存 Supabase Storage materials 桶，元数据随账号云端同步）
    materials: [],
    // 倒计时考试（Dashboard 顶部卡片）
    countdowns: [],
    studyLog: {},
    studyLogSec: true,
    timers: {}
  }
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

// 数据结构升级：补齐所有新字段，向后兼容
export function migrateShape(state) {
  const lib = (state.library || []).map((i) => ({
    name: i.name || i.text || '未命名事项',
    cat: i.cat || '其他',
    pri: i.pri || '中',
    defaultMinutes: Number(i.defaultMinutes) > 0 ? Number(i.defaultMinutes) : 30,
    id: i.id,
  }))
  const exms = (state.exams || []).map((e) => ({ cat: e.cat || '其他', ...e }))
  const crs = (state.courses || []).map((c) => ({ cat: c.cat || '其他', url: c.url || '', ...c }))
  const w = (state.wrongs || []).map((x) => ({
    bookId: x.bookId || null,
    note: x.note || '',
    images: Array.isArray(x.images) ? x.images : [],
    date: x.date || today(),
    master: !!x.master,
    ...x,
  }))
  return { ...state, library: lib, exams: exms, courses: crs, wrongs: w, materials: state.materials || [], countdowns: state.countdowns || [] }
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
