/**
 * AXXELA DESK - FRONTEND ENGINE
 * S.O.L.I.D Client Architecture: State Persistence, Multi-Step Validation,
 * Collapsible Sidebar, Loading Spinners & In-Place Excel Grid Editing.
 */

const SESSION_KEY = 'axxela_trade_desk_session_v2';
const THEME_KEY = 'axxela_theme_mode';

const STATE = {
  currentStep: 0,
  theme: localStorage.getItem(THEME_KEY) || 'dark',
  status: null,
  activeFilePath: null,
  activeFilename: null,
  clientGroup: 'SYM',
  defaultDate: null,
  routes: [],           // [{ id: 1, from: 'EE006', to: 'EEABC' }]
  selectedProduct: 'ALL',
  contractSearchQuery: '',
  contracts: [],        // loaded from server
  selectedContracts: new Set(),
  priceMode: 'price',
  globalManualPrice: null,
  trades: [],           // raw trades from server
  allocations: {},      // row_id -> { selected: bool, transfer_qty: num, custom_price: num }
  previewHeaders: [],
  previewRows: [],
  exportFilename: ''
};

// ==========================================================================
// INITIALIZATION
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  bindSidebarCollapse();
  bindStepNavigation();
  bindStep0FileOnboarding();
  bindStep1Accounts();
  bindStep2Contracts();
  bindStep3PricingAndLots();
  bindStep4ReviewAndExport();
  bindSessionRestore();
  checkInitialStatus();
});

// ==========================================================================
// THEME MANAGEMENT (Dark default & Light)
// ==========================================================================
function initTheme() {
  applyTheme(STATE.theme);
  document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === STATE.theme);
    btn.addEventListener('click', () => {
      const mode = btn.dataset.theme;
      STATE.theme = mode;
      localStorage.setItem(THEME_KEY, mode);
      applyTheme(mode);
      document.querySelectorAll('.theme-toggle-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.theme === mode);
      });
    });
  });
}

function applyTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  if (document.body) {
    document.body.setAttribute('data-theme', mode);
  }
  if (mode === 'dark') {
    document.documentElement.classList.add('dark');
    document.documentElement.classList.remove('light');
    if (document.body) {
      document.body.classList.add('dark');
      document.body.classList.remove('light');
    }
  } else {
    document.documentElement.classList.remove('dark');
    document.documentElement.classList.add('light');
    if (document.body) {
      document.body.classList.remove('dark');
      document.body.classList.add('light');
    }
  }
}

// ==========================================================================
// SIDEBAR COLLAPSE
// ==========================================================================
function bindSidebarCollapse() {
  const sidebar = document.getElementById('app-sidebar');
  const btnToggle = document.getElementById('btn-toggle-sidebar');
  btnToggle.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
  });
}

// ==========================================================================
// LOADING SPINNER OVERLAY
// ==========================================================================
function showLoading(text = 'Processing trade data...', subtext = 'Please hold on') {
  const overlay = document.getElementById('loading-overlay');
  document.getElementById('loading-text').textContent = text;
  document.getElementById('loading-subtext').textContent = subtext;
  overlay.classList.remove('hidden');
}

function hideLoading() {
  document.getElementById('loading-overlay').classList.add('hidden');
}

// ==========================================================================
// ALERT NOTIFICATIONS
// ==========================================================================
function showAlert(title, message) {
  const alertEl = document.getElementById('global-alert');
  document.getElementById('global-alert-title').textContent = title;
  document.getElementById('global-alert-message').textContent = message;
  alertEl.classList.remove('hidden');
  alertEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideAlert() {
  document.getElementById('global-alert').classList.add('hidden');
}

document.getElementById('btn-close-alert')?.addEventListener('click', hideAlert);

// ==========================================================================
// STATE PERSISTENCE (localStorage)
// ==========================================================================
let saveDebounceTimer = null;
function persistSession() {
  clearTimeout(saveDebounceTimer);
  saveDebounceTimer = setTimeout(() => {
    // Only persist if user has actually added transfer routes
    if (!STATE.activeFilePath || !STATE.routes || STATE.routes.length === 0) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }

    const payload = {
      version: 2,
      savedAt: Date.now(),
      currentStep: STATE.currentStep,
      activeFilePath: STATE.activeFilePath,
      activeFilename: STATE.activeFilename,
      clientGroup: STATE.clientGroup,
      defaultDate: STATE.defaultDate,
      routes: STATE.routes,
      selectedProduct: STATE.selectedProduct,
      selectedContracts: Array.from(STATE.selectedContracts),
      priceMode: STATE.priceMode,
      globalManualPrice: STATE.globalManualPrice,
      allocations: STATE.allocations,
      exportFilename: STATE.exportFilename
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
    } catch (e) {
      console.warn('Failed to save session to localStorage:', e);
    }
  }, 400);
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  STATE.routes = [];
  STATE.selectedContracts.clear();
  STATE.allocations = {};
  STATE.previewRows = [];
  STATE.currentStep = 0;
  document.getElementById('session-toast').classList.add('hidden');
  updateBasketUI();
  goToStep(0);
}

document.getElementById('btn-reset-transfer')?.addEventListener('click', () => {
  if (confirm('Clear all configured routes, contracts, and lot allocations?')) {
    clearSession();
  }
});

function bindSessionRestore() {
  document.getElementById('btn-discard-session')?.addEventListener('click', () => {
    clearSession();
  });
  document.getElementById('btn-close-toast')?.addEventListener('click', () => {
    document.getElementById('session-toast').classList.add('hidden');
  });
}

// ==========================================================================
// STEP NAVIGATION WIZARD & VALIDATION GUARDS
// ==========================================================================
function bindStepNavigation() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetStep = parseInt(btn.dataset.step, 10);
      attemptStepTransition(targetStep);
    });
  });

  document.querySelectorAll('[data-goto-step]').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetStep = parseInt(btn.dataset.gotoStep, 10);
      attemptStepTransition(targetStep);
    });
  });
}

function attemptStepTransition(targetStep) {
  hideAlert();

  // Validate prerequisites for moving forward
  if (targetStep > 0 && !STATE.activeFilePath) {
    showAlert('File Required', 'Please select or upload a valid trade export CSV file first.');
    goToStep(0);
    return;
  }

  if (targetStep >= 2 && STATE.routes.length === 0) {
    showAlert('Transfer Route Required', 'Please configure at least one transfer route (Sender -> Recipient) before proceeding.');
    goToStep(1);
    return;
  }

  if (targetStep >= 3 && STATE.selectedContracts.size === 0) {
    showAlert('Contracts Required', 'Please select at least one contract to transfer.');
    goToStep(2);
    return;
  }

  if (targetStep >= 4) {
    // Check if at least 1 lot allocated
    let totalLots = 0;
    Object.values(STATE.allocations).forEach(a => {
      if (a.selected) totalLots += parseFloat(a.transfer_qty) || 0;
    });
    if (totalLots <= 0) {
      showAlert('Zero Lots Allocated', 'Please allocate at least one lot for transfer before generating preview.');
      goToStep(3);
      return;
    }

    if (STATE.priceMode === 'manual' && (!STATE.globalManualPrice || STATE.globalManualPrice <= 0)) {
      showAlert('Invalid Manual Price', 'Manual price mode requires a valid positive price number.');
      goToStep(3);
      return;
    }
  }

  goToStep(targetStep);
}

function goToStep(step) {
  STATE.currentStep = step;

  // Toggle View Containers
  document.querySelectorAll('.step-view').forEach(view => {
    view.classList.toggle('hidden', view.id !== `view-step-${step}`);
  });

  // Update Nav Items
  document.querySelectorAll('.nav-item').forEach(btn => {
    const s = parseInt(btn.dataset.step, 10);
    btn.classList.toggle('active', s === step);
    btn.classList.toggle('completed', s < step && STATE.activeFilePath !== null);

    // Disable steps if no file loaded
    if (s > 0) {
      btn.disabled = !STATE.activeFilePath;
      btn.classList.toggle('opacity-60', !STATE.activeFilePath);
    }
  });

  // Step trigger actions
  if (step === 2) {
    loadContracts();
  } else if (step === 3) {
    loadTradesForAllocation();
  } else if (step === 4) {
    buildPreviewTable();
  }

  updateBasketUI();
  persistSession();
}

// ==========================================================================
// STEP 0: FILE ONBOARDING & HEADER VALIDATION
// ==========================================================================
function bindStep0FileOnboarding() {
  const dropzone = document.getElementById('csv-dropzone');
  const fileInput = document.getElementById('file-input-upload');

  dropzone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async (e) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileUpload(e.target.files[0]);
    }
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('border-gold');
  });

  dropzone.addEventListener('dragleave', () => {
    dropzone.classList.remove('border-gold');
  });

  dropzone.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-gold');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  });

  // Sidebar switch file trigger
  document.getElementById('btn-sidebar-switch-file').addEventListener('click', () => {
    promptFileSwitch(0);
  });
}

async function handleFileUpload(file) {
  if (!file.name.toLowerCase().endsWith('.csv')) {
    showAlert('Invalid File Type', 'Only CSV trade files are supported.');
    return;
  }

  showLoading('Uploading and validating headers...', file.name);
  const formData = new FormData();
  formData.append('file', file);

  try {
    const res = await fetch('/api/upload-file', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    hideLoading();

    if (!data.success) {
      showAlert('Header Validation Failed', data.error);
      return;
    }

    applyLoadedFile(data);
    goToStep(1);
  } catch (err) {
    hideLoading();
    showAlert('Upload Error', err.message);
  }
}

async function loadWorkspaceFileList() {
  const container = document.getElementById('workspace-files-list');
  try {
    const res = await fetch('/api/files');
    const data = await res.json();
    const files = data.files || [];

    if (files.length === 0) {
      container.innerHTML = '<div class="col-span-full py-4 text-center text-xs text-slateText-muted">No CSV files found in workspace.</div>';
      return;
    }

    container.innerHTML = files.map(f => `
      <div class="file-item p-3.5 rounded-xl border border-white/10 bg-navy-input hover:border-gold cursor-pointer transition flex justify-between items-center ${f.path === STATE.activeFilePath ? 'border-gold bg-gold/5' : ''}" data-path="${f.path}">
        <div class="truncate">
          <div class="font-bold text-xs text-slateText-primary truncate">${f.name}</div>
          <div class="text-[10px] text-slateText-muted font-mono">${f.rel_path} (${f.size_mb} MB)</div>
        </div>
        ${f.path === STATE.activeFilePath ? '<span class="text-[10px] font-bold text-gold px-2 py-0.5 rounded-full bg-gold/15">Active</span>' : ''}
      </div>
    `).join('');

    container.querySelectorAll('.file-item').forEach(item => {
      item.addEventListener('click', () => {
        const filePath = item.dataset.path;
        if (STATE.activeFilePath && STATE.activeFilePath !== filePath && STATE.routes.length > 0) {
          promptFileSwitch(() => selectWorkspaceFile(filePath));
        } else {
          selectWorkspaceFile(filePath);
        }
      });
    });
  } catch (e) {
    container.innerHTML = `<div class="col-span-full py-4 text-center text-xs text-red-400">Error: ${e.message}</div>`;
  }
}

async function selectWorkspaceFile(filePath) {
  showLoading('Checking headers and loading trades...', filePath.split(/[/\\]/).pop());

  try {
    const res = await fetch('/api/select-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath })
    });
    const data = await res.json();
    hideLoading();

    if (!data.success) {
      showAlert('Header Validation Failed', data.error);
      return;
    }

    applyLoadedFile(data);
    goToStep(1);
  } catch (err) {
    hideLoading();
    showAlert('File Load Failed', err.message);
  }
}

function applyLoadedFile(meta) {
  STATE.activeFilePath = meta.filename ? meta.filename : meta.current_file;
  STATE.activeFilename = meta.filename;
  STATE.clientGroup = meta.client_group || 'SYM';
  STATE.defaultDate = meta.default_date;

  document.getElementById('sb-file-name').textContent = meta.filename;
  document.getElementById('sb-row-count').textContent = `${(meta.total_rows || 0).toLocaleString()} trades`;
  document.getElementById('nav-file-label').textContent = meta.filename;
  document.getElementById('topbar-filename').textContent = meta.filename;
  document.getElementById('topbar-acc-count').textContent = (meta.total_accounts || 0).toLocaleString();
  document.getElementById('topbar-trade-count').textContent = (meta.total_rows || 0).toLocaleString();

  loadWorkspaceFileList();
  persistSession();
}

function promptFileSwitch(onConfirm) {
  const modal = document.getElementById('file-switch-confirm-modal');
  modal.classList.remove('hidden');

  const btnConfirm = document.getElementById('btn-confirm-file-switch');
  const btnCancel = document.getElementById('btn-cancel-file-switch');

  function cleanup() {
    modal.classList.add('hidden');
    btnConfirm.replaceWith(btnConfirm.cloneNode(true));
    btnCancel.replaceWith(btnCancel.cloneNode(true));
  }

  document.getElementById('btn-cancel-file-switch').addEventListener('click', cleanup);
  document.getElementById('btn-confirm-file-switch').addEventListener('click', () => {
    cleanup();
    STATE.routes = [];
    STATE.selectedContracts.clear();
    STATE.allocations = {};
    STATE.previewRows = [];
    renderRoutesList();
    if (typeof onConfirm === 'function') {
      onConfirm();
    } else {
      goToStep(0);
    }
  });
}

// ==========================================================================
// INITIAL STATUS & AUTO-RECOVERY CHECK
// ==========================================================================
async function checkInitialStatus() {
  await loadWorkspaceFileList();

  // Check saved session in localStorage
  const rawSession = localStorage.getItem(SESSION_KEY);
  if (rawSession) {
    try {
      const saved = JSON.parse(rawSession);
      // Only restore if user actually has configured routes (actual work started)
      if (saved && saved.activeFilePath && saved.routes && saved.routes.length > 0) {
        showLoading('Restoring previous session...', saved.activeFilename || 'Rebuilding transfer routes');
        try {
          const res = await fetch('/api/select-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file_path: saved.activeFilePath })
          });
          const data = await res.json();
          hideLoading();

          if (data.success) {
            applyLoadedFile(data);
            STATE.routes = saved.routes || [];
            STATE.selectedProduct = saved.selectedProduct || 'ALL';
            STATE.selectedContracts = new Set(saved.selectedContracts || []);
            STATE.priceMode = saved.priceMode || 'price';
            STATE.globalManualPrice = saved.globalManualPrice || null;
            STATE.allocations = saved.allocations || {};
            STATE.exportFilename = saved.exportFilename || '';

            renderRoutesList();

            const toast = document.getElementById('session-toast');
            if (toast) {
              document.getElementById('session-file-name').textContent = data.filename;
              toast.classList.remove('hidden');
            }

            const resumeStep = Math.min(saved.currentStep || 1, 3);
            attemptStepTransition(resumeStep);
            return;
          } else {
            localStorage.removeItem(SESSION_KEY);
          }
        } catch (fetchErr) {
          hideLoading();
          localStorage.removeItem(SESSION_KEY);
        }
      } else {
        localStorage.removeItem(SESSION_KEY);
      }
    } catch (e) {
      console.warn('Session restore failed:', e);
      localStorage.removeItem(SESSION_KEY);
    }
  }

  // If no session, check if default file is loaded on server
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.loaded) {
      applyLoadedFile(data);
      goToStep(1);
    } else {
      goToStep(0);
    }
  } catch (e) {
    goToStep(0);
  }
}

// ==========================================================================
// STEP 1: ACCOUNTS & ROUTE BUILDER
// ==========================================================================
function bindStep1Accounts() {
  const inputSender = document.getElementById('input-sender-account');
  const dropdown = document.getElementById('sender-dropdown');
  const inputRecipient = document.getElementById('input-recipient-account');
  const btnAdd = document.getElementById('btn-add-route');
  const btnNext = document.getElementById('btn-to-step-2');

  let searchTimer = null;
  inputSender.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      const q = inputSender.value.trim();
      const res = await fetch(`/api/accounts?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      renderSenderDropdown(data.accounts || []);
    }, 180);
  });

  inputSender.addEventListener('focus', async () => {
    if (dropdown.classList.contains('hidden')) {
      const res = await fetch(`/api/accounts?q=${encodeURIComponent(inputSender.value.trim())}`);
      const data = await res.json();
      renderSenderDropdown(data.accounts || []);
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#input-sender-account') && !e.target.closest('#sender-dropdown')) {
      dropdown.classList.add('hidden');
    }
  });

  function renderSenderDropdown(accounts) {
    if (accounts.length === 0) {
      dropdown.innerHTML = '<div class="p-3 text-xs text-slateText-muted">No matching accounts found</div>';
    } else {
      dropdown.innerHTML = accounts.map(a => `
        <div class="px-3.5 py-2 text-xs font-mono flex justify-between cursor-pointer hover:bg-gold/10 hover:text-gold border-b border-white/5 transition" data-acc="${a.account}">
          <strong>${a.account}</strong>
          <span class="text-slateText-muted text-[11px]">${a.trade_count} trades</span>
        </div>
      `).join('');
    }
    dropdown.classList.remove('hidden');

    dropdown.querySelectorAll('[data-acc]').forEach(el => {
      el.addEventListener('click', () => {
        inputSender.value = el.dataset.acc;
        dropdown.classList.add('hidden');
      });
    });
  }

  // Add Route with strict validation
  btnAdd.addEventListener('click', async () => {
    hideAlert();
    const fromVal = inputSender.value.trim().toUpperCase();
    const toVal = inputRecipient.value.trim().toUpperCase();

    if (!fromVal) {
      showAlert('Missing Sender', 'Please choose or type a sender account from the trade file.');
      return;
    }
    if (!toVal) {
      showAlert('Missing Recipient', 'Please enter a recipient account number to receive the trades.');
      return;
    }
    if (fromVal === toVal) {
      showAlert('Invalid Transfer', 'Sender and Recipient cannot be the exact same account.');
      return;
    }

    // Check duplicate
    if (STATE.routes.some(r => r.from === fromVal && r.to === toVal)) {
      showAlert('Duplicate Route', `The transfer route ${fromVal} -> ${toVal} is already added.`);
      return;
    }

    STATE.routes.push({
      id: Date.now(),
      from: fromVal,
      to: toVal
    });

    renderRoutesList();
    updateBasketUI();
    persistSession();

    inputSender.value = '';
    inputRecipient.value = '';
  });

  btnNext.addEventListener('click', () => {
    attemptStepTransition(2);
  });
}

function renderRoutesList() {
  const container = document.getElementById('active-routes-list');
  const badgeCount = document.getElementById('active-routes-count');

  badgeCount.textContent = `${STATE.routes.length} Route${STATE.routes.length !== 1 ? 's' : ''}`;

  if (STATE.routes.length === 0) {
    container.innerHTML = '<div class="text-center py-4 text-xs text-slateText-muted">No transfer routes added yet.</div>';
    return;
  }

  container.innerHTML = STATE.routes.map(r => `
    <div class="flex items-center justify-between p-3 rounded-xl bg-navy-card border border-white/10 hover:border-gold-amber/40 transition">
      <div class="flex items-center gap-3 font-mono text-xs">
        <span class="px-2.5 py-1 rounded-md bg-red-500/15 text-red-300 font-bold border border-red-500/30">FROM: ${r.from}</span>
        <svg class="w-4 h-4 text-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
        <span class="px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-300 font-bold border border-emerald-500/30">TO: ${r.to}</span>
      </div>
      <button class="text-slateText-muted hover:text-red-400 p-1 rounded transition text-sm" data-remove-route="${r.id}" title="Remove">&times;</button>
    </div>
  `).join('');

  container.querySelectorAll('[data-remove-route]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = parseInt(btn.dataset.removeRoute, 10);
      STATE.routes = STATE.routes.filter(r => r.id !== id);
      renderRoutesList();
      updateBasketUI();
      persistSession();
    });
  });
}

// ==========================================================================
// STEP 2: CONTRACTS & PRODUCTS
// ==========================================================================
function bindStep2Contracts() {
  document.querySelectorAll('#product-chips .chip-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#product-chips .chip-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      STATE.selectedProduct = btn.dataset.prod;
      loadContracts();
    });
  });

  const searchInput = document.getElementById('search-contracts-input');
  let searchTimer = null;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      STATE.contractSearchQuery = searchInput.value.trim();
      loadContracts();
    }, 200);
  });

  document.getElementById('btn-select-all-contracts').addEventListener('click', () => {
    STATE.contracts.forEach(c => STATE.selectedContracts.add(c.contractcode));
    renderContractsGrid();
    updateBasketUI();
    persistSession();
  });

  document.getElementById('btn-clear-all-contracts').addEventListener('click', () => {
    STATE.selectedContracts.clear();
    renderContractsGrid();
    updateBasketUI();
    persistSession();
  });

  document.getElementById('btn-to-step-3').addEventListener('click', () => {
    attemptStepTransition(3);
  });
}

async function loadContracts() {
  const grid = document.getElementById('contracts-grid');
  grid.innerHTML = '<div class="col-span-full py-8 text-center text-xs text-slateText-muted">Loading contracts...</div>';

  const accounts = STATE.routes.map(r => r.from).join(',');
  const params = new URLSearchParams({
    accounts: accounts,
    product: STATE.selectedProduct,
    q: STATE.contractSearchQuery
  });

  try {
    const res = await fetch(`/api/contracts?${params.toString()}`);
    const data = await res.json();
    STATE.contracts = data.contracts || [];

    // Auto-select all on first load if none chosen
    if (STATE.selectedContracts.size === 0 && STATE.contracts.length > 0) {
      STATE.contracts.forEach(c => STATE.selectedContracts.add(c.contractcode));
    }

    document.getElementById('contracts-counter').textContent = (data.total_contracts || 0).toLocaleString();
    document.getElementById('contracts-lots-counter').textContent = (data.total_lots || 0).toLocaleString();

    renderContractsGrid();
    updateBasketUI();
    persistSession();
  } catch (err) {
    grid.innerHTML = `<div class="col-span-full py-8 text-center text-xs text-red-400">Failed to load contracts: ${err.message}</div>`;
  }
}

function renderContractsGrid() {
  const grid = document.getElementById('contracts-grid');
  if (STATE.contracts.length === 0) {
    grid.innerHTML = '<div class="col-span-full py-8 text-center text-xs text-slateText-muted">No contracts match current filters.</div>';
    return;
  }

  grid.innerHTML = STATE.contracts.map(c => {
    const isSelected = STATE.selectedContracts.has(c.contractcode);
    const expText = c.contractexpiry || c.expirydate || 'N/A';
    const optExtra = c.sectyp === 'OPT' ? ` | ${c.cp || ''} ${c.strike || ''}` : '';

    return `
      <div class="contract-card ${isSelected ? 'selected' : ''}" data-code="${c.contractcode}">
        <div class="flex justify-between items-start">
          <span class="font-mono text-base font-extrabold text-gold">${c.contractcode}</span>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 font-mono">${c.sectyp || 'FUT'}</span>
        </div>
        <div class="text-xs font-semibold text-slateText-secondary line-clamp-2 mt-1">${c.contractfullname || c.contractdescription || c.contractcode}</div>
        <div class="flex justify-between items-center text-[11px] pt-3 mt-2 border-t border-white/5 text-slateText-muted">
          <span>Exp: ${expText}${optExtra}</span>
          <span class="font-mono font-bold text-slateText-primary">${c.available_lots} Lots (${c.trade_count} trds)</span>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.contract-card').forEach(card => {
    card.addEventListener('click', () => {
      const code = card.dataset.code;
      if (STATE.selectedContracts.has(code)) {
        STATE.selectedContracts.delete(code);
      } else {
        STATE.selectedContracts.add(code);
      }
      card.classList.toggle('selected', STATE.selectedContracts.has(code));
      updateBasketUI();
      persistSession();
    });
  });
}

// ==========================================================================
// STEP 3: PRICING & LOT ALLOCATION
// ==========================================================================
function bindStep3PricingAndLots() {
  document.querySelectorAll('input[name="price-strategy-radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      STATE.priceMode = radio.value;
      document.querySelectorAll('.pricing-card').forEach(card => {
        card.classList.toggle('active', card.dataset.mode === radio.value);
      });

      const manualInput = document.getElementById('input-manual-global-price');
      manualInput.classList.toggle('hidden', radio.value !== 'manual');

      refreshAllocationPrices();
      updateBasketUI();
      persistSession();
    });
  });

  const manualInput = document.getElementById('input-manual-global-price');
  manualInput.addEventListener('input', (e) => {
    STATE.globalManualPrice = parseFloat(e.target.value) || null;
    if (STATE.priceMode === 'manual') {
      refreshAllocationPrices();
      persistSession();
    }
  });

  document.getElementById('btn-fill-all-balance').addEventListener('click', () => {
    STATE.trades.forEach(t => {
      const alloc = STATE.allocations[t.row_id];
      if (alloc) {
        alloc.selected = true;
        alloc.transfer_qty = t.qtybalance;
      }
    });
    renderTradesAllocationTable();
    updateBasketUI();
    persistSession();
  });

  document.getElementById('btn-reset-allocation').addEventListener('click', () => {
    STATE.trades.forEach(t => {
      const alloc = STATE.allocations[t.row_id];
      if (alloc) {
        alloc.selected = false;
        alloc.transfer_qty = 0;
      }
    });
    renderTradesAllocationTable();
    updateBasketUI();
    persistSession();
  });

  const thCheckAll = document.getElementById('th-check-all-trades');
  thCheckAll.addEventListener('change', () => {
    const isChecked = thCheckAll.checked;
    STATE.trades.forEach(t => {
      const alloc = STATE.allocations[t.row_id];
      if (alloc) {
        alloc.selected = isChecked;
        if (isChecked && alloc.transfer_qty === 0) {
          alloc.transfer_qty = t.qtybalance;
        }
      }
    });
    renderTradesAllocationTable();
    updateBasketUI();
    persistSession();
  });

  document.getElementById('btn-to-step-4').addEventListener('click', () => {
    attemptStepTransition(4);
  });
}

async function loadTradesForAllocation() {
  const tbody = document.getElementById('trades-allocation-tbody');
  tbody.innerHTML = '<tr><td colspan="10" class="py-8 text-center text-slateText-muted font-sans">Loading trade executions...</td></tr>';

  const accounts = STATE.routes.map(r => r.from);
  const contractCodes = Array.from(STATE.selectedContracts);

  try {
    const res = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accounts: accounts,
        contract_codes: contractCodes,
        product: STATE.selectedProduct
      })
    });
    const data = await res.json();
    STATE.trades = data.trades || [];

    // Initialize allocations for any new trades
    STATE.trades.forEach(t => {
      if (!STATE.allocations[t.row_id]) {
        STATE.allocations[t.row_id] = {
          selected: true,
          transfer_qty: t.qtybalance,
          custom_price: determineInitialPrice(t)
        };
      }
    });

    renderTradesAllocationTable();
    updateBasketUI();
    persistSession();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" class="py-8 text-center text-red-400 font-sans">Failed to load trades: ${err.message}</td></tr>`;
  }
}

function determineInitialPrice(trade) {
  if (STATE.priceMode === 'manual' && STATE.globalManualPrice !== null) {
    return STATE.globalManualPrice;
  }
  if (STATE.priceMode === 'settle') {
    return trade.settle || trade.price;
  }
  return trade.price;
}

function refreshAllocationPrices() {
  STATE.trades.forEach(t => {
    const alloc = STATE.allocations[t.row_id];
    if (alloc) {
      alloc.custom_price = determineInitialPrice(t);
    }
  });
  renderTradesAllocationTable();
}

function renderTradesAllocationTable() {
  const tbody = document.getElementById('trades-allocation-tbody');
  if (STATE.trades.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="py-8 text-center text-slateText-muted font-sans">No matching trade rows found.</td></tr>';
    return;
  }

  let totalLots = 0;
  let totalTrades = 0;

  tbody.innerHTML = STATE.trades.map(t => {
    const alloc = STATE.allocations[t.row_id] || { selected: true, transfer_qty: t.qtybalance, custom_price: t.price };
    if (alloc.selected) {
      totalLots += parseFloat(alloc.transfer_qty) || 0;
      totalTrades++;
    }

    const isBuy = (t.transactiontype || '').toUpperCase() === 'B';
    const sideBadge = isBuy
      ? '<span class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/20">B</span>'
      : '<span class="px-2 py-0.5 rounded bg-red-500/15 text-red-400 font-bold border border-red-500/20">S</span>';

    const descText = t.contractfullname || t.contractdescription || t.contractcode;

    return `
      <tr class="hover:bg-gold/5 transition ${alloc.selected ? 'bg-gold/[0.02]' : 'opacity-60'}" data-row="${t.row_id}">
        <td class="p-3">
          <input type="checkbox" class="trade-row-checkbox accent-gold" data-id="${t.row_id}" ${alloc.selected ? 'checked' : ''}>
        </td>
        <td class="p-3 font-bold text-slateText-primary">${t.account}</td>
        <td class="p-3 text-[10px]"><span class="px-1.5 py-0.5 rounded bg-white/10 font-bold">${t.sectyp || 'FUT'}</span></td>
        <td class="p-3 text-xs" title="${descText}">${t.contractcode} <span class="text-slateText-muted text-[10px]">(${descText})</span></td>
        <td class="p-3">${sideBadge}</td>
        <td class="p-3 font-bold text-slateText-primary">${t.qtybalance}</td>
        <td class="p-3">
          <div class="flex items-center gap-1">
            <button class="btn-step-dec w-6 h-6 rounded bg-navy-card hover:bg-gold hover:text-obsidian font-bold transition flex items-center justify-center border border-white/10" data-id="${t.row_id}">-</button>
            <input type="number" class="input-table-qty w-16 px-2 py-1 bg-navy-input rounded border border-white/10 focus:border-gold text-center text-xs font-bold text-slateText-primary outline-none" min="0" max="${t.qtybalance}" value="${alloc.transfer_qty}" data-id="${t.row_id}">
            <button class="btn-step-inc w-6 h-6 rounded bg-navy-card hover:bg-gold hover:text-obsidian font-bold transition flex items-center justify-center border border-white/10" data-id="${t.row_id}">+</button>
          </div>
        </td>
        <td class="p-3">
          <input type="number" step="any" class="input-table-price w-20 px-2 py-1 bg-navy-input rounded border border-white/10 focus:border-gold text-center text-xs font-bold text-gold outline-none" value="${alloc.custom_price || ''}" placeholder="Price" data-id="${t.row_id}">
        </td>
        <td class="p-3 text-[11px] text-slateText-muted">${t.contractexpiry || t.expirydate || '-'}</td>
        <td class="p-3 text-[11px] text-slateText-muted">${t.datestr || '-'}</td>
      </tr>
    `;
  }).join('');

  document.getElementById('alloc-lots-sum').textContent = `${totalLots} Lots`;
  document.getElementById('alloc-trades-sum').textContent = `${totalTrades} trades`;

  // Bind row inputs
  tbody.querySelectorAll('.trade-row-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const rid = cb.dataset.id;
      STATE.allocations[rid].selected = cb.checked;
      renderTradesAllocationTable();
      updateBasketUI();
      persistSession();
    });
  });

  tbody.querySelectorAll('.input-table-qty').forEach(inp => {
    inp.addEventListener('change', () => {
      const rid = inp.dataset.id;
      const t = STATE.trades.find(x => x.row_id === rid);
      const maxVal = t ? parseFloat(t.qtybalance) : 9999;
      let val = parseFloat(inp.value) || 0;
      if (val < 0) val = 0;
      if (val > maxVal) {
        val = maxVal;
        showAlert('Quantity Capped', `Cannot transfer more than the available ${maxVal} lots.`);
      }
      inp.value = val;
      STATE.allocations[rid].transfer_qty = val;
      STATE.allocations[rid].selected = val > 0;
      renderTradesAllocationTable();
      updateBasketUI();
      persistSession();
    });
  });

  tbody.querySelectorAll('.btn-step-dec').forEach(btn => {
    btn.addEventListener('click', () => {
      const rid = btn.dataset.id;
      let cur = parseFloat(STATE.allocations[rid].transfer_qty) || 0;
      if (cur > 0) cur--;
      STATE.allocations[rid].transfer_qty = cur;
      STATE.allocations[rid].selected = cur > 0;
      renderTradesAllocationTable();
      updateBasketUI();
      persistSession();
    });
  });

  tbody.querySelectorAll('.btn-step-inc').forEach(btn => {
    btn.addEventListener('click', () => {
      const rid = btn.dataset.id;
      const t = STATE.trades.find(x => x.row_id === rid);
      const maxVal = t ? parseFloat(t.qtybalance) : 9999;
      let cur = parseFloat(STATE.allocations[rid].transfer_qty) || 0;
      if (cur < maxVal) cur++;
      STATE.allocations[rid].transfer_qty = cur;
      STATE.allocations[rid].selected = true;
      renderTradesAllocationTable();
      updateBasketUI();
      persistSession();
    });
  });

  tbody.querySelectorAll('.input-table-price').forEach(inp => {
    inp.addEventListener('change', () => {
      const rid = inp.dataset.id;
      STATE.allocations[rid].custom_price = parseFloat(inp.value) || null;
      persistSession();
    });
  });
}

// ==========================================================================
// STEP 4: REVIEW & LIVE IN-PLACE EDITING
// ==========================================================================
function bindStep4ReviewAndExport() {
  document.getElementById('btn-rebuild-preview').addEventListener('click', buildPreviewTable);
  document.getElementById('btn-download-excel').addEventListener('click', handleExcelDownload);
  document.getElementById('btn-download-excel-bottom').addEventListener('click', handleExcelDownload);
}

function generateDescriptiveFilename() {
  const dateStr = STATE.defaultDate ? STATE.defaultDate.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '');
  if (STATE.routes.length === 1) {
    return `${STATE.clientGroup}.Transfer.${dateStr}_${STATE.routes[0].from}_TO_${STATE.routes[0].to}.xlsx`;
  }
  const fromTag = STATE.routes.map(r => r.from).slice(0, 2).join('+');
  const more = STATE.routes.length > 2 ? `(+${STATE.routes.length - 2}Accts)` : '';
  const toTag = STATE.routes[0].to;
  return `${STATE.clientGroup}.Transfer.${dateStr}_FROM_${fromTag}${more}_TO_${toTag}.xlsx`;
}

async function buildPreviewTable() {
  showLoading('Compiling 18-column Excel preview...', 'Applying Calibri 11pt Bold & thin borders');
  hideAlert();

  const tbody = document.getElementById('excel-tbody');
  const thead = document.getElementById('excel-thead');

  const allocationPayload = [];
  STATE.routes.forEach(route => {
    STATE.trades.forEach(t => {
      if (t.account === route.from) {
        const alloc = STATE.allocations[t.row_id];
        if (alloc && alloc.selected && alloc.transfer_qty > 0) {
          allocationPayload.push({
            row_id: t.row_id,
            from_account: route.from,
            to_account: route.to,
            transfer_qty: alloc.transfer_qty,
            custom_price: alloc.custom_price
          });
        }
      }
    });
  });

  if (allocationPayload.length === 0) {
    hideLoading();
    showAlert('No Allocations', 'No active trades with positive lots selected.');
    goToStep(3);
    return;
  }

  try {
    const res = await fetch('/api/build-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        allocations: allocationPayload,
        price_mode: STATE.priceMode,
        manual_price: STATE.globalManualPrice
      })
    });
    const data = await res.json();
    hideLoading();

    if (data.error) {
      showAlert('Preview Error', data.error);
      return;
    }

    STATE.previewHeaders = data.headers || [];
    STATE.previewRows = (data.rows || []).map(r => r.cells);

    // Build thead
    thead.innerHTML = `<tr>${STATE.previewHeaders.map(h => `<th class="p-2.5">${h}</th>`).join('')}</tr>`;

    renderExcelPreviewCells();

    document.getElementById('preview-total-records').textContent = data.summary?.total_records || '0';

    // Auto-generate clear descriptive filename
    if (!STATE.exportFilename) {
      STATE.exportFilename = generateDescriptiveFilename();
    }
    document.getElementById('input-export-filename').value = STATE.exportFilename;

  } catch (err) {
    hideLoading();
    showAlert('Preview Failed', err.message);
  }
}

function renderExcelPreviewCells() {
  const tbody = document.getElementById('excel-tbody');
  tbody.innerHTML = '';

  STATE.previewRows.forEach((row, rowIndex) => {
    const tr = document.createElement('tr');
    const isSeparator = row.every(c => c === null || c === undefined || c === '');

    if (isSeparator) {
      tr.className = 'separator-row';
      tr.innerHTML = `<td colspan="${STATE.previewHeaders.length}"></td>`;
    } else {
      row.forEach((cellVal, colIndex) => {
        const td = document.createElement('td');
        td.textContent = cellVal !== null && cellVal !== undefined ? cellVal : '';
        td.dataset.row = rowIndex;
        td.dataset.col = colIndex;

        // Double-click to edit cell in-place
        td.addEventListener('dblclick', () => makeCellEditable(td, rowIndex, colIndex));

        tr.appendChild(td);
      });
    }

    tbody.appendChild(tr);
  });
}

function makeCellEditable(td, r, c) {
  if (td.classList.contains('editing')) return;

  const currentVal = STATE.previewRows[r][c] || '';
  td.classList.add('editing');

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'cell-editor';
  input.value = currentVal;

  td.innerHTML = '';
  td.appendChild(input);
  input.focus();
  input.select();

  function commit() {
    const newVal = input.value.trim();
    STATE.previewRows[r][c] = newVal;
    td.classList.remove('editing');
    td.textContent = newVal;
    persistSession();
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') {
      td.classList.remove('editing');
      td.textContent = currentVal;
    }
  });
}

async function handleExcelDownload() {
  if (STATE.previewRows.length === 0) {
    showAlert('Preview Missing', 'Please build the preview before exporting.');
    return;
  }

  const filenameInput = document.getElementById('input-export-filename');
  const filename = filenameInput.value.trim() || generateDescriptiveFilename();

  showLoading('Generating Institutional Excel (.xlsx)...', filename);

  try {
    const res = await fetch('/api/export-excel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: STATE.previewRows,
        filename: filename
      })
    });

    hideLoading();

    if (!res.ok) {
      const err = await res.json();
      showAlert('Export Failed', err.error || 'Unable to build Excel workbook.');
      return;
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

  } catch (err) {
    hideLoading();
    showAlert('Download Error', err.message);
  }
}

// ==========================================================================
// BASKET SUMMARY UI UPDATE
// ==========================================================================
function updateBasketUI() {
  const routesVal = document.getElementById('basket-routes-val');
  const contractsVal = document.getElementById('basket-contracts-val');
  const lotsVal = document.getElementById('basket-lots-val');
  const priceVal = document.getElementById('basket-price-val');
  const badge = document.getElementById('basket-badge-status');

  routesVal.textContent = `${STATE.routes.length} paired`;
  contractsVal.textContent = `${STATE.selectedContracts.size} active`;

  let totalLots = 0;
  Object.values(STATE.allocations).forEach(a => {
    if (a.selected) totalLots += parseFloat(a.transfer_qty) || 0;
  });
  lotsVal.textContent = `${totalLots} Lots`;

  priceVal.textContent = STATE.priceMode === 'price'
    ? 'Market Price'
    : (STATE.priceMode === 'settle' ? 'Settle Price' : 'Fixed Price');

  if (STATE.routes.length > 0 && totalLots > 0) {
    badge.textContent = 'Ready to Export';
    badge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400';
  } else {
    badge.textContent = 'Configuring';
    badge.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gold/10 text-gold';
  }
}
