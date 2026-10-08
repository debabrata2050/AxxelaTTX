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
  try {
    const data = JSON.parse(text);
    if (!res.ok && data?.error) throw new Error(data.error);
    return data as T;
  } catch (err: any) {
    if (!res.ok) throw new Error(`Server error (${res.status}): ${text.slice(0, 120)}`);
    throw err;
  }
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
