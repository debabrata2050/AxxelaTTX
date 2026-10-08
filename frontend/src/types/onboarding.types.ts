export const DEFAULT_COMMS_CODES = ['CWSYM', 'ALGO'] as const;

export interface OnboardingUserInput {
  firstname: string;
  lastname: string;
  clientid: string;           // max 13 chars; drives accountid, accountmap
  email: string;              // drives emailaddress, useremail
  commsgroupcode: string;     // e.g. CWSYM, ALGO, or custom code
  location: 'Kolkata' | 'Gurgaon' | 'Bengaluru' | 'Mumbai' | '';
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
