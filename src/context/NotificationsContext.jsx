import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

const Ctx = createContext(null)

export function NotificationsProvider({ children }) {
  const { coach } = useAuth()
  const location = useLocation()
  const locationRef = useRef(location.pathname)
  const [toasts, setToasts] = useState([])
  const [unread, setUnread] = useState(0)
  // Sync Set for O(1) dedup — avoids double-notify from broadcast + pg_changes
  const seen = useRef(new Set())
  const timers = useRef({})

  useEffect(() => { locationRef.current = location.pathname }, [location.pathname])

  useEffect(() => {
    if (coach?.id && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [coach?.id])

  // Initial unread count
  useEffect(() => {
    if (!coach?.id) return
    supabase.from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('to_id', coach.id).is('read_at', null)
      .then(({ count }) => setUnread(count || 0))
  }, [coach?.id])

  // Single channel with both broadcast AND postgres_changes
  useEffect(() => {
    if (!coach?.id) return

    const channel = supabase.channel(`notifs:${coach.id}`)
      // Broadcast — instant, sent by mobile app after insert
      .on('broadcast', { event: 'new-message' }, ({ payload }) => {
        if (payload?.id && payload?.from_id) notify(payload)
      })
      // Postgres changes — always works, even without broadcast
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `to_id=eq.${coach.id}`,
      }, ({ new: msg }) => {
        if (msg?.id) notify({ id: msg.id, from_id: msg.from_id, content: msg.content })
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [coach?.id])

  async function notify({ id, from_id, content, senderName, senderPhoto }) {
    if (!id || !from_id) return
    // Deduplicate synchronously (broadcast + pg_changes may both fire)
    if (seen.current.has(id)) return
    seen.current.add(id)
    if (seen.current.size > 200) seen.current.clear()

    const onConv = locationRef.current === `/messages/${from_id}`
    if (!onConv) setUnread(n => n + 1)

    // Resolve sender name/photo
    let name = senderName
    let photo = senderPhoto
    if (!name) {
      const { data } = await supabase.from('profiles')
        .select('full_name,photo_url').eq('id', from_id).single()
      name = data?.full_name || 'Athlète'
      photo = data?.photo_url || null
    }

    if (!onConv) {
      const toast = { id, senderId: from_id, senderName: name, senderPhoto: photo, content }
      setToasts(prev => [...prev.slice(-2), toast])

      clearTimeout(timers.current[id])
      timers.current[id] = setTimeout(() => {
        setToasts(p => p.filter(t => t.id !== id))
        delete timers.current[id]
      }, 6000)

      if (!document.hasFocus() && Notification.permission === 'granted') {
        new Notification(`💬 ${name}`, { body: content, icon: photo || undefined, tag: `msg-${from_id}` })
      }
    }
  }

  function dismissToast(id) {
    clearTimeout(timers.current[id])
    delete timers.current[id]
    setToasts(p => p.filter(t => t.id !== id))
  }

  function clearUnread() { setUnread(0) }
  function decrementUnread(n = 1) { setUnread(p => Math.max(0, p - n)) }

  return (
    <Ctx.Provider value={{ toasts, unread, dismissToast, clearUnread, decrementUnread }}>
      {children}
    </Ctx.Provider>
  )
}

export const useNotifications = () => useContext(Ctx)
