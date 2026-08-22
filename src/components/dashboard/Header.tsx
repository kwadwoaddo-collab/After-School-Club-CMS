'use client';
import { logger } from '@/lib/logger';
/* eslint-disable @typescript-eslint/no-explicit-any */


import { useState, useRef, useEffect } from 'react';
import { Search, Bell, Menu, LogOut, ChevronDown, Loader2, Sun, Cloud, Moon } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
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
    TUTOR: 'Club Leader',
    STAFF: 'Staff',
};

function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return { text: 'Good morning', emoji: '☀️' };
    if (hour < 17) return { text: 'Good afternoon', emoji: '🌤️' };
    return { text: 'Good evening', emoji: '🌙' };
}

export default function Header({ userName, userInitial, userRole, hideSearch }: HeaderProps) {
    const { collapsed, setCollapsed } = useSidebar();
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
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
                       pathname.startsWith('/dashboard/students');

    // Scroll-based blur backdrop
    const [isScrolled, setIsScrolled] = useState(false);
    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 10);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Greeting - computed once on first render, no flash
    const [greeting] = useState(() => getGreeting());

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
                setIsSearchFocused(false);
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
        <header className={`h-16 sm:h-20 fixed top-0 right-0 z-40 px-4 sm:px-8 flex items-center justify-between gap-4 border-b border-border bg-surface/90 backdrop-blur-md transition-shadow duration-200 ${
            isScrolled ? 'shadow-sm' : ''
        } ${collapsed ? 'left-0 lg:left-20' : 'left-0 lg:left-64'}`}>

            {/* Spotlight-Style Search Focus Backdrop Overlay */}
            {isSearchFocused && (
                <div className="fixed inset-0 bg-black/15 dark:bg-black/40 backdrop-blur-[1.5px] z-[-1] pointer-events-none animate-in fade-in duration-200" />
            )}

            {/* Hamburger — mobile only */}
            <button
                suppressHydrationWarning
                className="lg:hidden p-2 rounded-sm hover:bg-page text-text-muted transition-colors flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
                onClick={() => setCollapsed(false)}
                aria-label="Open menu"
            >
                <Menu className="w-5 h-5" />
            </button>

            {/* Title / Greeting Portal Insertion */}
            {isListPage ? (
                <div id="header-left" className="flex items-center gap-2 flex-shrink-0" />
            ) : (
                <>
                    {/* Greeting — hidden on mobile, hidden when search is focused */}
                    {!hideSearch && (
                        <div className="hidden lg:flex items-center gap-2 flex-shrink-0 ml-1">
                            <span className="text-lg leading-none">{greeting.emoji}</span>
                            <span className="text-sm font-semibold text-text/80">
                                {greeting.text}{userName ? `, ${userName.split(' ')[0]}` : ''}
                            </span>
                        </div>
                    )}
                </>
            )}

            {/* Middle Section: Tabs Portal or Global Search */}
            {isListPage ? (
                <div id="header-middle" className="hidden lg:flex flex-1 justify-center max-w-2xl px-4" />
            ) : (
                /* Search Bar */
                !hideSearch && (
                    <div className="hidden sm:block flex-1 max-w-xl relative" ref={searchContainerRef}>
                        <form onSubmit={handleSearch} className="relative group w-full flex items-center h-10 bg-page border border-border/60 rounded-md transition-all duration-200 hover:border-accent/40  focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
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
                                    setIsSearchFocused(true);
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
                                            <div
                                                key={`${result.type}-${result.id}`}
                                                onClick={() => {
                                                    router.push(result.url);
                                                    setShowSearchResults(false);
                                                    setSearchQuery('');
                                                }}
                                                className="p-3 border-b border-border hover:bg-page cursor-pointer transition-colors flex items-center justify-between group"
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
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            )}

            <div className="flex items-center gap-3">
                {isListPage && (
                    <div id="header-right-actions" className="hidden md:flex items-center gap-2" />
                )}
                {/* Theme Toggle */}
                <button
                    suppressHydrationWarning
                    onClick={toggleTheme}
                    className="keep-shape p-2.5 rounded-sm hover:bg-page text-text-muted hover:text-text transition-transform duration-200 flex items-center justify-center"
                    aria-label={`Toggle theme (currently ${theme})`}
                >
                    {theme === 'system' && <Cloud className="w-5 h-5" />}
                    {theme === 'light' && <Sun className="w-5 h-5" />}
                    {theme === 'dark' && <Moon className="w-5 h-5" />}
                </button>

                {/* Notifications */}
                <div className="relative" ref={notificationRef}>
                    <button
                        suppressHydrationWarning
                        onClick={() => setShowNotifications(!showNotifications)}
                        aria-expanded={showNotifications}
                        aria-haspopup="menu"
                        aria-controls="notifications-menu"
                        className="keep-shape p-2.5 rounded-sm hover:bg-page text-text-muted hover:text-text relative transition-all duration-200"
                        aria-label="Notifications"
                    >
                        <Bell className="w-5 h-5" />
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
                                        <div
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={`p-4 border-b border-border hover:bg-page cursor-pointer transition-colors ${!notification.read ? 'bg-accent-soft' : ''}`}
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
                                        </div>
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
                <div className="h-8 w-px bg-border/60" />

                {/* User Profile Dropdown */}
                <div className="relative" ref={userMenuRef}>
                    <button
                        suppressHydrationWarning
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        aria-expanded={showUserMenu}
                        aria-haspopup="menu"
                        aria-controls="user-profile-menu"
                        className="keep-shape flex items-center gap-3.5 px-3 py-1.5 rounded-sm hover:bg-page transition-all duration-200 mr-2 group"
                        aria-label="User menu"
                    >
                        <div className="text-right hidden sm:block min-w-0">
                            <p className="text-sm font-bold text-text leading-tight truncate">
                                {userName || 'Admin User'}
                            </p>
                            <p className="text-[10px] font-medium text-text-muted mt-0.5">{userRole ? (ROLE_LABELS[userRole] ?? userRole) : 'Admin'}</p>
                        </div>
                        <div className="w-9 h-9 rounded-sm bg-accent-soft flex items-center justify-center text-accent font-semibold text-sm tracking-tight flex-shrink-0 ring-2 ring-border group-hover:ring-accent/40 transition-colors">
                            {userInitial || 'A'}
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-text-muted transition-transform duration-200 hidden sm:block ${showUserMenu ? 'rotate-180' : ''}`} />
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
                                <button
                                    suppressHydrationWarning
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-sm text-red-500 hover:bg-red-500/10 transition-colors text-sm font-semibold group"
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
