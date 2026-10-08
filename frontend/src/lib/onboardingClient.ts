import {
  OnboardingUserInput,
  OnboardingDerived,
  ClientgroupRule,
  BrokerRule,
  SubgroupSuffix,
} from '@/types/onboarding.types';

const BASE = '/api/onboarding';

async function handleJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (!res.ok) {
      throw new Error(`Server error (${res.status}): ${text.slice(0, 150) || res.statusText}`);
    }
    throw new Error('Invalid JSON response from server');
  }

  if (!res.ok) {
    const errMsg = data?.error || data?.message || `Server error (${res.status})`;
    throw new Error(errMsg);
  }

  return data as T;
}

// ─── Export ──────────────────────────────────────────────────────────────────

export async function exportOnboardingExcel(
  rows: OnboardingUserInput[],
  filename = 'Onboarding.xlsx',
): Promise<Blob> {
  const res = await fetch(`${BASE}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows, filename }),
  });
  if (!res.ok) {
    const text = await res.text();
    try {
      const err = JSON.parse(text);
      throw new Error(err.error || 'Export failed');
    } catch {
      throw new Error(`Export failed (${res.status})`);
    }
  }
  return res.blob();
}

// ─── Live preview ─────────────────────────────────────────────────────────────

export async function fetchDerivedPreview(
  input: Partial<OnboardingUserInput>,
): Promise<OnboardingDerived> {
  const res = await fetch(`${BASE}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await handleJson<{ success: boolean; derived: OnboardingDerived }>(res);
  return data.derived;
}

// ─── Admin: clientgroup rules ─────────────────────────────────────────────────

export async function fetchClientgroupRules(): Promise<ClientgroupRule[]> {
  const res = await fetch(`${BASE}/rules/clientgroups`);
  return handleJson<ClientgroupRule[]>(res);
}

export async function saveClientgroupRule(
  rule: Partial<ClientgroupRule> & { clientgroup: string },
): Promise<{ success: boolean; id: number }> {
  const res = await fetch(`${BASE}/rules/clientgroups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  });
  return handleJson(res);
}

export async function deleteClientgroupRule(id: number): Promise<void> {
  await fetch(`${BASE}/rules/clientgroups/${id}`, { method: 'DELETE' });
}

// ─── Admin: broker rules ──────────────────────────────────────────────────────

export async function fetchBrokerRules(): Promise<BrokerRule[]> {
  const res = await fetch(`${BASE}/rules/brokers`);
  return handleJson<BrokerRule[]>(res);
}

export async function saveBrokerRule(
  rule: Partial<BrokerRule> & { prefix: string; distributor: string; clearer_template: string },
): Promise<{ success: boolean; id: number }> {
  const res = await fetch(`${BASE}/rules/brokers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  });
  return handleJson(res);
}

export async function deleteBrokerRule(id: number): Promise<void> {
  await fetch(`${BASE}/rules/brokers/${id}`, { method: 'DELETE' });
}

// ─── Admin: subgroup suffixes ─────────────────────────────────────────────────

export async function fetchSubgroupSuffixes(): Promise<SubgroupSuffix[]> {
  const res = await fetch(`${BASE}/rules/subgroups`);
  return handleJson<SubgroupSuffix[]>(res);
}

export async function saveSubgroupSuffix(
  rule: Partial<SubgroupSuffix> & { clientgroup: string; suffix: string },
): Promise<{ success: boolean; id: number }> {
  const res = await fetch(`${BASE}/rules/subgroups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(rule),
  });
  return handleJson(res);
}

export async function deleteSubgroupSuffix(id: number): Promise<void> {
  await fetch(`${BASE}/rules/subgroups/${id}`, { method: 'DELETE' });
}

// ─── Google Sheet Integration ─────────────────────────────────────────────────

export async function fetchSheetStatus(): Promise<import('@/types/onboarding.types').SheetStatus> {
  const res = await fetch(`${BASE}/sheet/status`);
  return handleJson<import('@/types/onboarding.types').SheetStatus>(res);
}

export async function saveSheetConfig(
  sheet_url: string,
  worksheet_gid = '',
): Promise<{ success: boolean; sheet_title: string; row_count: number; last_synced: string }> {
  const res = await fetch(`${BASE}/sheet/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sheet_url, worksheet_gid }),
  });
  return handleJson(res);
}

export async function refreshSheetData(): Promise<{ success: boolean; status: import('@/types/onboarding.types').SheetStatus }> {
  const res = await fetch(`${BASE}/sheet/refresh`, {
    method: 'POST',
  });
  return handleJson(res);
}

export async function disconnectSheetConfig(): Promise<{ success: boolean; message: string; status: import('@/types/onboarding.types').SheetStatus }> {
  const res = await fetch(`${BASE}/sheet/disconnect`, {
    method: 'POST',
  });
  return handleJson(res);
}

export async function fetchSheetAccounts(query = '', limit = 50): Promise<import('@/types/onboarding.types').SheetAccountItem[]> {
  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (limit) params.set('limit', String(limit));
  const res = await fetch(`${BASE}/sheet/accounts?${params.toString()}`);
  const data = await handleJson<{ success: boolean; accounts: import('@/types/onboarding.types').SheetAccountItem[] }>(res);
  return data.accounts || [];
}

export async function fetchSheetAccount(
  account: string,
  person?: 'p1' | 'p2',
): Promise<import('@/types/onboarding.types').SheetAccountRecord> {
  const query = new URLSearchParams({ account });
  if (person) query.set('person', person);
  const res = await fetch(`${BASE}/sheet/fetch?${query.toString()}`);
  const data = await handleJson<{ success: boolean; record: import('@/types/onboarding.types').SheetAccountRecord }>(res);
  return data.record;
}

export async function batchFetchSheetAccounts(
  accounts: string[],
  jointChoices?: Record<string, 'p1' | 'p2' | 'both'>,
): Promise<import('@/types/onboarding.types').BatchFetchResult> {
  const res = await fetch(`${BASE}/sheet/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accounts, joint_choices: jointChoices || {} }),
  });
  return handleJson<import('@/types/onboarding.types').BatchFetchResult>(res);
}

