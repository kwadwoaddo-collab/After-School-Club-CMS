import { put, del } from '@vercel/blob';
import { logger } from '@/lib/logger';

/**
 * Uploads a file to Vercel Blob storage.
 * @param file The File or Blob object to upload.
 * @param filename The desired filename or path within the bucket.
 * @returns The URL of the uploaded blob.
 */
export async function uploadToBlob(file: File | Blob, filename: string): Promise<string> {
    try {
        const blob = await put(filename, file, {
            access: 'public',
        });
        logger.info('Successfully uploaded file to Blob', { url: blob.url });
        return blob.url;
    } catch (error) {
        logger.error('Failed to upload file to Blob', { error, filename });
        throw new Error('File upload failed.');
    }
}

/**
 * Deletes a file from Vercel Blob storage.
 * @param url The URL of the blob to delete.
 */
export async function deleteFromBlob(url: string): Promise<void> {
    try {
        await del(url);
        logger.info('Successfully deleted file from Blob', { url });
    } catch (error) {
        logger.error('Failed to delete file from Blob', { error, url });
        throw new Error('File deletion failed.');
    }
}
