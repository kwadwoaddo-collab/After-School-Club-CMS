import { logger } from '@/lib/logger';
/**
 * In-App Notification Service
 * Creates notifications in the database for display in the dashboard
 */

import { db } from '@/db';
import { notifications } from '@/db/schema';

interface CreateNotificationParams {
    userId: string;
    organisationId: string;
    type: 'booking_created' | 'booking_cancelled' | 'booking_rescheduled' | 'assessment_reminder' | 'system';
    title: string;
    message: string;
    bookingId?: string;
}

export class InAppNotificationService {
    /**
     * Create a new notification
     */
    async createNotification(params: CreateNotificationParams): Promise<void> {
        try {
            await db.insert(notifications).values({
                userId: params.userId,
                organisationId: params.organisationId,
                type: params.type,
                title: params.title,
                message: params.message,
                bookingId: params.bookingId,
                isRead: false,
            });

            logger.info(`[InAppNotification] Created notification for user ${params.userId}: ${params.title}`);
        } catch (error) {
            logger.error('[InAppNotification] Failed to create notification:', error);
        }
    }

    /**
     * Create notification for new booking
     */
    async notifyBookingCreated(params: {
        userId: string;
        organisationId: string;
        bookingId: string;
        parentName: string;
        childName: string;
        startAt: Date;
    }): Promise<void> {
        await this.createNotification({
            userId: params.userId,
            organisationId: params.organisationId,
            type: 'booking_created',
            title: 'New Assessment Booked',
            message: `${params.parentName} has booked a new assessment for ${params.childName} on ${params.startAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`,
            bookingId: params.bookingId,
        });
    }

    /**
     * Create notification for cancelled booking
     */
    async notifyBookingCancelled(params: {
        userId: string;
        organisationId: string;
        bookingId: string;
        parentName: string;
        childName: string;
        startAt: Date;
    }): Promise<void> {
        await this.createNotification({
            userId: params.userId,
            organisationId: params.organisationId,
            type: 'booking_cancelled',
            title: 'Assessment Cancelled',
            message: `${params.parentName} cancelled the assessment for ${params.childName} scheduled for ${params.startAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`,
            bookingId: params.bookingId,
        });
    }

    /**
     * Create notification for rescheduled booking
     */
    async notifyBookingRescheduled(params: {
        userId: string;
        organisationId: string;
        bookingId: string;
        parentName: string;
        childName: string;
        newStartAt: Date;
    }): Promise<void> {
        await this.createNotification({
            userId: params.userId,
            organisationId: params.organisationId,
            type: 'booking_rescheduled',
            title: 'Assessment Rescheduled',
            message: `${params.parentName} rescheduled the assessment for ${params.childName} to ${params.newStartAt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`,
            bookingId: params.bookingId,
        });
    }

    /**
     * Create notification for assessment reminder
     */
    async notifyAssessmentReminder(params: {
        userId: string;
        organisationId: string;
        count: number;
    }): Promise<void> {
        await this.createNotification({
            userId: params.userId,
            organisationId: params.organisationId,
            type: 'assessment_reminder',
            title: 'Assessment Reminder',
            message: `${params.count} assessment${params.count > 1 ? 's' : ''} scheduled for today`,
        });
    }
}

// Export singleton instance
export const inAppNotificationService = new InAppNotificationService();
