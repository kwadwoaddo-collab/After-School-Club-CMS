/**
 * WhatsApp Business Platform (Meta Cloud API) runtime config. Read at call time (not import time)
 * so the flag, dry-run mode and secrets can be changed by env without a code change and tests can toggle them.
 *
 * Env vars (all server-only, never NEXT_PUBLIC_):
 *   FF_WHATSAPP_API         'true' to allow API sends at all. Default OFF.
 *   WHATSAPP_DRY_RUN        'true' to log the payload instead of calling Meta.
 *   WHATSAPP_ACCESS_TOKEN   system-user token (secret; never stored in the DB, never logged).
 *   WHATSAPP_APP_SECRET     Meta app secret, for X-Hub-Signature-256 verification.
 *   WHATSAPP_VERIFY_TOKEN   shared string for the GET webhook verification handshake.
 *   WHATSAPP_GRAPH_VERSION  optional, default v21.0.
 */
export const isWhatsAppApiEnabled = (): boolean => process.env.FF_WHATSAPP_API === 'true';
export const isWhatsAppDryRun = (): boolean => process.env.WHATSAPP_DRY_RUN === 'true';
export const getWhatsAppAccessToken = (): string | null => process.env.WHATSAPP_ACCESS_TOKEN?.trim() || null;
export const getWhatsAppAppSecret = (): string | null => process.env.WHATSAPP_APP_SECRET?.trim() || null;
export const getWhatsAppVerifyToken = (): string | null => process.env.WHATSAPP_VERIFY_TOKEN?.trim() || null;
export const getGraphVersion = (): string => process.env.WHATSAPP_GRAPH_VERSION?.trim() || 'v21.0';
