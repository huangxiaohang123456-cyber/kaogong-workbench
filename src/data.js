// 业务数据初始结构 + 工具函数（从原单文件版本移植）
export const KEY = 'kg_state_v2'

export function today() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

export function defaultState() {
  return {
    profile: { name: '', target: '公务员', startedAt: today() },
    today: [
      { id: 1, text: '做 30 道行测真题', done: false },
      { id: 2, text: '申论范文抄写 1 篇', done: false },
      { id: 3, text: '复盘昨日错题', done: false }
    ],
    library: [
      { id: 1, text: '整理资料分析速算公式', cat: '方法', pri: '高' },
      { id: 2, text: '背诵常识高频考点', cat: '记忆', pri: '中' }
    ],
    exams: [
      { id: 1, name: '行测·言语理解', totalQ: 40, completed: 40, wrong: 6 },
      { id: 2, name: '行测·资料分析', totalQ: 20, completed: 12, wrong: 2 },
      { id: 3, name: '申论', totalQ: 5, completed: 1, wrong: 1 }
    ],
    courses: [
      { id: 1, name: '系统班·判断推理', totalLessons: 60, completedLessons: 22 },
      { id: 2, name: '冲刺班·模考讲解', totalLessons: 12, completedLessons: 4 }
    ],
    wrongs: [
      { id: 1, subject: '资料分析', q: '增长率比较题', reason: '没注意基期量', master: false },
      { id: 2, subject: '逻辑判断', q: '加强削弱题', reason: '混淆论点和论据', master: false }
    ],
    studyLog: {},
    timers: {}
  }
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return Object.assign(defaultState(), JSON.parse(raw))
  } catch (e) {}
  return defaultState()
}

export function saveLocal(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch (e) {}
}
