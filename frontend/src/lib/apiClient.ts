import {
  PreviewResponse,
  WorkspaceFile,
  WorkspaceStatusResponse,
  SelectFileResponse,
} from '@/types/trade.types';
import { useTradeStore } from '@/store/useTradeStore';

function getSessionHeaders(overrideSessionId?: string): Record<string, string> {
  const sid = overrideSessionId || useTradeStore.getState().sessionId;
  return sid ? { 'X-Session-Id': sid } : {};
}

async function handleResponse<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  try {
    const data = JSON.parse(text);
    if (!res.ok) {
      if (res.status === 409) {
        useTradeStore.getState().setSessionMismatch(true);
      }
      if (data?.error) {
        throw new Error(data.message || data.error);
      }
      throw new Error(`Server error (${res.status})`);
    }
    return data;
  } catch (err: any) {
    if (!res.ok) {
      if (res.status === 409) {
        useTradeStore.getState().setSessionMismatch(true);
      }
      throw new Error(`Server error (${res.status}): ${text.slice(0, 100)}`);
    }
    throw err;
  }
}

const contractsCache = new Map<string, any>();
const accountsCache = new Map<string, any>();
const tradesCache = new Map<string, any>();

export function clearContractsCache(): void {
  contractsCache.clear();
  accountsCache.clear();
  tradesCache.clear();
}

export const apiClient = {
  clearContractsCache() {
    clearContractsCache();
  },

  async getStatus(sessionId?: string): Promise<WorkspaceStatusResponse> {
    const res = await fetch('/api/status', {
      headers: { ...getSessionHeaders(sessionId) },
    });
    return handleResponse<WorkspaceStatusResponse>(res);
  },

  async listFiles(): Promise<{ files: WorkspaceFile[] }> {
    const res = await fetch('/api/files');
    return handleResponse<{ files: WorkspaceFile[] }>(res);
  },

  async selectFile(filePath: string, sessionId?: string): Promise<SelectFileResponse> {
    clearContractsCache();
    const res = await fetch('/api/select-file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getSessionHeaders(sessionId),
      },
      body: JSON.stringify({ file_path: filePath }),
    });
    return handleResponse<SelectFileResponse>(res);
  },

  async uploadFile(file: File, sessionId?: string): Promise<SelectFileResponse> {
    clearContractsCache();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload-file', {
      method: 'POST',
      headers: {
        ...getSessionHeaders(sessionId),
      },
      body: formData,
    });
    return handleResponse<SelectFileResponse>(res);
  },

  async deleteFile(filePath: string): Promise<{ success: boolean; message?: string; error?: string }> {
    clearContractsCache();
    const res = await fetch('/api/delete-file', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getSessionHeaders(),
      },
      body: JSON.stringify({ file_path: filePath }),
    });
    return handleResponse(res);
  },

  async unloadFile(): Promise<{ success: boolean }> {
    clearContractsCache();
    const res = await fetch('/api/unload-file', {
      method: 'POST',
      headers: { ...getSessionHeaders() },
    });
    return handleResponse<{ success: boolean }>(res);
  },

  async getAccounts(query = '') {
    const sid = useTradeStore.getState().sessionId || 'default';
    const cacheKey = `${sid}::${query.trim().toUpperCase()}`;
    if (accountsCache.has(cacheKey)) {
      return accountsCache.get(cacheKey);
    }

    const res = await fetch(`/api/accounts?q=${encodeURIComponent(query)}`, {
      headers: { ...getSessionHeaders() },
    });
    const data = await handleResponse(res);
    accountsCache.set(cacheKey, data);
    return data;
  },

  async getContracts(accounts: string, product: string, query = '') {
    const sid = useTradeStore.getState().sessionId || 'default';
    const cacheKey = `${sid}::${accounts}::${product}::${query.trim().toUpperCase()}`;
    if (contractsCache.has(cacheKey)) {
      return contractsCache.get(cacheKey);
    }

    const params = new URLSearchParams({
      accounts,
      product,
      q: query,
    });
    const res = await fetch(`/api/contracts?${params.toString()}`, {
      headers: { ...getSessionHeaders() },
    });
    const data = await handleResponse(res);
    contractsCache.set(cacheKey, data);
    return data;
  },

  clearTradesCache() {
    tradesCache.clear();
  },

  async getTrades(
    accounts: string[],
    contractIds: string[],
    product: string,
    limit?: number,
    offset?: number,
    forceRefresh?: boolean
  ) {
    const sid = useTradeStore.getState().sessionId || 'default';
    const sortedAccs = [...accounts].map((a) => a.trim().toUpperCase()).sort().join(',');
    const sortedCids = [...(contractIds || [])].map((c) => String(c).trim().toUpperCase()).sort().join(',');
    const cacheKey = `${sid}::${sortedAccs}::${sortedCids}::${product}::${limit}::${offset}`;
    
    if (forceRefresh) {
      tradesCache.delete(cacheKey);
    } else if (tradesCache.has(cacheKey)) {
      return tradesCache.get(cacheKey);
    }

    const res = await fetch('/api/trades', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getSessionHeaders(),
      },
      body: JSON.stringify({
        accounts,
        contract_ids: contractIds,
        contract_codes: contractIds,
        product,
        ...(limit !== undefined ? { limit } : {}),
        ...(offset !== undefined ? { offset } : {}),
        ...(forceRefresh ? { force_refresh: true } : {}),
      }),
    });
    const data = await handleResponse(res);
    if (data?.trades && data.trades.length > 0) {
      tradesCache.set(cacheKey, data);
    }
    return data;
  },

  async buildPreview(payload: {
    allocations: Array<{
      row_id: string;
      from_account: string;
      to_account: string;
      transfer_qty: number;
      custom_price: number | null;
      price_mode?: string | null;
    }>;
    price_mode: string;
    manual_price: number | null;
    output_mode?: 'paired' | 'batched';
  }): Promise<PreviewResponse> {
    const res = await fetch('/api/build-preview', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getSessionHeaders(),
      },
      body: JSON.stringify(payload),
    });
    return handleResponse<PreviewResponse>(res);
  },

  async exportExcel(rows: (string | number | null)[][], filename: string): Promise<Blob> {
    const res = await fetch('/api/export-excel', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getSessionHeaders(),
      },
      body: JSON.stringify({ rows, filename }),
    });
    if (!res.ok) {
      if (res.status === 409) {
        useTradeStore.getState().setSessionMismatch(true);
      }
      const text = await res.text();
      try {
        const err = JSON.parse(text);
        throw new Error(err.message || err.error || 'Failed to generate Excel file.');
      } catch {
        throw new Error(`Failed to generate Excel file (${res.status})`);
      }
    }
    return res.blob();
  },
};
