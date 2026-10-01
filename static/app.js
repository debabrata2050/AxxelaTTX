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
  selectedSenderAccount: 'ALL',
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
  exportFilename: '',
  workspaceFiles: [],
  workspaceFileSearchQuery: ''
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
// LOADING SPINNER OVERLAY & MULTI-STAGE PROGRESS MODAL
// ==========================================================================
function showLoading(text = 'Processing trade data...', subtext = 'Please hold on') {
  const overlay = document.getElementById('loading-overlay');
  const simpleSpinner = document.getElementById('loading-simple-spinner');
  const stageCard = document.getElementById('loading-stage-card');

  if (simpleSpinner) simpleSpinner.classList.remove('hidden');
  if (stageCard) stageCard.classList.add('hidden');

  document.getElementById('loading-text').textContent = text;
  document.getElementById('loading-subtext').textContent = subtext;
  overlay.classList.remove('hidden');
}

function showStageModal(filename = '', title = 'Uploading & Validating CSV') {
  const overlay = document.getElementById('loading-overlay');
  const simpleSpinner = document.getElementById('loading-simple-spinner');
  const stageCard = document.getElementById('loading-stage-card');

  if (simpleSpinner) simpleSpinner.classList.add('hidden');
  if (stageCard) stageCard.classList.remove('hidden');

  document.getElementById('stage-title').textContent = title;
  document.getElementById('stage-file-name').textContent = filename;
  document.getElementById('stage-percentage').textContent = '0%';
  document.getElementById('stage-progress-bar').style.width = '0%';
  document.getElementById('stage-detail-text').textContent = 'Preparing transfer...';
  document.getElementById('stage-byte-stats').textContent = '';

  updateStepStatus('upload', 'waiting');
  updateStepStatus('validate', 'pending');
  updateStepStatus('parse', 'pending');

  overlay.classList.remove('hidden');
}

function updateStepStatus(stepKey, status, badgeText = null) {
  // stepKey: 'upload' | 'validate' | 'parse'
  // status: 'pending' | 'waiting' | 'active' | 'done' | 'error'
  const row = document.getElementById(`step-row-${stepKey}`);
  if (!row) return;

  const indicator = row.querySelector('.step-indicator');
  const statusEl = row.querySelector('.step-status');

  row.classList.remove('opacity-60', 'opacity-100');
  indicator.className = 'step-indicator w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] transition-all duration-200';
  statusEl.className = 'step-status text-[10px] font-mono';

  const defaultStepNum = stepKey === 'upload' ? '1' : stepKey === 'validate' ? '2' : '3';

  if (status === 'pending' || status === 'waiting') {
    row.classList.add('opacity-60');
    indicator.classList.add('border', 'border-white/20', 'bg-white/5', 'text-slateText-muted');
    statusEl.classList.add('text-slateText-muted');
    statusEl.textContent = badgeText || (status === 'waiting' ? 'Waiting' : 'Pending');
    indicator.textContent = defaultStepNum;
  } else if (status === 'active') {
    row.classList.add('opacity-100');
    indicator.classList.add('border', 'border-gold', 'bg-gold/20', 'text-gold', 'font-bold', 'ring-2', 'ring-gold/30', 'animate-pulse');
    statusEl.classList.add('text-gold', 'font-semibold');
    statusEl.textContent = badgeText || 'In Progress...';
    indicator.textContent = defaultStepNum;
  } else if (status === 'done') {
    row.classList.add('opacity-100');
    indicator.classList.add('border', 'border-emerald-500', 'bg-emerald-500/20', 'text-emerald-400', 'font-bold');
    indicator.innerHTML = '&#10003;';
    statusEl.classList.add('text-emerald-400', 'font-semibold');
    statusEl.textContent = badgeText || 'Complete';
  } else if (status === 'error') {
    row.classList.add('opacity-100');
    indicator.classList.add('border', 'border-red-500', 'bg-red-500/20', 'text-red-400', 'font-bold');
    indicator.textContent = '!';
    statusEl.classList.add('text-red-400', 'font-semibold');
    statusEl.textContent = badgeText || 'Failed';
  }
}

function updateProgress(pct, detail = '', bytes = '') {
  const bar = document.getElementById('stage-progress-bar');
  const pctEl = document.getElementById('stage-percentage');
  const detailEl = document.getElementById('stage-detail-text');
  const bytesEl = document.getElementById('stage-byte-stats');

  const boundedPct = Math.min(100, Math.max(0, pct));
  if (bar) bar.style.width = `${boundedPct}%`;
  if (pctEl) pctEl.textContent = `${Math.round(boundedPct)}%`;
  if (detail && detailEl) detailEl.textContent = detail;
  if (bytes && bytesEl) bytesEl.textContent = bytes;
}

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function readFileHeaderSnippet(file) {
  return new Promise((resolve, reject) => {
    const slice = file.slice(0, 4096);
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result || '');
    reader.onerror = (e) => reject(e);
    reader.readAsText(slice);
  });
}

function validateCsvHeaderSnippet(snippet) {
  if (!snippet) return [];
  const firstLine = snippet.split(/[\r\n]+/)[0];
  if (!firstLine) return [];
  const headers = firstLine.split(',').map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));
  const mandatory = ['contractcode', 'transactiontype', 'qtybalance'];
  const missing = [];
  for (const m of mandatory) {
    if (!headers.includes(m)) missing.push(m);
  }
  const hasAccount = headers.some(h => h === 'clientaccountnumber' || h === 'clientnumber');
  if (!hasAccount) missing.push('clientaccountnumber or clientnumber');
  return missing;
}

function uploadWithXhr(file) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append('file', file);

    // Track upload progress (Stage 1 is 0% to 70% of total visual flow)
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && e.total > 0) {
        const uploadPct = Math.round((e.loaded / e.total) * 100);
        const overallPct = Math.round(uploadPct * 0.7);
        updateProgress(
          overallPct,
          `Uploading file payload (${uploadPct}%)...`,
          `${formatBytes(e.loaded)} / ${formatBytes(e.total)}`
        );
      }
    });

    xhr.upload.addEventListener('load', () => {
      updateStepStatus('upload', 'done', 'Uploaded');
      updateStepStatus('validate', 'active', 'Checking schema...');
      updateProgress(80, 'Validating CSV headers on backend...', formatBytes(file.size));

      setTimeout(() => {
        if (xhr.readyState < 4) {
          updateStepStatus('validate', 'done', 'Headers Valid');
          updateStepStatus('parse', 'active', 'Indexing trades & accounts...');
          updateProgress(92, 'Building DataFrame & account routes...', formatBytes(file.size));
        }
      }, 350);
    });

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const res = JSON.parse(xhr.responseText);
          updateStepStatus('validate', 'done', 'Headers Valid');
          resolve(res);
        } catch (e) {
          reject(new Error('Invalid JSON response from server'));
        }
      } else {
        try {
          const errRes = JSON.parse(xhr.responseText);
          reject(new Error(errRes.error || `HTTP ${xhr.status} Error`));
        } catch (e) {
          reject(new Error(`Server error (${xhr.status}): ${xhr.statusText}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network connection failed during upload.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out. File processing took too long.'));

    xhr.open('POST', '/api/upload-file');
    xhr.send(formData);
  });
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
  clearTimeout(saveDebounceTimer);
  localStorage.removeItem(SESSION_KEY);
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch (e) {}

  // Full reset of active file and routes
  STATE.activeFilePath = null;
  STATE.activeFilename = null;
  STATE.clientGroup = 'SYM';
  STATE.defaultDate = null;
  STATE.routes = [];
  STATE.selectedContracts.clear();
  STATE.allocations = {};
  STATE.previewRows = [];
  STATE.currentStep = 0;
  STATE.selectedProduct = 'ALL';
  STATE.exportFilename = '';
  STATE.workspaceFileSearchQuery = '';
  STATE.contractSearchQuery = '';

  document.getElementById('sb-file-name').textContent = 'No file loaded';
  document.getElementById('sb-row-count').textContent = '0 trades';
  document.getElementById('nav-file-label').textContent = 'No file selected';
  document.getElementById('topbar-filename').textContent = 'Awaiting CSV';
  document.getElementById('topbar-acc-count').textContent = '0';
  document.getElementById('topbar-trade-count').textContent = '0';

  const wsSearch = document.getElementById('search-workspace-files-input');
  if (wsSearch) wsSearch.value = '';
  document.getElementById('btn-clear-workspace-search')?.classList.add('hidden');

  const inputSender = document.getElementById('input-sender-account');
  const inputRecipient = document.getElementById('input-recipient-account');
  if (inputSender) inputSender.value = '';
  if (inputRecipient) inputRecipient.value = '';
  document.getElementById('btn-clear-sender-search')?.classList.add('hidden');
  document.getElementById('btn-clear-recipient-input')?.classList.add('hidden');

  const contractSearch = document.getElementById('search-contracts-input');
  if (contractSearch) contractSearch.value = '';
  document.getElementById('btn-clear-contracts-search')?.classList.add('hidden');

  const exportFilenameInput = document.getElementById('input-export-filename');
  if (exportFilenameInput) exportFilenameInput.value = '';
  document.getElementById('btn-clear-export-filename')?.classList.add('hidden');

  const selCounter = document.getElementById('contracts-selected-counter');
  if (selCounter) selCounter.textContent = '0';

  document.querySelectorAll('#product-chips .chip-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.prod === 'ALL');
  });

  renderRoutesList();
  updateBasketUI();
  loadWorkspaceFileList();

  // Reset server memory state
  fetch('/api/unload-file', { method: 'POST' }).catch(() => {});

  STATE.selectedSenderAccount = 'ALL';
  const senderLabel = document.getElementById('sender-filter-label');
  if (senderLabel) senderLabel.textContent = 'All Senders';
  document.getElementById('sender-filter-menu')?.classList.add('hidden');
  document.getElementById('sender-filter-arrow')?.classList.remove('rotate-180');
  const senderSearch = document.getElementById('sender-filter-search');
  if (senderSearch) senderSearch.value = '';

  document.getElementById('step2-routes-warning')?.classList.add('hidden');
  document.getElementById('step3-routes-warning')?.classList.add('hidden');
  const step4Summary = document.getElementById('step4-routes-summary');
  if (step4Summary) step4Summary.innerHTML = '';

  const toast = document.getElementById('session-toast');
  if (toast) toast.classList.add('hidden');

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
  if (step === 1) {
    renderRoutesList();
  } else if (step === 2) {
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
  const searchFilesInput = document.getElementById('search-workspace-files-input');
  const btnClearFilesSearch = document.getElementById('btn-clear-workspace-search');

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

  function updateFilesClearBtn() {
    if (btnClearFilesSearch && searchFilesInput) {
      btnClearFilesSearch.classList.toggle('hidden', !searchFilesInput.value);
    }
  }

  if (searchFilesInput) {
    searchFilesInput.addEventListener('input', () => {
      updateFilesClearBtn();
      STATE.workspaceFileSearchQuery = searchFilesInput.value.trim().toLowerCase();
      renderWorkspaceFiles();
    });
  }

  if (btnClearFilesSearch) {
    btnClearFilesSearch.addEventListener('click', () => {
      if (searchFilesInput) {
        searchFilesInput.value = '';
        updateFilesClearBtn();
        STATE.workspaceFileSearchQuery = '';
        renderWorkspaceFiles();
        searchFilesInput.focus();
      }
    });
  }

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

  showStageModal(file.name, 'Uploading & Validating CSV');
  updateStepStatus('upload', 'active', 'Uploading...');
  updateProgress(0, 'Reading file stream...', `0 B / ${formatBytes(file.size)}`);

  // Instant client-side header validation pre-check
  try {
    const snippet = await readFileHeaderSnippet(file);
    const missing = validateCsvHeaderSnippet(snippet);
    if (missing.length > 0) {
      updateStepStatus('upload', 'error', 'Aborted');
      updateStepStatus('validate', 'error', 'Invalid Header');
      updateProgress(0, 'Header validation failed locally', '0 B transferred');
      await new Promise(r => setTimeout(r, 400));
      hideLoading();
      showAlert('Header Validation Failed', `Missing mandatory header(s): [${missing.join(', ')}]. File does not match required trade export format.`);
      return;
    }
  } catch (err) {
    console.warn('Local pre-check skipped:', err);
  }

  try {
    const data = await uploadWithXhr(file);

    if (!data.success) {
      updateStepStatus('validate', 'error', 'Validation Failed');
      updateProgress(80, data.error || 'Validation error');
      await new Promise(r => setTimeout(r, 400));
      hideLoading();
      showAlert('Header Validation Failed', data.error);
      return;
    }

    // Success transition
    updateStepStatus('parse', 'done', `${(data.total_rows || 0).toLocaleString()} trades ready`);
    updateProgress(100, 'Processing complete! Transferring to allocation...', `${formatBytes(file.size)}`);
    await new Promise(r => setTimeout(r, 450));
    hideLoading();

    // Fresh upload: reset routes, contracts, allocations and session storage
    clearTimeout(saveDebounceTimer);
    localStorage.removeItem(SESSION_KEY);
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    STATE.routes = [];
    STATE.selectedContracts.clear();
    STATE.allocations = {};
    STATE.previewRows = [];
    renderRoutesList();

    applyLoadedFile(data);
    goToStep(1);
  } catch (err) {
    updateStepStatus('upload', 'error', 'Failed');
    hideLoading();
    showAlert('Upload Error', err.message);
  }
}

async function loadWorkspaceFileList() {
  try {
    const res = await fetch('/api/files');
    const data = await res.json();
    STATE.workspaceFiles = data.files || [];
    renderWorkspaceFiles();
  } catch (e) {
    const container = document.getElementById('workspace-files-list');
    if (container) {
      container.innerHTML = `<div class="col-span-full py-4 text-center text-xs text-red-400">Error: ${e.message}</div>`;
    }
  }
}

function renderWorkspaceFiles() {
  const container = document.getElementById('workspace-files-list');
  if (!container) return;

  const q = STATE.workspaceFileSearchQuery || '';
  let files = STATE.workspaceFiles || [];
  if (q) {
    files = files.filter(f => (f.name && f.name.toLowerCase().includes(q)) || (f.rel_path && f.rel_path.toLowerCase().includes(q)));
  }

  if (files.length === 0) {
    container.innerHTML = `<div class="col-span-full py-4 text-center text-xs text-slateText-muted">${q ? 'No workspace CSV files match search filter.' : 'No CSV files found in workspace.'}</div>`;
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
}

async function selectWorkspaceFile(filePath) {
  const filename = filePath.split(/[/\\]/).pop();
  showStageModal(filename, 'Loading Workspace CSV');

  // Step 1 is local workspace file -> marked Complete
  updateStepStatus('upload', 'done', 'Local File (Ready)');
  updateStepStatus('validate', 'active', 'Validating schema...');
  updateProgress(35, 'Peeking mandatory CSV headers...', 'Local disk');

  try {
    const fetchPromise = fetch('/api/select-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath })
    });

    const stepTimer = setTimeout(() => {
      updateStepStatus('validate', 'done', 'Headers Valid');
      updateStepStatus('parse', 'active', 'Parsing trades & accounts...');
      updateProgress(75, 'Ingesting trades and building account map...', 'Local disk');
    }, 280);

    const res = await fetchPromise;
    clearTimeout(stepTimer);
    const data = await res.json();

    if (!data.success) {
      updateStepStatus('validate', 'error', 'Invalid');
      updateProgress(50, data.error || 'Validation error');
      await new Promise(r => setTimeout(r, 400));
      hideLoading();
      showAlert('Header Validation Failed', data.error);
      return;
    }

    updateStepStatus('validate', 'done', 'Headers Valid');
    updateStepStatus('parse', 'done', `${(data.total_rows || 0).toLocaleString()} trades ready`);
    updateProgress(100, 'All records loaded successfully', `${(data.total_rows || 0).toLocaleString()} rows`);
    await new Promise(r => setTimeout(r, 450));
    hideLoading();

    // Fresh workspace file load: reset routes, contracts, allocations and session storage
    clearTimeout(saveDebounceTimer);
    localStorage.removeItem(SESSION_KEY);
    try { sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
    STATE.routes = [];
    STATE.selectedContracts.clear();
    STATE.allocations = {};
    STATE.previewRows = [];
    renderRoutesList();

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
            document.querySelectorAll('#product-chips .chip-btn').forEach(b => {
              b.classList.toggle('active', b.dataset.prod === STATE.selectedProduct);
            });
            syncSelectedContractCounters();
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

  // If no session, start clean on Step 0 awaiting user file selection
  goToStep(0);
}

// ==========================================================================
// STEP 1: ACCOUNTS & ROUTE BUILDER
// ==========================================================================
function bindStep1Accounts() {
  const inputSender = document.getElementById('input-sender-account');
  const btnClearSender = document.getElementById('btn-clear-sender-search');
  const dropdown = document.getElementById('sender-dropdown');
  const inputRecipient = document.getElementById('input-recipient-account');
  const btnClearRecipient = document.getElementById('btn-clear-recipient-input');
  const btnAdd = document.getElementById('btn-add-route');
  const btnNext = document.getElementById('btn-to-step-2');

  function updateSenderClearBtn() {
    if (btnClearSender) {
      btnClearSender.classList.toggle('hidden', !inputSender.value);
    }
  }

  function updateRecipientClearBtn() {
    if (btnClearRecipient) {
      btnClearRecipient.classList.toggle('hidden', !inputRecipient.value);
    }
  }

  let searchTimer = null;
  inputSender.addEventListener('input', () => {
    updateSenderClearBtn();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      const q = inputSender.value.trim();
      const res = await fetch(`/api/accounts?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      renderSenderDropdown(data.accounts || []);
    }, 180);
  });

  if (btnClearSender) {
    btnClearSender.addEventListener('click', () => {
      inputSender.value = '';
      updateSenderClearBtn();
      dropdown.classList.add('hidden');
      inputSender.focus();
    });
  }

  inputRecipient.addEventListener('input', () => {
    updateRecipientClearBtn();
  });

  if (btnClearRecipient) {
    btnClearRecipient.addEventListener('click', () => {
      inputRecipient.value = '';
      updateRecipientClearBtn();
      inputRecipient.focus();
    });
  }

  inputSender.addEventListener('focus', async () => {
    if (dropdown.classList.contains('hidden')) {
      const res = await fetch(`/api/accounts?q=${encodeURIComponent(inputSender.value.trim())}`);
      const data = await res.json();
      renderSenderDropdown(data.accounts || []);
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#input-sender-account') && !e.target.closest('#sender-dropdown') && !e.target.closest('#btn-clear-sender-search')) {
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
        updateSenderClearBtn();
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
    updateSenderClearBtn();
    updateRecipientClearBtn();
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

  initSenderDropdown();

  const searchInput = document.getElementById('search-contracts-input');
  const btnClearSearch = document.getElementById('btn-clear-contracts-search');
  let searchTimer = null;

  function updateContractClearBtn() {
    if (btnClearSearch && searchInput) {
      btnClearSearch.classList.toggle('hidden', !searchInput.value);
    }
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      updateContractClearBtn();
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        STATE.contractSearchQuery = searchInput.value.trim();
        loadContracts();
      }, 200);
    });
  }

  if (btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
      if (searchInput) {
        searchInput.value = '';
        updateContractClearBtn();
        STATE.contractSearchQuery = '';
        searchInput.focus();
        loadContracts();
      }
    });
  }

  document.getElementById('btn-select-all-contracts').addEventListener('click', () => {
    STATE.contracts.forEach(c => STATE.selectedContracts.add(c.contract_id || c.contractcode));
    renderContractsGrid();
    syncSelectedContractCounters();
    updateStep2RouteWarnings();
    updateBasketUI();
    persistSession();
  });

  document.getElementById('btn-clear-all-contracts').addEventListener('click', () => {
    const visibleIds = STATE.contracts.map(c => c.contract_id || c.contractcode);
    const anyVisibleSelected = visibleIds.some(id => STATE.selectedContracts.has(id));
    if (anyVisibleSelected) {
      visibleIds.forEach(id => STATE.selectedContracts.delete(id));
    } else {
      STATE.selectedContracts.clear();
    }
    renderContractsGrid();
    syncSelectedContractCounters();
    updateStep2RouteWarnings();
    updateBasketUI();
    persistSession();
  });

  document.getElementById('btn-to-step-3').addEventListener('click', () => {
    attemptStepTransition(3);
  });
}

function initSenderDropdown() {
  const trigger = document.getElementById('btn-sender-filter-trigger');
  const menu = document.getElementById('sender-filter-menu');
  const arrow = document.getElementById('sender-filter-arrow');
  const search = document.getElementById('sender-filter-search');

  if (!trigger || !menu) return;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !isHidden);
    arrow?.classList.toggle('rotate-180', isHidden);
    if (isHidden && search) {
      search.value = '';
      filterSenderList('');
      setTimeout(() => search.focus(), 60);
    }
  });

  if (search) {
    search.addEventListener('input', () => {
      filterSenderList(search.value.trim());
    });
    search.addEventListener('click', (e) => e.stopPropagation());
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#sender-filter-wrapper')) {
      menu.classList.add('hidden');
      arrow?.classList.remove('rotate-180');
    }
  });
}

function filterSenderList(query) {
  const listEl = document.getElementById('sender-filter-list');
  if (!listEl) return;
  const q = (query || '').toUpperCase();
  listEl.querySelectorAll('.sender-filter-item').forEach(item => {
    const val = item.dataset.sender || '';
    const match = !q || val.includes(q) || (val === 'ALL' && 'ALL SENDERS'.includes(q));
    item.classList.toggle('hidden', !match);
  });
}

function renderSenderAccountDropdown() {
  const wrapper = document.getElementById('sender-filter-wrapper');
  const listEl = document.getElementById('sender-filter-list');
  const labelEl = document.getElementById('sender-filter-label');
  if (!wrapper || !listEl) return;

  const uniqueSenders = Array.from(new Set(STATE.routes.map(r => r.from)));
  if (uniqueSenders.length <= 1) {
    wrapper.classList.add('hidden');
    STATE.selectedSenderAccount = 'ALL';
    if (labelEl) labelEl.textContent = 'All Senders';
    return;
  }
  wrapper.classList.remove('hidden');

  if (labelEl) {
    labelEl.textContent = STATE.selectedSenderAccount === 'ALL' ? 'All Senders' : STATE.selectedSenderAccount;
  }

  const items = [
    { sender: 'ALL', label: 'All Senders', desc: `${uniqueSenders.length} accounts` },
    ...uniqueSenders.map(s => {
      const routeCnt = STATE.routes.filter(r => r.from === s).length;
      return { sender: s, label: s, desc: `${routeCnt} route${routeCnt > 1 ? 's' : ''}` };
    })
  ];

  listEl.innerHTML = items.map(it => {
    const isAct = STATE.selectedSenderAccount === it.sender;
    return `
      <div class="sender-filter-item ${isAct ? 'active' : ''}" data-sender="${it.sender}">
        <div class="flex items-center gap-2">
          <span class="font-bold">${it.label}</span>
          ${isAct ? '<span class="text-gold text-[10px]">✓</span>' : ''}
        </div>
        <span class="text-[10px] text-slateText-muted">${it.desc}</span>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.sender-filter-item').forEach(item => {
    item.addEventListener('click', () => {
      const senderVal = item.dataset.sender;
      STATE.selectedSenderAccount = senderVal;
      if (labelEl) {
        labelEl.textContent = senderVal === 'ALL' ? 'All Senders' : senderVal;
      }
      document.getElementById('sender-filter-menu')?.classList.add('hidden');
      document.getElementById('sender-filter-arrow')?.classList.remove('rotate-180');
      loadContracts();
    });
  });
}

function updateStep2RouteWarnings() {
  const warnEl = document.getElementById('step2-routes-warning');
  const warnTextEl = document.getElementById('step2-routes-warning-text');
  if (!warnEl || !warnTextEl) return;

  if (STATE.routes.length <= 1) {
    warnEl.classList.add('hidden');
    return;
  }

  const routesWithSelection = new Set();
  STATE.contracts.forEach(c => {
    const key = c.contract_id || c.contractcode;
    if (STATE.selectedContracts.has(key)) {
      (c.accounts || []).forEach(acc => routesWithSelection.add(acc));
    }
  });

  const emptyRoutes = STATE.routes.filter(r => !routesWithSelection.has(r.from));
  if (emptyRoutes.length > 0 && STATE.selectedContracts.size > 0) {
    warnTextEl.innerHTML = `
      <div><strong>Notice:</strong> Route(s) with <strong>0 selected contracts</strong>: ${emptyRoutes.map(r => `<span class="font-mono font-bold">${r.from} &rarr; ${r.to}</span>`).join(', ')}.</div>
      <div class="text-[11px] text-amber-300/80">Trades for these routes will not be transferred. Switch the Sender filter above to find and select their contracts.</div>
    `;
    warnEl.classList.remove('hidden');
  } else {
    warnEl.classList.add('hidden');
  }
}

async function loadContracts() {
  const grid = document.getElementById('contracts-grid');
  grid.innerHTML = '<div class="col-span-full py-8 text-center text-xs text-slateText-muted">Loading contracts...</div>';

  renderSenderAccountDropdown();

  let accounts = STATE.routes.map(r => r.from).join(',');
  if (STATE.selectedSenderAccount && STATE.selectedSenderAccount !== 'ALL') {
    accounts = STATE.selectedSenderAccount;
  }

  const params = new URLSearchParams({
    accounts: accounts,
    product: STATE.selectedProduct,
    q: STATE.contractSearchQuery
  });

  try {
    const res = await fetch(`/api/contracts?${params.toString()}`);
    const data = await res.json();
    STATE.contracts = data.contracts || [];

    document.getElementById('contracts-counter').textContent = (data.total_contracts || 0).toLocaleString();
    document.getElementById('contracts-lots-counter').textContent = (data.total_lots || 0).toLocaleString();

    renderContractsGrid();
    syncSelectedContractCounters();
    updateStep2RouteWarnings();
    updateBasketUI();
    persistSession();
  } catch (err) {
    grid.innerHTML = `<div class="col-span-full py-8 text-center text-xs text-red-400">Failed to load contracts: ${err.message}</div>`;
  }
}

function syncSelectedContractCounters() {
  const counterEl = document.getElementById('contracts-selected-counter');
  if (counterEl) {
    counterEl.textContent = STATE.selectedContracts.size.toLocaleString();
  }
}

function renderContractsGrid() {
  const grid = document.getElementById('contracts-grid');
  if (STATE.contracts.length === 0) {
    grid.innerHTML = '<div class="col-span-full py-8 text-center text-xs text-slateText-muted">No contracts match current filters.</div>';
    syncSelectedContractCounters();
    updateStep2RouteWarnings();
    return;
  }

  grid.innerHTML = STATE.contracts.map(c => {
    const contractKey = c.contract_id || c.contractcode;
    const isSelected = STATE.selectedContracts.has(contractKey);
    const expText = c.contractexpiry || c.expirydate || 'N/A';
    const optExtra = c.sectyp === 'OPT' ? ` | ${c.cp || ''} ${c.strike || ''}` : '';

    const fullName = (c.contractfullname || '').trim();
    const desc = (c.contractdescription || '').trim();
    const hasDifferentDesc = desc && desc.toLowerCase() !== fullName.toLowerCase();

    const accountsBadges = (c.accounts || []).map(acc => 
      `<span class="contract-account-badge">${acc}</span>`
    ).join(' ');

    return `
      <div class="contract-card ${isSelected ? 'selected' : ''}" data-code="${c.contractcode}" data-contract-id="${contractKey}">
        <div class="flex justify-between items-start">
          <div class="flex items-center gap-2">
            <span class="font-mono text-base font-extrabold text-gold">${c.contractcode}</span>
            <div class="flex items-center gap-1">${accountsBadges}</div>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="contract-select-pill text-[10px] font-bold px-2 py-0.5 rounded-full font-mono transition ${isSelected ? 'bg-gold text-obsidian shadow-sm' : 'bg-white/10 text-slateText-muted'}">
              ${isSelected ? '✓ Selected' : 'Select'}
            </span>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 font-mono">${c.sectyp || 'FUT'}</span>
          </div>
        </div>
        <div class="mt-1.5 space-y-1">
          <div class="text-xs font-semibold text-slateText-primary truncate" title="${fullName || c.contractcode}">
            ${fullName || c.contractcode}
          </div>
          ${hasDifferentDesc ? `
            <div class="text-[11px] text-slateText-secondary truncate flex items-center gap-1.5" title="${desc}">
              <span class="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-gold/15 text-gold uppercase tracking-wider flex-shrink-0">Desc</span>
              <span class="truncate font-mono">${desc}</span>
            </div>
          ` : ''}
        </div>
        <div class="flex justify-between items-center text-[11px] pt-2.5 mt-2.5 border-t border-white/5 text-slateText-muted">
          <span>Exp: ${expText}${optExtra}</span>
          <span class="font-mono font-bold text-slateText-primary">${c.available_lots} Lots (${c.trade_count} trds)</span>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.contract-card').forEach(card => {
    card.addEventListener('click', () => {
      const contractId = card.dataset.contractId || card.dataset.code;
      if (STATE.selectedContracts.has(contractId)) {
        STATE.selectedContracts.delete(contractId);
      } else {
        STATE.selectedContracts.add(contractId);
      }
      const isSel = STATE.selectedContracts.has(contractId);
      card.classList.toggle('selected', isSel);
      const pill = card.querySelector('.contract-select-pill');
      if (pill) {
        pill.textContent = isSel ? '✓ Selected' : 'Select';
        pill.className = `contract-select-pill text-[10px] font-bold px-2 py-0.5 rounded-full font-mono transition ${isSel ? 'bg-gold text-obsidian shadow-sm' : 'bg-white/10 text-slateText-muted'}`;
      }
      syncSelectedContractCounters();
      updateStep2RouteWarnings();
      updateBasketUI();
      persistSession();
    });
  });

  syncSelectedContractCounters();
  updateStep2RouteWarnings();
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
  const contractIds = Array.from(STATE.selectedContracts);

  try {
    const res = await fetch('/api/trades', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accounts: accounts,
        contract_ids: contractIds,
        contract_codes: contractIds,
        product: contractIds.length > 0 ? 'ALL' : STATE.selectedProduct
      })
    });
    const data = await res.json();
    STATE.trades = data.trades || [];

    // Initialize allocations for any new trades with destination routing
    STATE.trades.forEach(t => {
      const matchingRoutes = STATE.routes.filter(r => r.from === t.account);
      const defaultTo = matchingRoutes.length > 0 ? matchingRoutes[0].to : '';
      if (!STATE.allocations[t.row_id]) {
        STATE.allocations[t.row_id] = {
          selected: true,
          transfer_qty: t.qtybalance,
          custom_price: determineInitialPrice(t),
          to_account: defaultTo
        };
      } else if (!STATE.allocations[t.row_id].to_account && defaultTo) {
        STATE.allocations[t.row_id].to_account = defaultTo;
      }
    });

    renderTradesAllocationTable();
    updateStep3RouteWarnings();
    updateBasketUI();
    persistSession();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" class="py-8 text-center text-red-400 font-sans">Failed to load trades: ${err.message}</td></tr>`;
  }
}

function updateStep3RouteWarnings() {
  const warnEl = document.getElementById('step3-routes-warning');
  const warnTextEl = document.getElementById('step3-routes-warning-text');
  if (!warnEl || !warnTextEl) return;

  if (STATE.routes.length <= 1) {
    warnEl.classList.add('hidden');
    return;
  }

  const sendersInTrades = new Set(STATE.trades.map(t => t.account));
  const missingRoutes = STATE.routes.filter(r => !sendersInTrades.has(r.from));
  if (missingRoutes.length > 0) {
    warnTextEl.innerHTML = `
      <div><strong>Notice:</strong> Route(s) with <strong>0 trades</strong>: ${missingRoutes.map(r => `<span class="font-mono font-bold">${r.from} &rarr; ${r.to}</span>`).join(', ')}.</div>
      <div class="text-[11px] text-amber-300/80">These route(s) had no contracts selected in Step 2 and will be omitted from the final transfer file. Go back to Step 2 to select their contracts if needed.</div>
    `;
    warnEl.classList.remove('hidden');
  } else {
    warnEl.classList.add('hidden');
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
    const matchingRoutes = STATE.routes.filter(r => r.from === t.account);
    const defaultTo = matchingRoutes.length > 0 ? matchingRoutes[0].to : '';
    const alloc = STATE.allocations[t.row_id] || { selected: true, transfer_qty: t.qtybalance, custom_price: t.price, to_account: defaultTo };
    if (!alloc.to_account && defaultTo) {
      alloc.to_account = defaultTo;
    }

    if (alloc.selected) {
      totalLots += parseFloat(alloc.transfer_qty) || 0;
      totalTrades++;
    }

    const isBuy = (t.transactiontype || '').toUpperCase() === 'B';
    const sideBadge = isBuy
      ? '<span class="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/20">B</span>'
      : '<span class="px-2 py-0.5 rounded bg-red-500/15 text-red-400 font-bold border border-red-500/20">S</span>';

    const fullName = (t.contractfullname || '').trim();
    const desc = (t.contractdescription || '').trim();
    const hasDifferentDesc = desc && desc.toLowerCase() !== fullName.toLowerCase();
    const fullTooltip = [t.contractcode, fullName, hasDifferentDesc ? desc : ''].filter(Boolean).join(' - ');

    const routeSelectHtml = matchingRoutes.length > 1
      ? `<div class="mt-1">
           <select class="select-route-dest px-1.5 py-0.5 rounded bg-navy-input border border-white/10 text-[10px] font-mono text-emerald-300" data-id="${t.row_id}">
             ${matchingRoutes.map(mr => `<option value="${mr.to}" ${alloc.to_account === mr.to ? 'selected' : ''}>&rarr; ${mr.to}</option>`).join('')}
           </select>
         </div>`
      : `<div class="text-[10px] text-emerald-400/80 font-mono mt-0.5">&rarr; ${alloc.to_account || (matchingRoutes[0]?.to || '')}</div>`;

    return `
      <tr class="hover:bg-gold/5 transition ${alloc.selected ? 'bg-gold/[0.02]' : 'opacity-60'}" data-row="${t.row_id}">
        <td class="p-3">
          <input type="checkbox" class="trade-row-checkbox accent-gold" data-id="${t.row_id}" ${alloc.selected ? 'checked' : ''}>
        </td>
        <td class="p-3 font-bold text-slateText-primary">
          <div>${t.account}</div>
          ${routeSelectHtml}
        </td>
        <td class="p-3 text-[10px]"><span class="px-1.5 py-0.5 rounded bg-white/10 font-bold">${t.sectyp || 'FUT'}</span></td>
        <td class="p-3 text-xs max-w-[280px]" title="${fullTooltip}">
          <div class="font-mono font-bold text-gold">${t.contractcode}</div>
          ${fullName ? `<div class="text-[11px] font-semibold text-slateText-primary truncate">${fullName}</div>` : ''}
          ${hasDifferentDesc ? `<div class="text-[10px] text-slateText-muted truncate font-mono mt-0.5"><span class="text-gold/70 font-sans font-bold text-[9px] uppercase">Desc:</span> ${desc}</div>` : ''}
        </td>
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

  tbody.querySelectorAll('.select-route-dest').forEach(sel => {
    sel.addEventListener('change', () => {
      const rid = sel.dataset.id;
      if (STATE.allocations[rid]) {
        STATE.allocations[rid].to_account = sel.value;
        persistSession();
      }
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

  const handleStartNewFile = () => {
    if (confirm('Start with a new file? This will reset all current routes, contracts, allocations, and preview data.')) {
      clearSession();
    }
  };

  document.getElementById('btn-start-new-file-step4')?.addEventListener('click', handleStartNewFile);
  document.getElementById('btn-start-new-file-step4-bottom')?.addEventListener('click', handleStartNewFile);

  const inputFilename = document.getElementById('input-export-filename');
  const btnClearFilename = document.getElementById('btn-clear-export-filename');

  function updateFilenameClearBtn() {
    if (btnClearFilename && inputFilename) {
      btnClearFilename.classList.toggle('hidden', !inputFilename.value);
    }
  }

  if (inputFilename) {
    inputFilename.addEventListener('input', () => {
      updateFilenameClearBtn();
      STATE.exportFilename = inputFilename.value.trim();
      persistSession();
    });
  }

  if (btnClearFilename) {
    btnClearFilename.addEventListener('click', () => {
      if (inputFilename) {
        inputFilename.value = '';
        updateFilenameClearBtn();
        STATE.exportFilename = '';
        inputFilename.focus();
        persistSession();
      }
    });
  }
}

function generateDescriptiveFilename() {
  const dateStr = STATE.defaultDate ? STATE.defaultDate.replace(/-/g, '') : new Date().toISOString().split('T')[0].replace(/-/g, '');
  if (STATE.routes.length === 1) {
    return `${STATE.clientGroup}.Transfer.${dateStr}_${STATE.routes[0].from}_TO_${STATE.routes[0].to}.xlsx`;
  }
  const fromTag = Array.from(new Set(STATE.routes.map(r => r.from))).slice(0, 2).join('+');
  const moreFrom = new Set(STATE.routes.map(r => r.from)).size > 2 ? `(+${new Set(STATE.routes.map(r => r.from)).size - 2}Accts)` : '';
  const toTag = Array.from(new Set(STATE.routes.map(r => r.to))).slice(0, 2).join('+');
  return `${STATE.clientGroup}.Transfer.${dateStr}_FROM_${fromTag}${moreFrom}_TO_${toTag}.xlsx`;
}

async function buildPreviewTable() {
  showLoading('Compiling 18-column Excel preview...', 'Applying Calibri 11pt Bold & thin borders');
  hideAlert();

  const tbody = document.getElementById('excel-tbody');
  const thead = document.getElementById('excel-thead');

  const allocationPayload = [];
  STATE.trades.forEach(t => {
    const alloc = STATE.allocations[t.row_id];
    if (alloc && alloc.selected && alloc.transfer_qty > 0) {
      const matchingRoutes = STATE.routes.filter(r => r.from === t.account);
      const toAcc = alloc.to_account || (matchingRoutes.length > 0 ? matchingRoutes[0].to : null);
      if (toAcc) {
        allocationPayload.push({
          row_id: t.row_id,
          from_account: t.account,
          to_account: toAcc,
          transfer_qty: alloc.transfer_qty,
          custom_price: alloc.custom_price
        });
      }
    }
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

    // Render Step 4 route status pills
    const routeCounts = {};
    allocationPayload.forEach(a => {
      const key = `${a.from_account} -> ${a.to_account}`;
      routeCounts[key] = (routeCounts[key] || 0) + 1;
    });

    const routesSummaryEl = document.getElementById('step4-routes-summary');
    if (routesSummaryEl) {
      routesSummaryEl.innerHTML = STATE.routes.map(r => {
        const key = `${r.from} -> ${r.to}`;
        const cnt = routeCounts[key] || 0;
        if (cnt > 0) {
          return `<span class="px-2.5 py-1 rounded-md bg-emerald-500/15 text-emerald-300 font-mono font-bold border border-emerald-500/30">✓ ${r.from} &rarr; ${r.to}: ${cnt} trades</span>`;
        } else {
          return `<span class="px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-300 font-mono font-bold border border-amber-500/30" title="0 trades allocated for this route">⚠️ ${r.from} &rarr; ${r.to}: 0 trades (Excluded)</span>`;
        }
      }).join(' ');
    }

    // Auto-generate clear descriptive filename
    if (!STATE.exportFilename) {
      STATE.exportFilename = generateDescriptiveFilename();
    }
    const filenameInp = document.getElementById('input-export-filename');
    if (filenameInp) {
      filenameInp.value = STATE.exportFilename;
      document.getElementById('btn-clear-export-filename')?.classList.toggle('hidden', !STATE.exportFilename);
    }

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
