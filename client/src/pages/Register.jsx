import React, { useState } from 'react'
import { register } from '../services/api'
import Toast from '../components/Toast'

export default function Register({ onAuth }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [toasts, setToasts] = useState([])

  const pushToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, type, duration }])
  }
  const removeToast = id => setToasts(t => t.filter(x => x.id !== id))

  const handleSubmit = async e => {
    e.preventDefault()
    console.log('Register payload:', { email, password, username })
    const resp = await register({ email, password, username })
    if (resp?.token) {
      localStorage.setItem('token', resp.token)
      onAuth(resp.token)
      pushToast('Registered successfully', 'success')
    } else {
      pushToast(resp?.error || 'Register failed', 'error')
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Create Account</h2>
        <div className="stack-col">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
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
          <button type="submit" className="btn btn-primary">Register</button>
        </div>
        <p className="auth-switch">
          Already have an account? <button type="button" className="btn-link" onClick={() => onAuth('login')}>Sign in</button>
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
