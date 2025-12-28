import { useEffect } from 'react'

export default function Toast({ id, message, type = 'info', onClose, duration = 3000 }) {
  useEffect(() => {
    const t = setTimeout(() => onClose?.(id), duration)
    return () => clearTimeout(t)
  }, [id, onClose, duration])

  return (
    <div className={`toast toast-${type}`} role="status" aria-live="polite">
      <span>{message}</span>
      <button className="toast-close" onClick={() => onClose?.(id)} aria-label="Close">×</button>
    </div>
  )
}
