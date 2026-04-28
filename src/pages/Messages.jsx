import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'

const COACH_COLOR = '#22C5D5'

// ─── Messages list ────────────────────────────────────────────────────────────
export function MessagesList() {
  const { coach } = useAuth()
  const { unread } = useNotifications()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState([])

  useEffect(() => {
    if (!coach?.id) return
    fetchConversations()

    // Real-time: update list when new message arrives
    const channel = supabase.channel(`msglist:${coach.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `to_id=eq.${coach.id}`,
      }, () => fetchConversations())
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [coach?.id])

  async function fetchConversations() {
    const { data } = await supabase
      .from('messages')
      .select('*, from:from_id(id, full_name, photo_url), to:to_id(id, full_name, photo_url)')
      .or(`from_id.eq.${coach.id},to_id.eq.${coach.id}`)
      .order('created_at', { ascending: false })

    const seen = new Set()
    const convs = []
    for (const m of (data || [])) {
      const other = m.from_id === coach.id ? m.to : m.from
      if (other && !seen.has(other.id)) {
        seen.add(other.id)
        convs.push({ ...m, other })
      }
    }
    setConversations(convs)
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-white mb-6">Messages</h1>
      {conversations.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-3xl mb-3">💬</p>
          <p className="text-white font-semibold">Aucun message</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>Les conversations avec tes athlètes apparaîtront ici.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {conversations.map(({ id, other, content, created_at, read_at, from_id }) => {
            const isUnread = from_id !== coach.id && !read_at
            return (
              <button
                key={id}
                onClick={() => navigate(`/messages/${other.id}`)}
                className="flex items-center gap-4 p-4 rounded-2xl text-left transition-all hover:scale-[1.01]"
                style={{
                  background: 'var(--surface)',
                  border: `1px solid ${isUnread ? COACH_COLOR + '44' : 'var(--border)'}`,
                }}
              >
                {other.photo_url ? (
                  <img src={other.photo_url} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white"
                    style={{ background: 'var(--red)' }}>
                    {other.full_name?.[0]?.toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className={`font-semibold text-sm ${isUnread ? 'text-white' : 'text-white'}`}>{other.full_name}</p>
                    <p className="text-xs flex-shrink-0 ml-2" style={{ color: 'var(--text3)' }}>
                      {new Date(created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      {' · '}
                      {new Date(created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p className="text-sm truncate mt-0.5"
                    style={{ color: isUnread ? COACH_COLOR : 'var(--text3)', fontWeight: isUnread ? 600 : 400 }}>
                    {from_id === coach.id ? 'Vous : ' : ''}{content}
                  </p>
                </div>
                {isUnread && (
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COACH_COLOR }} />
                )}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Conversation ─────────────────────────────────────────────────────────────
export function Conversation() {
  const { id: athleteId } = useParams()
  const { coach } = useAuth()
  const { decrementUnread } = useNotifications()
  const navigate = useNavigate()

  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [athlete, setAthlete] = useState(null)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const loadedRef = useRef(false)
  const broadcastChannelRef = useRef(null) // subscribed channel used for sending broadcasts

  useEffect(() => {
    if (!coach?.id || !athleteId) return

    supabase.from('profiles').select('id,full_name,photo_url').eq('id', athleteId).single()
      .then(({ data }) => setAthlete(data))

    loadHistory()

    // Channel 1: postgres_changes for incoming messages
    const pgChannel = supabase.channel(`conv:${coach.id}:${athleteId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `to_id=eq.${coach.id}`,
      }, ({ new: msg }) => {
        if (!msg?.id || msg.from_id !== athleteId) return
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
        supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', msg.id).then(() => {})
        decrementUnread(1)
      })
      .subscribe()

    // Channel 2: broadcast channel — MUST subscribe before we can send on it
    // This is what the mobile app listens to for instant notifications
    const bc = supabase.channel(`notify:athlete:${athleteId}`)
    bc.subscribe()
    broadcastChannelRef.current = bc

    return () => {
      supabase.removeChannel(pgChannel)
      supabase.removeChannel(bc)
      broadcastChannelRef.current = null
    }
  }, [coach?.id, athleteId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: loadedRef.current ? 'smooth' : 'instant' })
    loadedRef.current = true
  }, [messages])

  async function loadHistory() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(from_id.eq.${coach.id},to_id.eq.${athleteId}),and(from_id.eq.${athleteId},to_id.eq.${coach.id})`)
      .order('created_at', { ascending: true })

    setMessages(data || [])

    // Mark all unread from this athlete as read
    const { count } = await supabase.from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('to_id', coach.id).eq('from_id', athleteId).is('read_at', null)

    if (count > 0) {
      await supabase.from('messages').update({ read_at: new Date().toISOString() })
        .eq('to_id', coach.id).eq('from_id', athleteId).is('read_at', null)
      decrementUnread(count)
    }
  }

  async function sendMessage(e) {
    e.preventDefault()
    const content = text.trim()
    if (!content || sending) return

    setSending(true)
    setText('')
    inputRef.current?.focus()

    // Optimistic: add to state immediately
    const optimisticId = `opt-${Date.now()}`
    const optimistic = {
      id: optimisticId,
      from_id: coach.id,
      to_id: athleteId,
      content,
      created_at: new Date().toISOString(),
      read_at: null,
      _pending: true,
    }
    setMessages(prev => [...prev, optimistic])

    const { data, error } = await supabase
      .from('messages')
      .insert({ from_id: coach.id, to_id: athleteId, content })
      .select()
      .single()

    // Broadcast to athlete — uses the already-subscribed channel (subscription required to send)
    if (!error && data && broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast',
        event: 'new-message',
        payload: { id: data.id, from_id: coach.id, content, senderName: coach.full_name, senderPhoto: coach.photo_url },
      }).catch(() => {})
    }

    setSending(false)

    if (error) {
      // Remove optimistic on error, restore text
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
      setText(content)
    } else {
      // Replace optimistic with real message
      setMessages(prev => prev.map(m => m.id === optimisticId ? data : m))
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(e)
    }
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b flex-shrink-0"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <button onClick={() => navigate('/messages')} className="text-sm mr-1 hover:opacity-70" style={{ color: 'var(--text3)' }}>←</button>
        {athlete?.photo_url
          ? <img src={athlete.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
          : <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'var(--red)' }}>
              {athlete?.full_name?.[0]}
            </div>
        }
        <p className="font-semibold text-white text-sm flex-1">{athlete?.full_name}</p>
        <div className="w-2 h-2 rounded-full" style={{ background: '#4ade80' }} title="Connecté" />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-2">
        {messages.map((m, i) => {
          const isMe = m.from_id === coach.id
          const prevMsg = messages[i - 1]
          const showTime = !prevMsg || new Date(m.created_at) - new Date(prevMsg.created_at) > 5 * 60 * 1000
          return (
            <div key={m.id}>
              {showTime && (
                <div className="text-center text-[10px] my-2" style={{ color: 'var(--text3)' }}>
                  {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm transition-opacity"
                  style={{
                    background: isMe ? 'var(--red)' : 'var(--surface2)',
                    color: isMe ? '#fff' : 'var(--text1)',
                    opacity: m._pending ? 0.6 : 1,
                    borderBottomRightRadius: isMe ? 4 : 16,
                    borderBottomLeftRadius: isMe ? 16 : 4,
                  }}
                >
                  <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</p>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage}
        className="px-6 py-4 border-t flex gap-3 flex-shrink-0"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Écrire un message… (Entrée pour envoyer)"
          rows={1}
          className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white outline-none resize-none"
          style={{
            background: 'var(--surface2)',
            border: '1px solid var(--border)',
            maxHeight: 120,
            overflow: 'auto',
          }}
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity self-end flex-shrink-0"
          style={{ background: 'var(--red)', opacity: text.trim() && !sending ? 1 : 0.4 }}
        >
          {sending ? '…' : 'Envoyer'}
        </button>
      </form>
    </div>
  )
}
