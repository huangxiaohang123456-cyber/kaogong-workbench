import { useEffect, useState } from 'react'

// 模块级单例：跨组件卸载而存活，保证切换功能模块时计时器不重置、不停止
const state = {
  running: false,
  secs: 0,        // 本次会话累计总秒数（含已结算部分）
  committed: 0,   // 已经记账进 studyLog 的秒数（防止重复计入）
  id: null,
}
const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())
const tick = () => { state.secs += 1; emit() }

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
  emit()
  return p
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
    start: startTimer,
    pause: pauseTimer,
    stop: stopTimer,
  }
}
