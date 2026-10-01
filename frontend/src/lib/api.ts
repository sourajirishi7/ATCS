const API_BASE = '/api';

export class ApiError extends Error {
  errorCode: string;
  action?: string;
  details?: any;

  constructor(message: string, errorCode = 'API_ERROR', action?: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.errorCode = errorCode;
    this.action = action;
    this.details = details;
  }
}

// In-flight request deduplication map
const inFlightRequests = new Map<string, Promise<any>>();

// Short-lived memory cache for ultra-fast module switching
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}
const apiCache = new Map<string, CacheEntry<any>>();

const DEFAULT_CACHE_TTL_MS = 6000; // 6 seconds

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('atcs_token');

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMsg = data?.message || `Request failed with status ${response.status}`;
    throw new ApiError(errorMsg, data?.errorCode || 'HTTP_ERROR', data?.action, data?.details);
  }

  return data.data !== undefined ? data.data : data;
}

export const api = {
  get: <T>(url: string, options?: { skipCache?: boolean; ttlMs?: number }): Promise<T> => {
    const token = localStorage.getItem('atcs_token') || 'anon';
    const cacheKey = `${token}:${url}`;

    // Return from memory cache if valid
    if (!options?.skipCache) {
      const cached = apiCache.get(cacheKey);
      if (cached && Date.now() < cached.expiresAt) {
        return Promise.resolve(cached.data as T);
      }
    }

    // In-flight deduplication: return existing promise if identical request is pending
    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey)! as Promise<T>;
    }

    const promise = request<T>(url, { method: 'GET' })
      .then((data) => {
        const ttl = options?.ttlMs ?? DEFAULT_CACHE_TTL_MS;
        apiCache.set(cacheKey, {
          data,
          expiresAt: Date.now() + ttl,
        });
        return data;
      })
      .finally(() => {
        inFlightRequests.delete(cacheKey);
      });

    inFlightRequests.set(cacheKey, promise);
    return promise;
  },

  post: async <T>(url: string, body?: any): Promise<T> => {
    // Clear read cache on mutations to prevent stale reads
    apiCache.clear();
    return request<T>(url, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
    });
  },

  put: async <T>(url: string, body?: any): Promise<T> => {
    apiCache.clear();
    return request<T>(url, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
  },

  delete: async <T>(url: string): Promise<T> => {
    apiCache.clear();
    return request<T>(url, { method: 'DELETE' });
  },

  clearCache: () => {
    apiCache.clear();
    inFlightRequests.clear();
  },
};
