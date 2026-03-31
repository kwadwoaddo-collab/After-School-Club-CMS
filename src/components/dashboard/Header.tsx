'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, Bell, Menu, LogOut, ChevronDown, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
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
    const { collapsed, setCollapsed } = useSidebar();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);

    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);
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

    // Keyboard shortcut for Cmd+K or Ctrl+K
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Debounced search
    useEffect(() => {
        const fetchResults = async () => {
            if (searchQuery.trim().length < 2) {
                setSearchResults([]);
                return;
            }
            setIsSearching(true);
            try {
                const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
                if (res.ok) {
                    const data = await res.json();
                    setSearchResults(data.results || []);
                }
            } catch (error) {
                console.error('Search failed:', error);
            } finally {
                setIsSearching(false);
            }
        };

        const timer = setTimeout(() => {
            if (searchQuery) fetchResults();
            else setSearchResults([]);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery]);

    // Close notifications and search when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
                setShowNotifications(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
            if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
                setShowSearchResults(false);
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
        <header className={`h-16 sm:h-20 bg-[#0f1115]/80 backdrop-blur-xl fixed top-0 right-0 z-40 px-4 sm:px-8 flex items-center justify-between gap-4 border-b border-[#424754]/15 transition-all duration-300 ${collapsed ? 'left-0 md:left-20' : 'left-0 md:left-64'
            }`}>
            {/* Hamburger — mobile only */}
            <button
                suppressHydrationWarning
                className="md:hidden p-2 rounded-xl hover:bg-[#1a1d23] text-[#8c909f] transition-colors flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                onClick={() => setCollapsed(false)}
                aria-label="Open menu"
            >
                <Menu className="w-5 h-5" />
            </button>

            {/* Search Bar — hidden on mobile */}
            {!hideSearch && (
                <div className="hidden sm:block flex-1 max-w-xl relative" ref={searchContainerRef}>
                    <form onSubmit={handleSearch} className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c909f] group-focus-within:text-[#adc6ff] transition-colors" />
                        <input
                            suppressHydrationWarning
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setShowSearchResults(true);
                            }}
                            onFocus={() => {
                                if (searchQuery.trim().length >= 2) setShowSearchResults(true);
                            }}
                            placeholder="Search students, bookings (Cmd + K)"
                            className="w-full pl-11 pr-4 py-2.5 bg-[#1a1d23] border border-[#424754]/15 rounded-[12px] text-sm text-[#e5e2e1] placeholder:text-[#8c909f] focus:ring-2 focus:ring-[#4d8eff]/30 transition-all outline-none"
                        />
                        {isSearching && (
                            <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c909f] animate-spin" />
                        )}
                        {/* Keyboard shortcut hint overlay for inactive state */}
                        {!searchQuery && !isSearching && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none opacity-50">
                                <span className="text-xs bg-[#2a2d35] px-1.5 py-0.5 rounded border border-[#424754] text-[#8c909f]">⌘</span>
                                <span className="text-xs bg-[#2a2d35] px-1.5 py-0.5 rounded border border-[#424754] text-[#8c909f]">K</span>
                            </div>
                        )}
                    </form>

                    {/* Search Results Dropdown */}
                    {showSearchResults && searchQuery.trim().length >= 2 && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1d23] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-[#424754]/15 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            {searchResults.length === 0 && !isSearching ? (
                                <div className="p-4 text-center text-sm text-[#8c909f]">
                                    No results found for "{searchQuery}"
                                </div>
                            ) : (
                                <div className="max-h-96 overflow-y-auto">
                                    {searchResults.map((result) => (
                                        <div
                                            key={`${result.type}-${result.id}`}
                                            onClick={() => {
                                                router.push(result.url);
                                                setShowSearchResults(false);
                                                setSearchQuery('');
                                            }}
                                            className="p-3 border-b border-[#424754]/15 hover:bg-[#353535] cursor-pointer transition-colors flex items-center justify-between group"
                                        >
                                            <div>
                                                <p className="font-semibold text-sm text-[#e5e2e1] group-hover:text-[#adc6ff] transition-colors">
                                                    {result.title}
                                                </p>
                                                <p className="text-xs text-[#8c909f] mt-0.5">
                                                    {result.subtitle}
                                                </p>
                                            </div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#424754]/30 text-[#8c909f]">
                                                {result.type}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Right Section: Notifications & User */}
            <div className="flex items-center gap-4">
                {/* Notifications */}
                <div className="relative" ref={notificationRef}>
                    <button
                        suppressHydrationWarning
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="p-2.5 rounded-xl hover:bg-[#1a1d23] text-[#8c909f] relative transition-colors"
                        aria-label="Notifications"
                    >
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2 w-2 h-2 bg-[#f66018] rounded-full border-2 border-[#0f1115]">
                            </span>
                        )}
                    </button>

                    {/* Notifications Dropdown */}
                    {showNotifications && (
                        <div className="absolute right-0 mt-2 w-80 bg-[#1a1d23] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-[#424754]/15 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="p-4 border-b border-[#424754]/15">
                                <h3 className="font-bold text-[#e5e2e1]">Notifications</h3>
                                {unreadCount > 0 && (
                                    <p className="text-xs text-[#8c909f] mt-1">
                                        You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                                    </p>
                                )}
                            </div>
                            <div className="max-h-96 overflow-y-auto">
                                {isLoadingNotifications ? (
                                    <div className="p-8 text-center">
                                        <p className="text-sm text-[#8c909f]">Loading notifications...</p>
                                    </div>
                                ) : notifications.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <Bell className="w-12 h-12 text-[#424754] mx-auto mb-2" />
                                        <p className="text-sm text-[#8c909f]">No notifications yet</p>
                                    </div>
                                ) : (
                                    notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={`p-4 border-b border-[#424754]/15 hover:bg-[#353535] cursor-pointer transition-colors ${!notification.read ? 'bg-[#adc6ff]/10' : ''
                                                }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                {!notification.read && (
                                                    <div className="w-2 h-2 bg-[#adc6ff] shadow-[0_0_8px_rgba(173,198,255,0.6)] rounded-full mt-2 flex-shrink-0" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm text-[#e5e2e1]">
                                                        {notification.title}
                                                    </p>
                                                    <p className="text-sm text-[#c2c6d6] mt-1">
                                                        {notification.message}
                                                    </p>
                                                    <p className="text-xs text-[#8c909f] mt-2">
                                                        {notification.time}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="p-3 border-t border-[#424754]/15 bg-[#1a1d23]">
                                <button
                                    suppressHydrationWarning
                                    onClick={handleMarkAllAsRead}
                                    className="text-xs font-semibold text-[#adc6ff] hover:text-[#4d8eff] w-full text-center"
                                >
                                    Mark all as read
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="h-8 w-[1px] bg-[#424754]/30 mx-2" />

                {/* User Profile Dropdown */}
                <div className="relative" ref={userMenuRef}>
                    <button
                        suppressHydrationWarning
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        className="flex items-center gap-3 pl-2 rounded-xl hover:bg-[#20201f] pr-2 py-1.5 transition-colors"
                        aria-label="User menu"
                    >
                        <div className="text-right hidden sm:block">
                            <p className="text-sm font-bold text-[#e5e2e1] leading-none">
                                {userName || 'Admin User'}
                            </p>
                            <p className="text-xs font-medium text-[#8c909f] mt-1">{userRole ? (ROLE_LABELS[userRole] ?? userRole) : 'Admin'}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-[#adc6ff]/10 border border-[#adc6ff]/20 flex items-center justify-center text-[#adc6ff] font-bold flex-shrink-0">
                            {userInitial || 'A'}
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-[#8c909f] transition-transform duration-200 hidden sm:block ${showUserMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {/* User Dropdown */}
                    {showUserMenu && (
                        <div className="absolute right-0 mt-2 w-56 bg-[#2a2a2a] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] border border-[#424754]/15 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="p-4 border-b border-[#424754]/15">
                                <p className="font-bold text-[#e5e2e1] text-sm truncate">{userName || 'Admin User'}</p>
                                <span className="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#adc6ff]/10 text-[#adc6ff]">
                                    {userRole ? (ROLE_LABELS[userRole] ?? userRole) : 'Admin'}
                                </span>
                            </div>
                            <div className="p-2">
                                <button
                                    suppressHydrationWarning
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[#ffb4ab] hover:bg-[#93000a]/20 transition-colors text-sm font-semibold"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
