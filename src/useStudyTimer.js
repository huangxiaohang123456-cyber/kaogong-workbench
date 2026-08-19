import { useEffect, useState } from 'react'

// 模块级单例：跨组件卸载而存活，保证切换功能模块时计时器不重置、不停止
const state = {
  running: false,
  secs: 0,
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

// 结束：返回本次累计秒数，并归零
export function stopTimer() {
  const final = state.secs
  state.running = false
  clearInterval(state.id)
  state.id = null
  state.secs = 0
  emit()
  return final
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
