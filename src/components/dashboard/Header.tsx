'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Bell, User, Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useSidebar } from './SidebarContext';
interface HeaderProps {
    userName?: string;
    userInitial?: string;
    userRole?: string;
    hideSearch?: boolean;
}

interface Notification {
    id: string;
    title: string;
    message: string;
    time: string;
    read: boolean;
}

const ROLE_LABELS: Record<string, string> = {
    ORG_OWNER: 'Owner',
    ADMIN: 'Admin',
    MANAGER: 'Manager',
    TUTOR: 'Tutor',
    STAFF: 'Staff',
};

export default function Header({ userName, userInitial, userRole, hideSearch }: HeaderProps) {
    const { setCollapsed } = useSidebar();
    const [searchQuery, setSearchQuery] = useState('');
    const [showNotifications, setShowNotifications] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Fetch real notifications from API
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

    // Fetch notifications on mount and when notifications panel opens
    useEffect(() => {
        if (showNotifications && notifications.length === 0) {
            fetchNotifications();
        }
    }, [showNotifications]);

    const fetchNotifications = async () => {
        setIsLoadingNotifications(true);
        try {
            const res = await fetch('/api/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setIsLoadingNotifications(false);
        }
    };

    const handleNotificationClick = async (notification: Notification) => {
        // Mark as read if unread
        if (!notification.read) {
            try {
                await fetch('/api/notifications', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notificationId: notification.id }),
                });

                // Update local state
                setNotifications(notifications.map(n =>
                    n.id === notification.id ? { ...n, read: true } : n
                ));
            } catch (error) {
                console.error('Failed to mark notification as read:', error);
            }
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ markAllAsRead: true }),
            });

            // Update local state
            setNotifications(notifications.map(n => ({ ...n, read: true })));
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;

    // Close notifications when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
        }

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            // Navigate to search results or filter current page
            router.push(`/dashboard/bookings?search=${encodeURIComponent(searchQuery)}`);
        }
    };

    return (
        <header className="h-16 sm:h-20 glass-panel sticky top-0 z-40 px-4 sm:px-8 flex items-center justify-between gap-4 border-b border-slate-200/50">
            {/* Hamburger — mobile only */}
            <button
                className="lg:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors flex-shrink-0"
                onClick={() => setCollapsed(false)}
                aria-label="Open menu"
            >
                <Menu className="w-5 h-5" />
            </button>

            {/* Search Bar — hidden on mobile */}
            {!hideSearch && (
                <div className="hidden sm:block flex-1 max-w-xl">
                    <form onSubmit={handleSearch} className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search students, bookings (Cmd + K)"
                            className="w-full pl-11 pr-4 py-2.5 bg-slate-100/50 border-none rounded-2xl text-sm text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                        />
                    </form>
                </div>
            )}

            {/* Right Section: Notifications & User */}
            <div className="flex items-center gap-4">
                {/* Notifications */}
                <div className="relative" ref={notificationRef}>
                    <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-500 relative transition-colors"
                        aria-label="Notifications"
                    >
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white">
                            </span>
                        )}
                    </button>

                    {/* Notifications Dropdown */}
                    {showNotifications && (
                        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="p-4 border-b border-slate-100">
                                <h3 className="font-bold text-slate-900">Notifications</h3>
                                {unreadCount > 0 && (
                                    <p className="text-xs text-slate-500 mt-1">
                                        You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                                    </p>
                                )}
                            </div>
                            <div className="max-h-96 overflow-y-auto">
                                {isLoadingNotifications ? (
                                    <div className="p-8 text-center">
                                        <p className="text-sm text-slate-500">Loading notifications...</p>
                                    </div>
                                ) : notifications.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <Bell className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                                        <p className="text-sm text-slate-500">No notifications yet</p>
                                    </div>
                                ) : (
                                    notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={`p-4 border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors ${!notification.read ? 'bg-blue-50/50' : ''
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                {!notification.read && (
                                                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm text-slate-900">
                                                        {notification.title}
                                                    </p>
                                                    <p className="text-sm text-slate-600 mt-1">
                                                        {notification.message}
                                                    </p>
                                                    <p className="text-xs text-slate-400 mt-2">
                                                        {notification.time}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="p-3 border-t border-slate-100 bg-slate-50">
                                <button
                                    onClick={handleMarkAllAsRead}
                                    className="text-xs font-semibold text-primary hover:text-blue-600 w-full text-center"
                                >
                                    Mark all as read
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="h-8 w-[1px] bg-slate-200 mx-2" />

                {/* User Profile */}
                <div className="flex items-center gap-3 pl-2">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-slate-900 leading-none">
                            {userName || 'Admin User'}
                        </p>
                        <p className="text-xs font-medium text-slate-500 mt-1">{userRole ? (ROLE_LABELS[userRole] ?? userRole) : 'Admin'}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold">
                        {userInitial || 'A'}
                    </div>
                </div>
            </div>
        </header>
    );
}
