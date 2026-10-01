import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import { Header } from '../components/Layout'
import { Avatar, Icon, Page, Spinner, ErrorNotice } from '../components/ui'

function fmtWhen(d) {
  const x = new Date(d)
  const today = new Date()
  if (x.toDateString() === today.toDateString()) return x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

// ─── Liste des conversations (colonne gauche) ────────────────────────────────
function ConversationList({ activeId }) {
  const { coach } = useAuth()
  const navigate = useNavigate()
  const [convs, setConvs] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('messages')
      .select('*, from:from_id(id, full_name, photo_url), to:to_id(id, full_name, photo_url)')
      .or(`from_id.eq.${coach.id},to_id.eq.${coach.id}`)
      .order('created_at', { ascending: false })
    setError(err)
    if (err) return
    const seen = new Set()
    const out = []
    for (const m of data || []) {
      const other = m.from_id === coach.id ? m.to : m.from
      if (other && !seen.has(other.id)) {
        seen.add(other.id)
        out.push({ ...m, other, unreadCount: (data || []).filter(x => x.from_id === other.id && x.to_id === coach.id && !x.read_at).length })
      }
    }
    setConvs(out)
  }, [coach.id])

  useEffect(() => {
    load()
    const ch = supabase.channel(`msglist:${coach.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_id=eq.${coach.id}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [coach.id, load, activeId])

  return (
    <div className="card w-[340px] flex-shrink-0 flex flex-col overflow-hidden">
      <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <p className="card-title">Conversations</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {convs === null && error && <div className="p-4"><ErrorNotice compact error={error} onRetry={load} /></div>}
        {convs === null && !error && <div className="py-10 flex justify-center"><Spinner /></div>}
        {convs?.length === 0 && <p className="text-sm muted p-5">Les conversations avec tes athlètes apparaîtront ici.</p>}
        {(convs || []).map(c => {
          const on = c.other.id === activeId
          return (
            <button key={c.other.id} onClick={() => navigate(`/messages/${c.other.id}`)}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors"
              style={{ background: on ? 'var(--red-soft)' : undefined, borderBottom: '1px solid var(--border)' }}>
              <Avatar name={c.other.full_name} url={c.other.photo_url} id={c.other.id} size={42} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold truncate">{c.other.full_name}</p>
                  <span className="text-[11px] muted flex-shrink-0">{fmtWhen(c.created_at)}</span>
                </div>
                <p className="text-[13px] truncate" style={{ color: c.unreadCount && !on ? 'var(--text1)' : 'var(--text3)', fontWeight: c.unreadCount && !on ? 700 : 400 }}>
                  {c.from_id === coach.id ? 'Vous : ' : ''}{c.content}
                </p>
              </div>
              {c.unreadCount > 0 && !on && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-extrabold flex items-center justify-center text-white" style={{ background: 'var(--red)' }}>{c.unreadCount}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Shell({ activeId, children }) {
  return (
    <Page wide>
      <Header eyebrow="Espace coach" title="Messages" search={false} />
      <div className="flex gap-5" style={{ height: 'calc(100vh - 170px)' }}>
        <ConversationList activeId={activeId} />
        <div className="card flex-1 min-w-0 flex flex-col overflow-hidden">{children}</div>
      </div>
    </Page>
  )
}

export function MessagesList() {
  return (
    <Shell>
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-10">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'var(--red-soft)', color: 'var(--red)' }}><Icon name="message" size={26} /></div>
        <p className="text-lg font-extrabold">Choisis une conversation</p>
        <p className="text-sm muted max-w-xs">Ou écris à un athlète depuis sa fiche (bouton « Message »).</p>
      </div>
    </Shell>
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
  const broadcastChannelRef = useRef(null) // canal abonné, nécessaire pour émettre

  useEffect(() => {
    if (!coach?.id || !athleteId) return
    loadedRef.current = false

    supabase.from('profiles').select('id,full_name,photo_url').eq('id', athleteId).single()
      .then(({ data }) => setAthlete(data))

    loadHistory()

    // Messages entrants
    const pgChannel = supabase.channel(`conv:${coach.id}:${athleteId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_id=eq.${coach.id}` }, ({ new: msg }) => {
        if (!msg?.id || msg.from_id !== athleteId) return
        setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
        supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', msg.id).then(() => {})
        decrementUnread(1)
      })
      .subscribe()

    // Canal broadcast écouté par l'app mobile (notification instantanée)
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
    if (messages.length) loadedRef.current = true
  }, [messages])

  async function loadHistory() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(from_id.eq.${coach.id},to_id.eq.${athleteId}),and(from_id.eq.${athleteId},to_id.eq.${coach.id})`)
      .order('created_at', { ascending: true })
    setMessages(data || [])

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
    const content = text.trim().slice(0, 4000)
    if (!content || sending) return
    setSending(true)
    setText('')
    inputRef.current?.focus()

    const optimisticId = `opt-${Date.now()}`
    setMessages(prev => [...prev, { id: optimisticId, from_id: coach.id, to_id: athleteId, content, created_at: new Date().toISOString(), read_at: null, _pending: true }])

    const { data, error } = await supabase.from('messages').insert({ from_id: coach.id, to_id: athleteId, content }).select().single()

    if (!error && data && broadcastChannelRef.current) {
      broadcastChannelRef.current.send({
        type: 'broadcast', event: 'new-message',
        payload: { id: data.id, from_id: coach.id, content, senderName: coach.full_name, senderPhoto: coach.photo_url },
      }).catch(() => {})
    }
    setSending(false)
    if (error) {
      setMessages(prev => prev.filter(m => m.id !== optimisticId))
      setText(content)
    } else {
      setMessages(prev => prev.map(m => m.id === optimisticId ? data : m))
    }
  }

  return (
    <Shell activeId={athleteId}>
      <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <Avatar name={athlete?.full_name} url={athlete?.photo_url} id={athleteId} size={40} />
        <div className="flex-1">
          <p className="font-extrabold">{athlete?.full_name}</p>
          <button className="text-[12px] font-semibold" style={{ color: 'var(--red)' }} onClick={() => navigate(`/athletes/${athleteId}`)}>Voir le suivi →</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-1.5" style={{ background: 'var(--surface2)' }}>
        {messages.length === 0 && <p className="text-sm muted text-center my-auto">Aucun message. Écris le premier !</p>}
        {messages.map((m, i) => {
          const isMe = m.from_id === coach.id
          const prev = messages[i - 1]
          const showTime = !prev || new Date(m.created_at) - new Date(prev.created_at) > 5 * 60 * 1000
          return (
            <div key={m.id}>
              {showTime && (
                <p className="text-center text-[11px] muted my-3 font-semibold">
                  {new Date(m.created_at).toLocaleString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-md px-4 py-2.5 text-[14px] leading-relaxed"
                  style={{
                    background: isMe ? 'var(--red)' : 'var(--surface)',
                    color: isMe ? '#fff' : 'var(--text1)',
                    border: isMe ? 'none' : '1px solid var(--border)',
                    opacity: m._pending ? 0.6 : 1,
                    borderRadius: 18,
                    borderBottomRightRadius: isMe ? 6 : 18,
                    borderBottomLeftRadius: isMe ? 18 : 6,
                  }}>
                  <p style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.content}</p>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="px-5 py-4 flex gap-3 items-end" style={{ borderTop: '1px solid var(--border)' }}>
        <textarea ref={inputRef} value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e) } }}
          placeholder="Écrire un message… (Entrée pour envoyer)" rows={1}
          className="input flex-1" style={{ maxHeight: 120, resize: 'none', borderRadius: 22 }} />
        <button type="submit" disabled={!text.trim() || sending} className="btn btn-primary btn-icon" aria-label="Envoyer">
          <Icon name="arrow" size={18} />
        </button>
      </form>
    </Shell>
  )
}
