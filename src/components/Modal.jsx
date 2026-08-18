import { useEffect } from 'react'

export function Modal({ title, children, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose && onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-mask" onClick={(e) => { if (e.target === e.currentTarget) onClose && onClose() }}>
      <div className="modal">
        {title && <h3>{title}</h3>}
        {children}
      </div>
    </div>
  )
}
