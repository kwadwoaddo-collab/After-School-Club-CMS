import { logger } from '@/lib/logger';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db';
import { notifications } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';

export async function GET() {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        // Fetch notifications for the user
        const userNotifications = await db
            .select()
            .from(notifications)
            .where(eq(notifications.userId, session.user.id))
            .orderBy(desc(notifications.createdAt))
            .limit(20);

        // Format for the frontend
        const formatted = userNotifications.map((notif) => ({
            id: notif.id,
            title: notif.title,
            message: notif.message,
            time: formatTime(notif.createdAt),
            read: notif.isRead,
            type: notif.type,
            bookingId: notif.bookingId,
        }));

        const unreadCount = userNotifications.filter((n) => !n.isRead).length;

        return NextResponse.json({
            notifications: formatted,
            unreadCount,
        });
    } catch (error) {
        logger.error('[NOTIFICATIONS_GET]', error);
        return NextResponse.json(
            { error: 'Failed to fetch notifications' },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request) {
    try {
        const session = await auth();

        if (!session?.user?.id) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { notificationId, markAllAsRead } = body;

        if (markAllAsRead) {
            // Mark all notifications as read
            await db
                .update(notifications)
                .set({ isRead: true })
                .where(eq(notifications.userId, session.user.id));

            return NextResponse.json({ success: true });
        }

        if (notificationId) {
            // Mark specific notification as read
            await db
                .update(notifications)
                .set({ isRead: true })
                .where(
                    and(
                        eq(notifications.id, notificationId),
                        eq(notifications.userId, session.user.id)
                    )
                );

            return NextResponse.json({ success: true });
        }

        return NextResponse.json(
            { error: 'Invalid request' },
            { status: 400 }
        );
    } catch (error) {
        logger.error('[NOTIFICATIONS_PATCH]', error);
        return NextResponse.json(
            { error: 'Failed to update notification' },
            { status: 500 }
        );
    }
}

// Helper function to format time
function formatTime(date: Date): string {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
    });
}
