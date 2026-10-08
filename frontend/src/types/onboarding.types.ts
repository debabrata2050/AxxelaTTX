export const DEFAULT_COMMS_CODES = ['CWSYM', 'ALGO'] as const;

export interface OnboardingUserInput {
  firstname: string;
  lastname: string;
  clientid: string;           // max 13 chars; drives accountid, accountmap
  email: string;              // drives emailaddress, useremail
  commsgroupcode: string;     // e.g. CWSYM, ALGO, or custom code
  location: 'Kolkata' | 'Gurgaon' | 'Bengaluru' | 'Mumbai' | 'Dubai' | '';
  sub_branch: 'Senior' | 'Junior' | '';   // only when location = Kolkata
  is_commodity: boolean;                  // only when location = Gurgaon
  subgroupPrefix: string;                 // up to 8 digits, prepended to derived suffix
}

// ─── Derived / constant fields shown in the preview panel ────────────────────
export interface OnboardingDerived {
  clientgroup: string;
  clientsubgroup: string;
  accountid: string;
  accountmap: string;
  distributor: string;
  cleareraccountid: string;
  emailaddress: string;
  useremail: string;
  basecurrency: string;
  clientcountrycode: string;
}

// ─── A single complete onboarding row (user input + derived together) ─────────
export interface OnboardingRow extends OnboardingUserInput {
  id: string;               // local UUID for table key / delete
  derived: OnboardingDerived;
}

// ─── Admin rule shapes returned by the backend ───────────────────────────────
export interface ClientgroupRule {
  id: number;
  comms_code: string | null;
  location: string | null;
  sub_branch: string | null;
  is_commodity: number | null;
  clientgroup: string;
  priority: number;
}

export interface BrokerRule {
  id: number;
  prefix: string;
  distributor: string;
  clearer_template: string;
}

export interface SubgroupSuffix {
  id: number;
  clientgroup: string;
  suffix: string;
}

// ─── Default blank user input ─────────────────────────────────────────────────
export const EMPTY_USER_INPUT: OnboardingUserInput = {
  firstname: '',
  lastname: '',
  clientid: '',
  email: '',
  commsgroupcode: 'CWSYM',
  location: '',
  sub_branch: '',
  is_commodity: false,
  subgroupPrefix: '',
};

// ─── Google Sheet Integration Types ──────────────────────────────────────────
export interface SheetStatus {
  configured: boolean;
  connected: boolean;
  sheet_title: string;
  sheet_url: string;
  worksheet_gid: string;
  row_count: number;
  service_email: string;
  last_synced: string | null;
  message?: string;
  error?: string;
}

export interface SheetAccountItem {
  account: string;
  name: string;
  branch: string;
  is_joint: boolean;
}

export interface SheetPersonItem {
  label: string;
  input: OnboardingUserInput;
  derived: OnboardingDerived;
}

export interface SheetAccountRecord {
  account: string;
  raw_name: string;
  raw_email: string;
  location: string;
  sub_branch: string;
  subgroup_prefix: string;
  commsgroupcode: string;
  is_joint: boolean;
  persons: SheetPersonItem[];
  selected?: SheetPersonItem;
}

export interface BatchFetchResult {
  success: boolean;
  rows: SheetPersonItem[];
  missing: string[];
  joint_detected: string[];
}

