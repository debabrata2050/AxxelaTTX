import { PreviewResponse, WorkspaceFile } from '@/types/trade.types';
import { useTradeStore } from '@/store/useTradeStore';

function getSessionHeaders(): Record<string, string> {
  const sid = useTradeStore.getState().sessionId;
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

export const apiClient = {
  async getStatus() {
    const res = await fetch('/api/status');
    return handleResponse(res);
  },

  async listFiles(): Promise<{ files: WorkspaceFile[] }> {
    const res = await fetch('/api/files');
    return handleResponse<{ files: WorkspaceFile[] }>(res);
  },

  async selectFile(filePath: string) {
    const res = await fetch('/api/select-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath }),
    });
    return handleResponse(res);
  },

  async uploadFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload-file', {
      method: 'POST',
      body: formData,
    });
    return handleResponse(res);
  },

  async deleteFile(filePath: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await fetch('/api/delete-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath }),
    });
    return handleResponse(res);
  },

  async unloadFile() {
    const res = await fetch('/api/unload-file', { method: 'POST' });
    return handleResponse(res);
  },

  async getAccounts(query = '') {
    const res = await fetch(`/api/accounts?q=${encodeURIComponent(query)}`, {
      headers: { ...getSessionHeaders() },
    });
    return handleResponse(res);
  },

  async getContracts(accounts: string, product: string, query = '') {
    const params = new URLSearchParams({
      accounts,
      product,
      q: query,
    });
    const res = await fetch(`/api/contracts?${params.toString()}`, {
      headers: { ...getSessionHeaders() },
    });
    return handleResponse(res);
  },

  async getTrades(accounts: string[], contractIds: string[], product: string) {
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
      }),
    });
    return handleResponse(res);
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
