import { useEffect } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { useNotificationStore } from '@/hooks/useNotification'

const typeStyles: Record<string, string> = {
  success: 'border-green-500/40 bg-green-500/10 text-green-500',
  error: 'border-red-500/40 bg-red-500/10 text-red-500',
  warning: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-500',
  info: 'border-blue-500/40 bg-blue-500/10 text-blue-500',
}

export function NotificationContainer() {
  const notifications = useNotificationStore((s) => s.notifications)
  const remove = useNotificationStore((s) => s.remove)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && notifications.length > 0) {
        remove(notifications[notifications.length - 1].id)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [notifications, remove])

  if (notifications.length === 0) return null

  return (
    <div className="fixed right-4 top-4 z-[60] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {notifications.map((notification) => (
        <Alert
          key={notification.id}
          className={cn('shadow-lg backdrop-blur', typeStyles[notification.type])}
        >
          <AlertDescription>{notification.message}</AlertDescription>
        </Alert>
      ))}
    </div>
  )
}
