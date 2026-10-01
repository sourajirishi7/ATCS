import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'spending-documents';

let supabaseClientInstance: SupabaseClient | null = null;

/**
 * True when the server-side (service role) credentials are present.
 * The service role key bypasses Row Level Security and must stay in the backend.
 */
export function isSupabaseServerConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_URL.trim() !== '' &&
      process.env.SUPABASE_SERVICE_ROLE_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY.trim() !== ''
  );
}

/**
 * Returns the authoritative server-side Supabase client using Service Role credentials.
 * This client runs strictly in the ATCS backend and must NEVER be exposed to the browser.
 */
export function getSupabaseServerClient(): SupabaseClient | null {
  if (supabaseClientInstance) {
    return supabaseClientInstance;
  }

  const rawUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!rawUrl || !serviceRoleKey) {
    return null;
  }

  const cleanUrl = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

  supabaseClientInstance = createClient(cleanUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseClientInstance;
}

/**
 * Verifies Supabase connection and connectivity status.
 */
export async function verifySupabaseConnection(): Promise<{
  connected: boolean;
  message: string;
  urlConfigured: boolean;
  serviceKeyConfigured: boolean;
  storageAvailable: boolean;
}> {
  const urlConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_URL.trim() !== '');
  const serviceKeyConfigured = Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY.trim() !== ''
  );

  if (!urlConfigured || !serviceKeyConfigured) {
    return {
      connected: false,
      message: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing from environment variables.',
      urlConfigured,
      serviceKeyConfigured,
      storageAvailable: false,
    };
  }

  const client = getSupabaseServerClient();
  if (!client) {
    return {
      connected: false,
      message: 'Failed to initialize Supabase client instance.',
      urlConfigured,
      serviceKeyConfigured,
      storageAvailable: false,
    };
  }

  try {
    // Test Storage connectivity by listing buckets
    const { data: buckets, error } = await client.storage.listBuckets();
    if (error) {
      return {
        connected: false,
        message: `Supabase Storage error: ${error.message}`,
        urlConfigured,
        serviceKeyConfigured,
        storageAvailable: false,
      };
    }

    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

    return {
      connected: true,
      message: bucketExists
        ? `Successfully connected to Supabase. Storage bucket '${BUCKET_NAME}' is ready.`
        : `Connected to Supabase. Note: Storage bucket '${BUCKET_NAME}' is not yet created.`,
      urlConfigured,
      serviceKeyConfigured,
      storageAvailable: true,
    };
  } catch (err: any) {
    return {
      connected: false,
      message: `Failed to connect to Supabase: ${err.message || String(err)}`,
      urlConfigured,
      serviceKeyConfigured,
      storageAvailable: false,
    };
  }
}

/**
 * Ensures the document storage bucket exists on Supabase.
 */
export async function ensureStorageBucket(): Promise<boolean> {
  const client = getSupabaseServerClient();
  if (!client) return false;

  try {
    const { data: buckets } = await client.storage.listBuckets();
    const exists = buckets?.some((b) => b.name === BUCKET_NAME);

    if (!exists) {
      const { error } = await client.storage.createBucket(BUCKET_NAME, {
        public: false, // Private by default for sensitive financial documentation
        fileSizeLimit: 10 * 1024 * 1024, // 10 MB per file limit
        allowedMimeTypes: [
          'application/pdf',
          'image/png',
          'image/jpeg',
          'image/webp',
          'text/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ],
      });

      if (error && !error.message.includes('already exists')) {
        console.warn(`[Supabase Storage] Could not auto-create bucket '${BUCKET_NAME}': ${error.message}`);
        return false;
      }
    }
    return true;
  } catch (err: any) {
    console.warn(`[Supabase Storage] Failed to ensure bucket '${BUCKET_NAME}':`, err.message);
    return false;
  }
}

/**
 * Uploads a supporting spending document (invoice, receipt, contract) to Supabase Storage.
 *
 * Path shape: `spending-requests/{departmentId}/{spendingRequestId}/{randomToken}-{cleanFileName}`
 * The bucket is PRIVATE. The path is namespaced by department so that storage
 * layout mirrors the ATCS authorization model, and suffixed with a random token
 * so that object keys are not guessable from the file name alone.
 */
export async function uploadSpendingDocument(params: {
  spendingRequestId: string;
  departmentId: string;
  fileName: string;
  fileBuffer: Buffer;
  mimeType: string;
}): Promise<{ storagePath: string; error?: string }> {
  const client = getSupabaseServerClient();
  if (!client) {
    return { storagePath: '', error: 'Supabase client is not configured in backend environment.' };
  }

  await ensureStorageBucket();

  const sanitizedFileName = params.fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const randomToken = crypto.randomBytes(12).toString('hex');
  const storagePath = `spending-requests/${params.departmentId}/${params.spendingRequestId}/${randomToken}-${sanitizedFileName}`;

  const { error } = await client.storage.from(BUCKET_NAME).upload(storagePath, params.fileBuffer, {
    contentType: params.mimeType,
    upsert: false,
  });

  if (error) {
    return { storagePath: '', error: error.message };
  }

  return { storagePath };
}

/**
 * Creates an authorized, time-limited signed URL for viewing or downloading a sensitive financial document.
 * Enforces zero public access without ATCS authorization.
 */
export async function createSignedDocumentUrl(
  storagePath: string,
  expiresInSeconds = 3600
): Promise<{ signedUrl: string | null; error?: string }> {
  const client = getSupabaseServerClient();
  if (!client) {
    return { signedUrl: null, error: 'Supabase client is not configured in backend environment.' };
  }

  const { data, error } = await client.storage.from(BUCKET_NAME).createSignedUrl(storagePath, expiresInSeconds);

  if (error || !data) {
    return { signedUrl: null, error: error?.message || 'Failed to generate signed URL' };
  }

  return { signedUrl: data.signedUrl };
}

/**
 * Deletes a supporting document from Supabase Storage.
 */
export async function deleteSpendingDocument(storagePath: string): Promise<{ success: boolean; error?: string }> {
  const client = getSupabaseServerClient();
  if (!client) {
    return { success: false, error: 'Supabase client is not configured.' };
  }

  const { error } = await client.storage.from(BUCKET_NAME).remove([storagePath]);
  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
