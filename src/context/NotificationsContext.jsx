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
  const timerRefs = useRef({})

  useEffect(() => { locationRef.current = location.pathname }, [location.pathname])

  // Request browser notification permission
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
      .eq('to_id', coach.id)
      .is('read_at', null)
      .then(({ count }) => setUnread(count || 0))
  }, [coach?.id])

  // ── Subscriptions ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!coach?.id) return

    // 1) Broadcast channel — instant, sent by mobile app after insert
    const broadcastChannel = supabase.channel(`notify:coach:${coach.id}`)
      .on('broadcast', { event: 'new-message' }, ({ payload }) => {
        handleIncoming(payload)
      })
      .subscribe()

    // 2) Postgres changes — backup (fires if broadcast missed / sent from web)
    const pgChannel = supabase.channel(`notifs-pg:${coach.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `to_id=eq.${coach.id}`,
      }, ({ new: msg }) => {
        if (!msg?.id) return
        handleIncoming({
          id: msg.id,
          from_id: msg.from_id,
          content: msg.content,
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(broadcastChannel)
      supabase.removeChannel(pgChannel)
    }
  }, [coach?.id])

  async function handleIncoming({ id, from_id, content, senderName, senderPhoto }) {
    // Deduplicate — same message might arrive via broadcast AND postgres_changes
    setToasts(prev => {
      if (prev.find(t => t.id === id)) return prev
      return prev // processed below
    })

    const onThisConv = locationRef.current === `/messages/${from_id}`
    if (!onThisConv) setUnread(n => n + 1)

    // Resolve sender if not already provided (from broadcast payload)
    let name = senderName
    let photo = senderPhoto
    if (!name && from_id) {
      const { data } = await supabase.from('profiles').select('full_name,photo_url').eq('id', from_id).single()
      name = data?.full_name || '…'
      photo = data?.photo_url || null
    }

    if (!onThisConv) {
      const toast = { id: id || Date.now(), senderId: from_id, senderName: name, senderPhoto: photo, content }

      setToasts(prev => {
        if (prev.find(t => t.id === toast.id)) return prev // dedup
        return [...prev.slice(-2), toast]
      })

      // Auto-dismiss
      clearTimeout(timerRefs.current[toast.id])
      timerRefs.current[toast.id] = setTimeout(() => {
        dismissToast(toast.id)
        delete timerRefs.current[toast.id]
      }, 6000)

      // Browser notification when tab not focused
      if (!document.hasFocus() && 'Notification' in window && Notification.permission === 'granted') {
        new Notification(`💬 ${name}`, {
          body: content,
          icon: photo || undefined,
          tag: `msg-${from_id}`,
          requireInteraction: false,
        })
      }
    }
  }

  function dismissToast(id) {
    clearTimeout(timerRefs.current[id])
    delete timerRefs.current[id]
    setToasts(prev => prev.filter(t => t.id !== id))
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
