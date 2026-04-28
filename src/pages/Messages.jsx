import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export function MessagesList() {
  const { coach } = useAuth()
  const navigate = useNavigate()
  const [conversations, setConversations] = useState([])

  useEffect(() => {
    if (!coach?.id) return
    fetchConversations()
  }, [coach?.id])

  async function fetchConversations() {
    const { data } = await supabase
      .from('messages')
      .select('*, from:from_id(id, full_name, photo_url), to:to_id(id, full_name, photo_url)')
      .or(`from_id.eq.${coach.id},to_id.eq.${coach.id}`)
      .order('created_at', { ascending: false })

    // Dédupliquer par interlocuteur
    const seen = new Set()
    const convs = []
    for (const m of (data || [])) {
      const other = m.from_id === coach.id ? m.to : m.from
      if (!seen.has(other.id)) {
        seen.add(other.id)
        convs.push({ ...m, other })
      }
    }
    setConversations(convs)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-6">Messages</h1>
      {conversations.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <p className="text-3xl mb-3">💬</p>
          <p className="text-white font-semibold">Aucun message</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text3)' }}>Les conversations avec tes athlètes apparaîtront ici.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {conversations.map(({ id, other, content, created_at, read_at, from_id }) => (
            <button
              key={id}
              onClick={() => navigate(`/messages/${other.id}`)}
              className="flex items-center gap-4 p-4 rounded-2xl text-left transition-all hover:scale-[1.01]"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              {other.photo_url ? (
                <img src={other.photo_url} alt="" className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-white" style={{ background: 'var(--red)' }}>
                  {other.full_name?.[0]?.toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white text-sm">{other.full_name}</p>
                  <p className="text-xs flex-shrink-0 ml-2" style={{ color: 'var(--text3)' }}>
                    {new Date(created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <p className="text-sm truncate mt-0.5" style={{ color: from_id !== coach.id && !read_at ? 'var(--cyan)' : 'var(--text3)' }}>
                  {from_id === coach.id ? 'Vous : ' : ''}{content}
                </p>
              </div>
              {from_id !== coach.id && !read_at && (
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--cyan)' }} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Conversation() {
  const { id: athleteId } = useParams()
  const { coach } = useAuth()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [athlete, setAthlete] = useState(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!coach?.id || !athleteId) return
    supabase.from('profiles').select('id, full_name, photo_url').eq('id', athleteId).single().then(({ data }) => setAthlete(data))
    fetchMessages()
    const channel = supabase.channel('messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => fetchMessages())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [coach?.id, athleteId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function fetchMessages() {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(from_id.eq.${coach.id},to_id.eq.${athleteId}),and(from_id.eq.${athleteId},to_id.eq.${coach.id})`)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    // Marquer comme lus
    await supabase.from('messages').update({ read_at: new Date().toISOString() })
      .eq('to_id', coach.id).eq('from_id', athleteId).is('read_at', null)
  }

  async function sendMessage(e) {
    e.preventDefault()
    if (!text.trim()) return
    await supabase.from('messages').insert({ from_id: coach.id, to_id: athleteId, content: text.trim() })
    setText('')
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <button onClick={() => navigate('/messages')} className="text-sm mr-1 hover:opacity-70" style={{ color: 'var(--text3)' }}>←</button>
        {athlete?.photo_url ? (
          <img src={athlete.photo_url} alt="" className="w-8 h-8 rounded-full object-cover" />
        ) : (
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: 'var(--red)' }}>
            {athlete?.full_name?.[0]}
          </div>
        )}
        <p className="font-semibold text-white text-sm">{athlete?.full_name}</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
        {messages.map(m => {
          const isMe = m.from_id === coach.id
          return (
            <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div
                className="max-w-xs px-4 py-2.5 rounded-2xl text-sm"
                style={{
                  background: isMe ? 'var(--red)' : 'var(--surface2)',
                  color: isMe ? '#fff' : 'var(--text1)',
                }}
              >
                <p>{m.content}</p>
                <p className="text-[10px] mt-1 opacity-60">
                  {new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="px-6 py-4 border-t flex gap-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Écrire un message..."
          className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white outline-none"
          style={{ background: 'var(--surface2)', border: '1px solid var(--border)' }}
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity"
          style={{ background: 'var(--red)', opacity: text.trim() ? 1 : 0.4 }}
        >
          Envoyer
        </button>
      </form>
    </div>
  )
}
