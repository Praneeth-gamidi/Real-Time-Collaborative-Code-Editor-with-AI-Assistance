import React, { useState } from 'react'
import { login } from '../services/api'
import Toast from '../components/Toast'

export default function Login({ onAuth }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [toasts, setToasts] = useState([])

  const pushToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, type, duration }])
  }
  const removeToast = id => setToasts(t => t.filter(x => x.id !== id))

  const handleSubmit = async e => {
    e.preventDefault()
    console.log('Login submit attempt with email:', email)
    try {
      const resp = await login({ email, password })
      console.log('Login response:', resp)
      if (resp?.token) {
        localStorage.setItem('token', resp.token)
        console.log('Token stored, calling onAuth')
        onAuth(resp.token)
        pushToast('Logged in', 'success')
      } else {
        console.log('Login failed:', resp?.error)
        pushToast(resp?.error || 'Login failed', 'error')
      }
    } catch (error) {
      console.error('Login error:', error)
      pushToast('Login failed', 'error')
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Sign In</h2>
        <div className="stack-col">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary">Sign In</button>
        </div>
        <p className="auth-switch">
          No account? <button type="button" className="btn-link" onClick={() => onAuth('register')}>Create one</button>
        </p>
      </form>
      <div className="toasts">
        {toasts.map(t => (
          <Toast key={t.id} id={t.id} message={t.message} type={t.type} duration={t.duration} onClose={removeToast} />
        ))}
      </div>
    </div>
  )
}
