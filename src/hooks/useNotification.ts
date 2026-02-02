import { useMemo } from 'react'
import { create } from 'zustand'

type NotificationType = 'success' | 'error' | 'warning' | 'info'

export interface NotificationItem {
  id: string
  message: string
  type: NotificationType
}

interface NotificationState {
  notifications: NotificationItem[]
  push: (type: NotificationType, message: string) => void
  remove: (id: string) => void
}

const AUTO_DISMISS_MS = 3000
let notificationCounter = 0

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  push: (type, message) => {
    const id = `${Date.now()}-${notificationCounter++}`
    set((state) => ({
      notifications: [...state.notifications, { id, type, message }],
    }))

    window.setTimeout(() => {
      get().remove(id)
    }, AUTO_DISMISS_MS)
  },
  remove: (id) => set((state) => ({
    notifications: state.notifications.filter((notification) => notification.id !== id),
  })),
}))

export function useNotification() {
  const push = useNotificationStore((s) => s.push)

  return useMemo(() => ({
    success: (msg: string) => push('success', msg),
    error: (msg: string) => push('error', msg),
    warning: (msg: string) => push('warning', msg),
    info: (msg: string) => push('info', msg),
  }), [push])
}
