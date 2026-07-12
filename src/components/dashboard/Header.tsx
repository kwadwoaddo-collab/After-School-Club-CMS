'use client';

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
    const [isSearching, setIsSearching] = useState(false);
    const [showSearchResults, setShowSearchResults] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const searchContainerRef = useRef<HTMLDivElement>(null);

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

    // Greeting - computed once on client
    const [greeting, setGreeting] = useState({ text: 'Welcome', emoji: '✨' });
    useEffect(() => {
        setGreeting(getGreeting());
    }, []);

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
            console.error('Failed to fetch notifications:', error);
        } finally {
            setIsLoadingNotifications(false);
        }
    };

    useEffect(() => {
        if (showNotifications && notifications.length === 0) {
            fetchNotifications();
        }
    }, [showNotifications]);

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
        <header className={`h-16 sm:h-20 fixed top-0 right-0 z-40 px-4 sm:px-8 flex items-center justify-between gap-4 border-b transition-all duration-300 ${
            isScrolled
                ? 'bg-header/80 backdrop-blur-2xl border-border shadow-sm'
                : 'bg-header/45 backdrop-blur-xl border-border'
        } ${collapsed ? 'left-0 md:left-20' : 'left-0 md:left-64'}`}>

            {/* Hamburger — mobile only */}
            <button
                suppressHydrationWarning
                className="md:hidden p-2 rounded-xl hover:bg-secondary text-muted-foreground transition-colors flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
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
                            <span className="text-sm font-semibold text-foreground/80">
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
                        <form onSubmit={handleSearch} className="relative group w-full flex items-center h-10">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
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
                                placeholder="Search students, bookings… (⌘K)"
                                className="w-full h-10 pl-11 pr-16 py-0 bg-secondary/40 border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground/60 focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all outline-none hover:border-border/80"
                            />
                            {isSearching && (
                                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
                            )}
                            {!searchQuery && !isSearching && (
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none opacity-40">
                                    <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded border border-border text-muted-foreground font-mono">⌘</span>
                                    <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded border border-border text-muted-foreground font-mono">K</span>
                                </div>
                            )}
                        </form>

                        {/* Search Results Dropdown */}
                        {showSearchResults && searchQuery.trim().length >= 2 && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-popover/90 backdrop-blur-2xl rounded-2xl shadow-xl border border-border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                {searchResults.length === 0 && !isSearching ? (
                                    <div className="p-6 text-center">
                                        <p className="text-2xl mb-2">🔍</p>
                                        <p className="text-sm text-muted-foreground">No results for &ldquo;<span className="text-foreground font-semibold">{searchQuery}</span>&rdquo;</p>
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
                                                className="p-3 border-b border-border hover:bg-secondary/60 cursor-pointer transition-colors flex items-center justify-between group"
                                            >
                                                <div>
                                                    <p className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                                                        {result.title}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {result.subtitle}
                                                    </p>
                                                </div>
                                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
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
                {/* Notifications */}
                <div className="relative" ref={notificationRef}>
                    <button
                        suppressHydrationWarning
                        onClick={() => setShowNotifications(!showNotifications)}
                        className="p-2.5 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground relative transition-all duration-200"
                        aria-label="Notifications"
                    >
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border border-header badge-pulse" />
                        )}
                    </button>

                    {showNotifications && (
                        <div className="absolute right-0 mt-2 w-80 bg-popover/90 backdrop-blur-2xl rounded-2xl shadow-xl border border-border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="p-4 border-b border-border flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-foreground">Notifications</h3>
                                    {unreadCount > 0 && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
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
                                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground mx-auto mb-2" />
                                        <p className="text-sm text-muted-foreground">Loading…</p>
                                    </div>
                                ) : notifications.length === 0 ? (
                                    <div className="p-8 text-center">
                                        <div className="text-3xl mb-3">🔔</div>
                                        <p className="font-semibold text-foreground mb-1">All caught up!</p>
                                        <p className="text-sm text-muted-foreground">No notifications yet</p>
                                    </div>
                                ) : (
                                    notifications.map((notification) => (
                                        <div
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={`p-4 border-b border-border hover:bg-secondary/60 cursor-pointer transition-colors ${!notification.read ? 'bg-primary/5' : ''}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                {!notification.read && (
                                                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0 shadow-[0_0_8px_hsl(var(--primary))]" />
                                                )}
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm text-foreground">
                                                        {notification.title}
                                                    </p>
                                                    <p className="text-sm text-foreground/80 mt-1">
                                                        {notification.message}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-2">
                                                        {notification.time}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                            <div className="p-3 border-t border-border bg-secondary/20">
                                <button
                                    suppressHydrationWarning
                                    onClick={handleMarkAllAsRead}
                                    className="text-xs font-semibold text-primary hover:text-primary/80 w-full text-center transition-colors"
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
                        className="flex items-center gap-3.5 px-3 py-1.5 rounded-xl hover:bg-secondary transition-all duration-200 mr-2"
                        aria-label="User menu"
                    >
                        <div className="text-right hidden sm:block min-w-0">
                            <p className="text-sm font-bold text-foreground leading-tight truncate">
                                {userName || 'Admin User'}
                            </p>
                            <p className="text-[10px] font-medium text-muted-foreground mt-0.5">{userRole ? (ROLE_LABELS[userRole] ?? userRole) : 'Admin'}</p>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center text-primary font-bold flex-shrink-0 text-sm shadow-[0_0_12px_hsl(var(--primary)/0.12)]">
                            {userInitial || 'A'}
                        </div>
                        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 hidden sm:block ${showUserMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showUserMenu && (
                        <div className="absolute right-0 mt-2 w-56 bg-popover/90 backdrop-blur-2xl rounded-2xl shadow-xl border border-border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="p-4 border-b border-border">
                                <p className="font-bold text-foreground text-sm truncate">{userName || 'Admin User'}</p>
                                <span className="inline-block mt-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                                    {userRole ? (ROLE_LABELS[userRole] ?? userRole) : 'Admin'}
                                </span>
                            </div>
                            <div className="p-2">
                                <button
                                    suppressHydrationWarning
                                    onClick={() => signOut({ callbackUrl: '/login' })}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors text-sm font-semibold group"
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
