'use client';
import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { useState, useRef, useEffect } from 'react';
import { Search, Bell, Menu, LogOut, ChevronDown, Loader2, Sun, Cloud, Moon, CircleHelp } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
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
    // D9 (Milestone 3M): FRONT_DESK was missing, causing raw "FRONT_DESK" to appear in the UI.
    FRONT_DESK: 'Front Desk',
    TUTOR: 'Club Leader',
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

    const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('dark');
    const [themeMounted, setThemeMounted] = useState(false);

    useEffect(() => {
        setThemeMounted(true);
        const savedTheme = localStorage.getItem('theme') as 'system' | 'light' | 'dark' | null;
        if (savedTheme) {
            setTheme(savedTheme);
        }
    }, []);

    useEffect(() => {
        if (!themeMounted) return;

        const applyTheme = () => {
            const root = document.documentElement;
            if (theme === 'system') {
                const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (systemPrefersDark) {
                    root.classList.add('dark');
                    root.classList.remove('light');
                } else {
                    root.classList.add('light');
                    root.classList.remove('dark');
                }
            } else if (theme === 'light') {
                root.classList.add('light');
                root.classList.remove('dark');
            } else if (theme === 'dark') {
                root.classList.add('dark');
                root.classList.remove('light');
            }
        };

        applyTheme();
        localStorage.setItem('theme', theme);

        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = () => applyTheme();
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    }, [theme, themeMounted]);

    const toggleTheme = () => {
        setTheme(prev => {
            if (prev === 'system') return 'light';
            if (prev === 'light') return 'dark';
            return 'system';
        });
    };

    const [showNotifications, setShowNotifications] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const notificationRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const router = useRouter();
    const pathname = usePathname();

    // Check if the current page is a dashboard list view to merge page elements to global header
    const isListPage = pathname.startsWith('/dashboard/registrations') ||
                       pathname.startsWith('/dashboard/bookings') ||
                       pathname.startsWith('/dashboard/students') ||
                       pathname.startsWith('/dashboard/attendance') ||
                       pathname.startsWith('/dashboard/parents') ||
                       pathname.startsWith('/dashboard/centres') ||
                       pathname.startsWith('/dashboard/staff');

    // Fetch real notifications from API
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

    const fetchNotifications = async () => {
        setIsLoadingNotifications(true);
        try {
            const res = await fetch('/api/notifications');
            if (res.ok) {
                const data = await res.json();
                setNotifications(data.notifications || []);
            }
        } catch (error) {
            logger.error('Failed to fetch notifications:', error);
        } finally {
            setIsLoadingNotifications(false);
        }
    };

    useEffect(() => {
        if (showNotifications && notifications.length === 0) {
            fetchNotifications();
        }
    }, [showNotifications, notifications.length]);

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.read) {
            try {
                await fetch('/api/notifications', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notificationId: notification.id }),
                });
                setNotifications(notifications.map(n =>
                    n.id === notification.id ? { ...n, read: true } : n
                ));
            } catch (error) {
                logger.error('Failed to mark notification as read:', error);
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
            setNotifications(notifications.map(n => ({ ...n, read: true })));
        } catch (error) {
            logger.error('Failed to mark all as read:', error);
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
                logger.error('Search failed:', error);
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

    // Close panels on outside click
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
            router.push(`/dashboard/bookings?search=${encodeURIComponent(searchQuery)}`);
        }
    };

    return (
        <header className={`h-14 fixed top-0 right-0 z-40 px-4 lg:px-6 flex items-center gap-3 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 ${
            collapsed ? 'left-0 lg:left-[72px]' : 'left-0 lg:left-60'
        }`}>

            {/* Hamburger — mobile only */}
            <button
                suppressHydrationWarning
                className="lg:hidden rounded-md hover:bg-page text-text-muted transition-colors flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                onClick={() => setCollapsed(false)}
                aria-label="Open menu"
            >
                <Menu className="size-5" />
            </button>

            {/* Title Portal Insertion — list pages render their own heading here;
                other pages carry no header-left content (greeting now lives only
                in DashboardHero, not duplicated in the top bar). */}
            {isListPage && (
                <div id="header-left" className="flex items-center gap-2 flex-shrink-0" />
            )}

            {/* Middle Section: Tabs Portal or Global Search */}
            {isListPage ? (
                <div id="header-middle" className="hidden lg:flex flex-1 justify-center max-w-2xl px-4" />
            ) : (
                /* Search Bar */
                !hideSearch && (
                    <div className="hidden sm:block flex-1 max-w-xl relative" ref={searchContainerRef}>
                        <form onSubmit={handleSearch} className="relative group w-full flex items-center h-10 bg-page border border-border rounded-md transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
                            <Search className="ml-3.5 w-4 h-4 text-text-muted flex-shrink-0 transition-colors group-focus-within:text-accent pointer-events-none" />
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
                                placeholder="Search students, bookings…"
                                className="flex-1 h-full bg-transparent px-3 py-0 text-sm text-text placeholder:text-text-muted/60 outline-none"
                            />
                            {isSearching && (
                                <Loader2 className="mr-4 w-4 h-4 text-text-muted animate-spin flex-shrink-0" />
                            )}
                            {!searchQuery && !isSearching && (
                                <div className="mr-3 flex items-center gap-1 pointer-events-none opacity-40 flex-shrink-0">
                                    <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded border border-border text-text-muted font-mono">⌘</span>
                                    <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded border border-border text-text-muted font-mono">K</span>
                                </div>
                            )}
                        </form>

                        {/* Search Results Dropdown */}
                        {showSearchResults && searchQuery.trim().length >= 2 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-surface-elevated rounded-md shadow-[var(--shadow-popover)] border border-border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                {searchResults.length === 0 && !isSearching ? (
                                    <div className="p-6 text-center">
                                        <p className="text-2xl mb-2">🔍</p>
                                        <p className="text-sm text-text-muted">No results for &ldquo;<span className="text-text font-semibold">{searchQuery}</span>&rdquo;</p>
                                    </div>
                                ) : (
                                    <div className="max-h-96 overflow-y-auto">
                                        {searchResults.map((result) => (
                                            // A11Y-2 (Milestone 3N): button element for keyboard
                                            // accessibility — was a non-interactive div with onClick.
                                            <button
                                                key={`${result.type}-${result.id}`}
                                                type="button"
                                                onClick={() => {
                                                    router.push(result.url);
                                                    setShowSearchResults(false);
                                                    setSearchQuery('');
                                                }}
                                                className="w-full text-left p-3 border-b border-border hover:bg-page cursor-pointer transition-colors flex items-center justify-between group"
                                            >
                                                <div>
                                                    <p className="font-semibold text-sm text-text group-hover:text-accent transition-colors">
                                                        {result.title}
                                                    </p>
                                                    <p className="text-xs text-text-muted mt-0.5">
                                                        {result.subtitle}
                                                    </p>
                                                </div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-text-muted">
                                                    {result.type}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            )}

            <div className="ml-auto flex items-center gap-2">
                {isListPage && (
                    <div id="header-right-actions" className="hidden md:flex items-center gap-2" />
                )}
                {/* Theme Toggle */}
                <button
                    suppressHydrationWarning
                    onClick={toggleTheme}
                    className="keep-shape size-9 rounded-md hover:bg-page text-text-muted hover:text-text transition-colors flex items-center justify-center flex-shrink-0"
                    aria-label={`Toggle theme (currently ${theme})`}
                >
                    {theme === 'system' && <Cloud className="size-4" />}
                    {theme === 'light' && <Sun className="size-4" />}
                    {theme === 'dark' && <Moon className="size-4" />}
                </button>

                {/* Notifications */}
                <div className="relative" ref={notificationRef}>
                    <button
                        suppressHydrationWarning
                        onClick={() => setShowNotifications(!showNotifications)}
                        aria-expanded={showNotifications}
                        aria-haspopup="menu"
                        aria-controls="notifications-menu"
                        className="keep-shape size-9 rounded-md hover:bg-page text-text-muted hover:text-text relative transition-colors flex items-center justify-center flex-shrink-0"
                        aria-label="Notifications"
                    >
                        <Bell className="size-4" />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2 flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 border border-header" />
                            </span>
                        )}
                    </button>

                    {showNotifications && (
                        <div
                            id="notifications-menu"
                            role="menu"
                            className="absolute right-0 mt-2 w-80 bg-surface-elevated rounded-md shadow-[var(--shadow-popover)] border border-border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200"
                        >
                            <div className="p-4 border-b border-border flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-text">Notifications</h3>
                                    {unreadCount > 0 && (
                                        <p className="text-xs text-text-muted mt-0.5">
                                            {unreadCount} unread message{unreadCount !== 1 ? 's' : ''}
                                        </p>
                                    )}
                                </div>
                                {unreadCount > 0 && (
                                    <span className="text-xs font-bold bg-red-500/15 text-red-500 px-2 py-0.5 rounded-full border border-red-500/20">
                                        {unreadCount} new
                                    </span>
                                )}
                            </div>
                            <div className="max-h-96 overflow-y-auto">
                                {isLoadingNotifications ? (
                                    <div className="p-8 text-center">
                                        <Loader2 className="w-6 h-6 animate-spin text-text-muted mx-auto mb-2" />
                                        <p className="text-sm text-text-muted">Loading…</p>
                                    </div>
                                ) : notifications.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <div className="text-3xl mb-3">🔔</div>
                                        <p className="font-semibold text-text mb-1">All caught up!</p>
                                        <p className="text-sm text-text-muted">No notifications yet</p>
                                    </div>
                                ) : (
                                    notifications.map((notification) => (
                                        // A11Y-3 (Milestone 3N): button element for keyboard
                                        // accessibility — was a non-interactive div with onClick.
                                        <button
                                            key={notification.id}
                                            type="button"
                                            onClick={() => handleNotificationClick(notification)}
                                            className={`w-full text-left p-4 border-b border-border hover:bg-page cursor-pointer transition-colors ${!notification.read ? 'bg-accent-soft' : ''}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                {!notification.read && (
                                                    <div className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm text-text">
                                                        {notification.title}
                                                    </p>
                                                    <p className="text-sm text-text/80 mt-1">
                                                        {notification.message}
                                                    </p>
                                                    <p className="text-xs text-text-muted mt-2">
                                                        {notification.time}
                                                    </p>
                                                </div>
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                            <div className="p-3 border-t border-border bg-page">
                                <button
                                    suppressHydrationWarning
                                    onClick={handleMarkAllAsRead}
                                    className="text-xs font-semibold text-accent hover:text-accent/80 w-full text-center transition-colors"
                                >
                                    Mark all as read
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="h-6 w-px bg-border" />

                {/* User Profile Dropdown */}
                <div className="relative" ref={userMenuRef}>
                    <button
                        suppressHydrationWarning
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        aria-expanded={showUserMenu}
                        aria-haspopup="menu"
                        aria-controls="user-profile-menu"
                        className="keep-shape flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-page transition-colors group"
                        aria-label="User menu"
                    >
                        <div className="text-right hidden sm:block min-w-0">
                            <p className="text-sm font-medium text-text leading-tight truncate">
                                {userName || 'Admin User'}
                            </p>
                            <p className="text-xs text-text-muted mt-0.5">{userRole ? (ROLE_LABELS[userRole] ?? userRole) : 'Admin'}</p>
                        </div>
                        <div className="size-9 rounded-full bg-accent-soft flex items-center justify-center text-accent font-semibold text-sm tracking-tight flex-shrink-0 ring-2 ring-border group-hover:ring-accent/40 transition-colors">
                            {userInitial || 'A'}
                        </div>
                        <ChevronDown className={`size-4 text-text-muted transition-transform duration-200 hidden sm:block ${showUserMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showUserMenu && (
                        <div
                            id="user-profile-menu"
                            role="menu"
                            className="absolute right-0 mt-2 w-56 bg-surface-elevated rounded-md shadow-[var(--shadow-popover)] border border-border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150"
                        >
                            <div className="p-4 border-b border-border">
                                <p className="font-bold text-text text-sm truncate">{userName || 'Admin User'}</p>
                                <span className="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent-soft text-accent border border-transparent">
                                    {userRole ? (ROLE_LABELS[userRole] ?? userRole) : 'Admin'}
                                </span>
                            </div>
                            <div className="p-2">
                                <Link
                                    href="/dashboard/help"
                                    onClick={() => setShowUserMenu(false)}
                                    className="w-full flex items-center gap-3 px-3 py-2 rounded-sm text-text-secondary hover:text-text hover:bg-page transition-colors text-sm font-medium mb-1"
                                    role="menuitem"
                                >
                                    <CircleHelp className="w-4 h-4 text-text-muted" />
                                    Help & Training
                                </Link>
                                <div className="h-px bg-border-subtle my-1" />
                                <button
                                    suppressHydrationWarning
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-danger hover:bg-danger-soft transition-colors text-sm font-medium group"
                                    role="menuitem"
                                >
                                    <LogOut className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
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
