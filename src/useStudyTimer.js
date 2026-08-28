import { useEffect, useState } from 'react'

// 番茄钟时长（秒）：25 分钟专注 + 5 分钟休息
export const POMO_FOCUS = 25 * 60
export const POMO_BREAK = 5 * 60

// 模块级单例：跨组件卸载而存活，保证切换功能模块时计时器不重置、不停止
const state = {
  running: false,
  secs: 0,        // 本次会话累计总秒数（含已结算部分）
  committed: 0,   // 已经记账进 studyLog 的秒数（防止重复计入）
  id: null,
  // 计时模式：'stopwatch'=正计时（原有行为），'pomodoro'=番茄钟
  mode: 'stopwatch',
  phase: 'focus', // 番茄钟当前阶段：'focus'=专注 / 'break'=休息
  remain: POMO_FOCUS, // 番茄钟当前阶段剩余秒数
  // 阶段切换事件（供 UI 弹提示），形如 { type: 'break'|'focus', at: 时间戳 }
  phaseEvent: null,
}
const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())

const firePhase = (type) => {
  state.phaseEvent = { type, at: Date.now() }
}

const tick = () => {
  // 番茄钟休息阶段：只倒计时，不计入学习时长
  if (state.mode === 'pomodoro' && state.phase === 'break') {
    state.remain -= 1
    if (state.remain <= 0) {
      state.phase = 'focus'
      state.remain = POMO_FOCUS
      firePhase('focus') // 休息结束 → 回来学习
    }
    emit()
    return
  }

  state.secs += 1

  // 番茄钟专注阶段：倒计时到 0 自动进入休息
  if (state.mode === 'pomodoro') {
    state.remain -= 1
    if (state.remain <= 0) {
      state.phase = 'break'
      state.remain = POMO_BREAK
      firePhase('break') // 专注结束 → 去休息
    }
  }
  emit()
}

export function startTimer() {
  if (state.running) return
  state.running = true
  state.id = setInterval(tick, 1000)
  emit()
}

export function pauseTimer() {
  if (!state.running) return
  state.running = false
  clearInterval(state.id)
  state.id = null
  emit()
}

// 尚未结算（记到 studyLog）的秒数
export function pendingSecs() {
  return Math.max(0, state.secs - state.committed)
}

// 把未结算部分结算出来（调用方负责写入 studyLog），返回本次结算的秒数
export function commitPending() {
  const p = pendingSecs()
  if (p > 0) state.committed = state.secs
  return p
}

// 结束：返回本段未结算的秒数（已结算部分不会重复计入），并归零
export function stopTimer() {
  const p = pendingSecs()
  state.running = false
  clearInterval(state.id)
  state.id = null
  state.secs = 0
  state.committed = 0
  // 番茄钟状态一并复位，下次开始是全新的一轮
  state.phase = 'focus'
  state.remain = POMO_FOCUS
  emit()
  return p
}

// 切换计时模式（正计时 / 番茄钟）。若正在跑会先暂停，避免状态打架。
export function setTimerMode(mode) {
  if (state.mode === mode) return
  if (state.running) pauseTimer()
  state.mode = mode
  state.phase = 'focus'
  state.remain = POMO_FOCUS
  state.phaseEvent = null
  emit()
}

// 番茄钟：跳过当前阶段（专注 → 立刻休息；休息 → 立刻开始下一轮专注）
export function skipPhase() {
  if (state.mode !== 'pomodoro') return
  if (state.phase === 'focus') {
    state.phase = 'break'
    state.remain = POMO_BREAK
    firePhase('break')
  } else {
    state.phase = 'focus'
    state.remain = POMO_FOCUS
    firePhase('focus')
  }
  emit()
}

export function useStudyTimer() {
  const [, force] = useState(0)
  useEffect(() => {
    const fn = () => force((x) => x + 1)
    listeners.add(fn)
    return () => listeners.delete(fn)
  }, [])
  return {
    secs: state.secs,
    running: state.running,
    mode: state.mode,
    phase: state.phase,
    remain: state.remain,
    phaseEvent: state.phaseEvent,
    start: startTimer,
    pause: pauseTimer,
    stop: stopTimer,
    setMode: setTimerMode,
    skipPhase: skipPhase,
  }
}
