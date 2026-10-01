export type ProductType = 'ALL' | 'FUT' | 'OPT';

export type PriceMode = 'price' | 'settle' | 'manual';

export interface WorkspaceFile {
  path: string;
  rel_path: string;
  name: string;
  size_mb: number;
  mtime: number;
}

export interface AccountItem {
  account: string;
  trade_count: number;
}

export interface TradeRecord {
  row_id: string;
  account: string;
  sectyp: 'FUT' | 'OPT' | string;
  contractcode: string;
  contractfullname?: string;
  contractdescription?: string;
  transactiontype: 'B' | 'S' | string;
  qtybalance: number;
  price: number;
  settle?: number;
  contractexpiry?: string;
  expirydate?: string;
  datestr?: string;
  cp?: string;
  strike?: number;
  currency?: string;
}

export interface ContractItem {
  contract_id: string;
  contract_key?: string;
  account?: string;
  contractcode: string;
  sectyp: string;
  contractfullname?: string;
  contractdescription?: string;
  contractexpiry?: string;
  expirydate?: string;
  cp?: string;
  strike?: number;
  available_lots: number;
  trade_count: number;
  accounts: string[];
}

export interface TransferRoute {
  from: string;
  to: string;
}

export interface TradeAllocation {
  selected: boolean;
  transfer_qty: number;
  custom_price: number | null;
  to_account: string;
}

export interface ExcelPreviewRow {
  cells: (string | number | null)[];
}

export interface PreviewResponse {
  headers: string[];
  rows: { cells: (string | number | null)[] }[];
  summary: {
    total_records: number;
    buy_records: number;
    sell_records: number;
    future_records: number;
    option_records: number;
    total_lots: number;
  };
  error?: string;
}

export interface LoadingStepItem {
  id: string;
  label: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
}
