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

  useEffect(() => { locationRef.current = location.pathname }, [location.pathname])

  // Request browser notification permission once
  useEffect(() => {
    if (coach?.id && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [coach?.id])

  // Fetch initial unread count
  useEffect(() => {
    if (!coach?.id) return
    supabase.from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('to_id', coach.id)
      .is('read_at', null)
      .then(({ count }) => setUnread(count || 0))
  }, [coach?.id])

  // Global real-time subscription for incoming messages
  useEffect(() => {
    if (!coach?.id) return

    const channel = supabase.channel(`notifs:${coach.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `to_id=eq.${coach.id}`,
      }, async (payload) => {
        const msg = payload.new
        const onThisConv = locationRef.current === `/messages/${msg.from_id}`

        // Always increment unread (Conversation will clear it when opened)
        if (!onThisConv) {
          setUnread(n => n + 1)

          // Fetch sender profile for display
          const { data: sender } = await supabase
            .from('profiles')
            .select('full_name,photo_url')
            .eq('id', msg.from_id)
            .single()

          const toast = {
            id: msg.id,
            senderId: msg.from_id,
            senderName: sender?.full_name || '…',
            senderPhoto: sender?.photo_url || null,
            content: msg.content,
          }

          setToasts(prev => [...prev.slice(-2), toast]) // keep max 3

          // Auto-dismiss after 5 seconds
          setTimeout(() => dismissToast(msg.id), 5000)

          // Browser push notification when tab is hidden
          if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
            new Notification(`💬 ${sender?.full_name || 'Message'}`, {
              body: msg.content,
              icon: sender?.photo_url || undefined,
              tag: `msg-${msg.from_id}`, // replaces previous notif from same sender
            })
          }
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [coach?.id])

  function dismissToast(id) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  function clearUnread() {
    setUnread(0)
  }

  function decrementUnread(n = 1) {
    setUnread(prev => Math.max(0, prev - n))
  }

  return (
    <Ctx.Provider value={{ toasts, unread, dismissToast, clearUnread, decrementUnread }}>
      {children}
    </Ctx.Provider>
  )
}

export const useNotifications = () => useContext(Ctx)
