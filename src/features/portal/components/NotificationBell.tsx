'use client';
import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
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

function isSafeInternalHref(href: string | null | undefined): href is string {
  return typeof href === 'string' && href.startsWith('/') && !href.startsWith('//');
}

export default function NotificationBell({ notifications, unreadCount }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

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
        type="button"
        onClick={() => setIsOpen(v => !v)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute top-2 right-2 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-black rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} aria-hidden="true" />

          {/* Panel — 360px safe fixed bounds on mobile, right-anchored w-80 on sm+ */}
          <div
            role="dialog"
            aria-label="Notifications"
            className="fixed inset-x-4 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 z-50 sm:w-80 max-h-96 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-bold text-foreground">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={isPending}
                    className="min-h-6 px-2 rounded-md text-xs text-primary font-semibold inline-flex items-center gap-1 hover:text-primary/80 hover:bg-secondary/60 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" /> Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close notifications"
                  className="min-h-9 min-w-9 flex items-center justify-center p-1 rounded-lg hover:bg-secondary text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Notification list */}
            <div className="overflow-y-auto flex-1">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" aria-hidden="true" />
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map(n => {
                    const rowClassName = cn(
                      'flex items-start gap-3 px-4 py-3 transition-colors',
                      !n.readAt ? 'bg-primary/5' : 'hover:bg-secondary/40',
                      isSafeInternalHref(n.href) && 'hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary'
                    );
                    const content = (
                      <>
                        <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5', getIconColor(n.type))} aria-hidden="true">
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
                        {!n.readAt && <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" aria-hidden="true" />}
                      </>
                    );

                    if (isSafeInternalHref(n.href)) {
                      return (
                        <Link
                          key={n.id}
                          href={n.href}
                          onClick={() => setIsOpen(false)}
                          className={rowClassName}
                        >
                          {content}
                        </Link>
                      );
                    }

                    return (
                      <div key={n.id} className={rowClassName}>
                        {content}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
