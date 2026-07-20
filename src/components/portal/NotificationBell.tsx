'use client';
import { useState, useTransition } from 'react';
import { Bell, X, CheckCheck } from 'lucide-react';
import { cn } from '@/components/ui/utils';
import { markAllRead } from '@/app/portal/notifications/actions';
import { useRouter } from 'next/navigation';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  href: string | null;
  readAt: Date | null;
  createdAt: Date;
}

interface Props {
  notifications: Notification[];
  unreadCount: number;
}

export default function NotificationBell({ notifications, unreadCount }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleMarkAllRead = () => {
    startTransition(async () => {
      await markAllRead();
      router.refresh();
    });
  };

  const getIcon = (type: string) => {
    if (type.includes('approved') || type.includes('confirmed')) return '✓';
    if (type.includes('rejected') || type.includes('cancelled')) return '✕';
    if (type.includes('invoice')) return '£';
    return '•';
  };

  const getIconColor = (type: string) => {
    if (type.includes('approved') || type.includes('confirmed')) return 'bg-success/10 text-success';
    if (type.includes('rejected') || type.includes('cancelled')) return 'bg-destructive/10 text-destructive';
    if (type.includes('invoice') || type.includes('overdue')) return 'bg-warning/10 text-warning';
    return 'bg-secondary text-muted-foreground';
  };

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(v => !v)}
        className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-secondary transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-4 h-4 bg-destructive text-white text-[10px] font-black rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          {/* Panel */}
          <div className="absolute right-0 top-12 z-50 w-80 max-h-96 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-bold text-foreground">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button onClick={handleMarkAllRead} disabled={isPending}
                    className="text-xs text-primary font-semibold flex items-center gap-1 hover:text-primary/80 disabled:opacity-50">
                    <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                  </button>
                )}
                <button onClick={() => setIsOpen(false)}
                  className="p-1 rounded-lg hover:bg-secondary text-muted-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Notification list */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map(n => (
                    <div key={n.id}
                      className={cn('flex items-start gap-3 px-4 py-3 transition-colors',
                        !n.readAt ? 'bg-primary/5' : 'hover:bg-secondary/40'
                      )}>
                      <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5', getIconColor(n.type))}>
                        {getIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={cn('text-sm font-semibold', !n.readAt ? 'text-foreground' : 'text-muted-foreground')}>
                          {n.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-1">
                          {new Date(n.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {!n.readAt && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
