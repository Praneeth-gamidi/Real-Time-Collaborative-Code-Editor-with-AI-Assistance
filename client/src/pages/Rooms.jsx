import React, { useEffect, useState } from 'react'
import { getAccessStatus, sendJoinRequest } from '../services/api'
import Toast from '../components/Toast'

export default function Rooms({ user, token, onJoinRoom }) {
  console.log('Rooms component render, user:', user, 'token:', token ? 'present' : 'missing')
  
  const [mode, setMode] = useState('menu') // 'menu', 'create', 'join', 'pending'
  const [roomId, setRoomId] = useState('')
  const [createdRoomId, setCreatedRoomId] = useState('')
  const [pendingRequests, setPendingRequests] = useState([])
  const [toasts, setToasts] = useState([])
  const [pendingStatus, setPendingStatus] = useState('pending')
  const [activeRoomId, setActiveRoomId] = useState('')

  const pushToast = (message, type = 'info', duration = 3000) => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, type, duration }])
  }
  const removeToast = id => setToasts(t => t.filter(x => x.id !== id))

  useEffect(() => {
    if (mode !== 'pending') return
    if (!activeRoomId) return
    let canceled = false

    const tick = async () => {
      const resp = await getAccessStatus({ token, docId: activeRoomId })
      if (canceled) return
      if (resp?.status) setPendingStatus(resp.status)
      if (resp?.status === 'approved') {
        pushToast('Request approved! Entering room...', 'success')
        setTimeout(() => onJoinRoom(activeRoomId), 500)
      }
    }

    tick()
    const interval = setInterval(tick, 2000)
    return () => {
      canceled = true
      clearInterval(interval)
    }
  }, [mode, activeRoomId, token])

  const handleCreateRoom = () => {
    const newRoomId = 'room-' + Math.random().toString(36).substr(2, 9)
    setCreatedRoomId(newRoomId)
    setMode('created')
    pushToast(`Room created: ${newRoomId}`, 'success')
  }

  const handleJoinRoom = async () => {
    if (!roomId.trim()) {
      pushToast('Please enter a room ID', 'error')
      return
    }
    try {
      const resp = await sendJoinRequest({ token, docId: roomId.trim() })
      if (resp?.ok) {
        pushToast('Join request sent to room owner', 'success')
        setMode('pending')
        setPendingStatus('pending')
        setActiveRoomId(roomId.trim())
        setPendingRequests(prev => [...prev, { 
          id: roomId.trim(), 
          status: 'pending',
          requestedAt: new Date()
        }])
      } else if (resp?.error) {
        pushToast(resp.error, 'error')
      }
    } catch (e) {
      console.error('Join request failed:', e)
      pushToast('Failed to send join request', 'error')
    }
  }

  const handleGoToRoom = (roomId) => {
    onJoinRoom(roomId)
  }

  if (mode === 'created') {
    return (
      <div className="auth-page">
        <div className="auth-form">
          <h2>Room Created Successfully</h2>
          <div className="room-details">
            <div className="room-id-display">
              <label>Room ID</label>
              <div className="room-id-value">{createdRoomId}</div>
            </div>
            <p style={{ color: '#94a3b8', margin: '16px 0' }}>
              Share this Room ID with others to invite them to collaborate.
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => handleGoToRoom(createdRoomId)}>
            Enter Room
          </button>
          <button className="btn btn-link" onClick={() => setMode('menu')}>
            Back to Menu
          </button>
          <div className="toasts">
            {toasts.map(t => (
              <Toast key={t.id} id={t.id} message={t.message} type={t.type} duration={t.duration} onClose={removeToast} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'pending') {
    return (
      <div className="auth-page">
        <div className="auth-form">
          <h2>Join Request Sent</h2>
          <div className="pending-info">
            <p style={{ color: '#94a3b8', marginBottom: '16px' }}>
              Your join request has been sent to the room owner. You'll be able to enter once they approve it.
            </p>
            {pendingStatus === 'none' && (
              <p style={{ color: '#f59e0b', marginBottom: '16px' }}>
                Your request is not pending anymore. It may have been declined.
              </p>
            )}
            <div className="request-list">
              {pendingRequests.map(req => (
                <div key={req.id} className="request-item">
                  <span className="request-id">{req.id}</span>
                  <span className="request-status">{pendingStatus === 'approved' ? 'Approved' : pendingStatus === 'none' ? 'Declined' : 'Pending Approval'}</span>
                </div>
              ))}
            </div>
          </div>
          <button className="btn btn-outline" onClick={() => setMode('menu')}>
            Back to Menu
          </button>
          <div className="toasts">
            {toasts.map(t => (
              <Toast key={t.id} id={t.id} message={t.message} type={t.type} duration={t.duration} onClose={removeToast} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'create') {
    return (
      <div className="auth-page">
        <div className="auth-form">
          <h2>Create Room</h2>
          <p style={{ color: '#94a3b8', marginBottom: '24px' }}>
            Create a new collaborative room. You'll be the owner and can share the room ID with others.
          </p>
          <button className="btn btn-primary" onClick={handleCreateRoom}>
            Create New Room
          </button>
          <button className="btn btn-link" onClick={() => setMode('menu')}>
            Back to Menu
          </button>
          <div className="toasts">
            {toasts.map(t => (
              <Toast key={t.id} id={t.id} message={t.message} type={t.type} duration={t.duration} onClose={removeToast} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (mode === 'join') {
    return (
      <div className="auth-page">
        <div className="auth-form">
          <h2>Join Room</h2>
          <p style={{ color: '#94a3b8', marginBottom: '24px' }}>
            Enter a room ID to request access. The room owner will be notified and can approve your request.
          </p>
          <div className="stack-col">
            <input
              type="text"
              placeholder="Enter Room ID"
              value={roomId}
              onChange={e => setRoomId(e.target.value)}
              className="room-input"
            />
          </div>
          <button className="btn btn-primary" onClick={handleJoinRoom}>
            Send Join Request
          </button>
          <button className="btn btn-link" onClick={() => setMode('menu')}>
            Back to Menu
          </button>
          <div className="toasts">
            {toasts.map(t => (
              <Toast key={t.id} id={t.id} message={t.message} type={t.type} duration={t.duration} onClose={removeToast} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-form">
        <div className="user-details">
          <div className="user-avatar">
            {user.username ? user.username.charAt(0).toUpperCase() : 'U'}
          </div>
          <div className="user-info">
            <h3>{user.username || 'User'}</h3>
            <p>{user.email || ''}</p>
          </div>
        </div>
        
        <div className="room-actions">
          <h2>Room Management</h2>
          <p style={{ color: '#94a3b8', marginBottom: '32px' }}>
            Create a new room or join an existing one to start collaborating.
          </p>
          <div className="action-buttons">
            <button className="btn btn-primary btn-large" onClick={() => setMode('create')}>
              <span className="btn-icon">+</span>
              Create Room
            </button>
            <button className="btn btn-outline btn-large" onClick={() => setMode('join')}>
              <span className="btn-icon">→</span>
              Join Room
            </button>
          </div>
        </div>
        
        <div className="toasts">
          {toasts.map(t => (
            <Toast key={t.id} id={t.id} message={t.message} type={t.type} duration={t.duration} onClose={removeToast} />
          ))}
        </div>
      </div>
    </div>
  )
}
