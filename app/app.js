import { initialData, cloneInitialData, currencyFormatter } from './data.js';

const STORAGE_KEY = 'protekari-officeless-demo';
let state = loadState();
let requisitionItems = [];
let selectedPoId = null;
ensureStateIntegrity();

function ensureStateIntegrity() {
  state.budgets = state.budgets || [];
  state.vendors = state.vendors || [];
  state.departments = state.departments || [];
  state.categories = state.categories || [];
  state.employees = state.employees || [];
  state.approvalMatrix = state.approvalMatrix || [];
  state.requisitions = state.requisitions || [];
  state.purchaseOrders = state.purchaseOrders || [];
  state.goodsReceipts = state.goodsReceipts || [];
  state.invoices = state.invoices || [];
  state.counters = Object.assign({ PR: 1, PO: 1, GR: 1, INV: 1 }, state.counters || {});
}

function loadState() {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return cloneInitialData();
  }
  try {
    const parsed = JSON.parse(raw);
    return Object.assign(cloneInitialData(), parsed);
  } catch (err) {
    console.warn('Gagal memuat state tersimpan, reset ke default', err);
    return cloneInitialData();
  }
}

function saveState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function resetState() {
  state = cloneInitialData();
  requisitionItems = [];
  selectedPoId = null;
  saveState();
  renderAll();
}

const elements = {
  navButtons: Array.from(document.querySelectorAll('nav button')),
  views: Array.from(document.querySelectorAll('.view')),
  budgetForm: document.getElementById('budget-form'),
  vendorForm: document.getElementById('vendor-form'),
  requisitionForm: document.getElementById('requisition-form'),
  addItemBtn: document.getElementById('add-item-btn'),
  itemsList: document.getElementById('items-list'),
  reqTotal: document.getElementById('req-total'),
  dashboardMetrics: document.getElementById('dashboard-metrics'),
  dashboardActions: document.getElementById('dashboard-actions'),
  budgetTable: document.getElementById('budget-table'),
  vendorTable: document.getElementById('vendor-table'),
  requisitionTable: document.getElementById('requisition-table'),
  approvalsList: document.getElementById('approvals-list'),
  poTable: document.getElementById('po-table'),
  poDetail: document.getElementById('po-detail'),
  analyticsContent: document.getElementById('analytics-content'),
  configContent: document.getElementById('config-content'),
  resetButton: document.getElementById('reset-demo'),
};

function setupNavigation() {
  elements.navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      elements.navButtons.forEach((b) => b.classList.toggle('active', b === btn));
      elements.views.forEach((view) => {
        view.classList.toggle('active', view.id === target);
      });
      if (target === 'po-view' && state.purchaseOrders.length > 0 && !selectedPoId) {
        selectedPoId = state.purchaseOrders[0].id;
      }
      renderAll();
    });
  });
}

function populateSelectOptions() {
  const deptOptions = state.departments
    .map((dept) => `<option value="${dept.id}">${dept.name}</option>`)
    .join('');
  document.getElementById('budget-department').innerHTML = `<option value="" disabled selected>Pilih departemen</option>${deptOptions}`;
  document.getElementById('req-department').innerHTML = `<option value="" disabled selected>Pilih departemen</option>${deptOptions}`;

  const categoryOptions = state.categories
    .map((cat) => `<option value="${cat.id}">${cat.name}</option>`)
    .join('');
  document.getElementById('budget-category').innerHTML = `<option value="" disabled selected>Pilih kategori</option>${categoryOptions}`;
  document.getElementById('req-category').innerHTML = `<option value="" disabled selected>Pilih kategori</option>${categoryOptions}`;

  document.getElementById('vendor-categories').innerHTML = state.categories
    .map((cat) => `<option value="${cat.id}">${cat.name}</option>`)
    .join('');

  const vendorOptions = state.vendors
    .map((vendor) => `<option value="${vendor.id}">${vendor.name}</option>`)
    .join('');
  document.getElementById('req-vendor').innerHTML = `<option value="" disabled selected>Pilih vendor</option>${vendorOptions}`;

  const requestorOptions = state.employees
    .filter((emp) => emp.roles.includes('Requester'))
    .map((emp) => `<option value="${emp.id}">${emp.fullName}</option>`)
    .join('');
  document.getElementById('requestor').innerHTML = `<option value="" disabled selected>Pilih pemohon</option>${requestorOptions}`;

  const budgetOptions = state.budgets
    .map((budget) => `<option value="${budget.id}">${budget.name}</option>`)
    .join('');
  document.getElementById('req-budget').innerHTML = `<option value="" disabled selected>Pilih anggaran</option>${budgetOptions}`;
}

function padNumber(value, length = 4) {
  return String(value).padStart(length, '0');
}

function generateId(prefix) {
  if (!state.counters[prefix]) {
    state.counters[prefix] = 1;
  }
  const id = `${prefix}-${padNumber(state.counters[prefix])}`;
  state.counters[prefix] += 1;
  return id;
}

function findById(collection, id) {
  return collection.find((item) => item.id === id) || null;
}

function getAvailableBudget(budget) {
  return budget.allocation - budget.committed - budget.spent;
}

function formatCurrency(value) {
  return currencyFormatter.format(Math.round(value || 0));
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(date);
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function resolveEmployeeName(id) {
  const employee = findById(state.employees, id);
  return employee ? employee.fullName : 'Sistem';
}

function getLineManager(employeeId) {
  const employee = findById(state.employees, employeeId);
  if (!employee || !employee.managerId) return null;
  return findById(state.employees, employee.managerId) || null;
}

function getApproversForRole(role, pr) {
  switch (role) {
    case 'Line Manager': {
      const manager = getLineManager(pr.requestorId);
      return manager ? [manager] : [];
    }
    case 'Head of Marketing':
    case 'Head of IT':
    case 'Department Head':
    case 'Division Director':
    case 'CFO':
    case 'Procurement Lead':
    case 'Warehouse Lead':
    case 'Finance AP': {
      return state.employees.filter((emp) => emp.roles.includes(role) && (role === 'Department Head' ? emp.departmentId === pr.departmentId : true));
    }
    default:
      return state.employees.filter((emp) => emp.roles.includes(role));
  }
}

function determineApprovalRule(pr) {
  return state.approvalMatrix.find((rule) => {
    const departmentMatch = rule.departments.includes('ALL') || rule.departments.includes(pr.departmentId);
    const categoryMatch = rule.categories.includes('ALL') || rule.categories.includes(pr.categoryId);
    const minOk = pr.totalAmount >= (rule.minAmount || 0);
    const maxOk = rule.maxAmount == null ? true : pr.totalAmount <= rule.maxAmount;
    return departmentMatch && categoryMatch && minOk && maxOk;
  }) || null;
}

function buildApprovalProgress(rule, pr) {
  return rule.levels.map((level, index) => ({
    index,
    type: level.type,
    roles: level.roles.map((role) => ({
      role,
      candidates: getApproversForRole(role, pr),
      status: 'pending',
      actorId: null,
      decidedAt: null,
    })),
    completed: false,
  }));
}

function getCurrentApprovalLevel(pr) {
  return pr.approvalProgress.find((level) => !level.completed) || null;
}

function updateBudgetAfterRequisition(pr, deltaCommitted = 0, deltaSpent = 0) {
  const budget = findById(state.budgets, pr.budgetId);
  if (!budget) return;
  budget.committed = Math.max(0, budget.committed + deltaCommitted);
  budget.spent = Math.max(0, budget.spent + deltaSpent);
}

function addHistory(target, entry) {
  if (!target.history) {
    target.history = [];
  }
  target.history.push({
    ...entry,
    timestamp: entry.timestamp || new Date().toISOString(),
  });
}

function handleBudgetSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const allocation = Number(formData.get('allocation') || 0);
  const startDate = formData.get('startDate');
  const endDate = formData.get('endDate');
  if (new Date(startDate) > new Date(endDate)) {
    window.alert('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
    return;
  }
  const newBudget = {
    id: `bud-${Date.now()}`,
    name: formData.get('name'),
    departmentId: formData.get('departmentId'),
    categoryId: formData.get('categoryId'),
    allocation,
    committed: 0,
    spent: 0,
    startDate,
    endDate,
    parentId: null,
    description: formData.get('description') || '',
  };
  state.budgets.push(newBudget);
  saveState();
  populateSelectOptions();
  renderBudgets();
  renderAnalytics();
  renderDashboard();
  event.target.reset();
}

function handleVendorSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const categories = formData.getAll('categories');
  const newVendor = {
    id: `ven-${Date.now()}`,
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone') || '',
    contactPerson: formData.get('contactPerson') || '',
    address: formData.get('address') || '',
    rating: 4.0,
    categories,
  };
  state.vendors.push(newVendor);
  saveState();
  populateSelectOptions();
  renderVendors();
  renderDashboard();
  event.target.reset();
}

function handleAddItem() {
  const description = document.getElementById('item-desc').value.trim();
  const quantity = Number(document.getElementById('item-qty').value || 0);
  const unitPrice = Number(document.getElementById('item-price').value || 0);
  if (!description || quantity <= 0 || unitPrice <= 0) {
    window.alert('Lengkapi deskripsi, kuantitas, dan harga satuan yang valid.');
    return;
  }
  requisitionItems.push({
    id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    description,
    quantity,
    unitPrice,
    total: quantity * unitPrice,
  });
  document.getElementById('item-desc').value = '';
  document.getElementById('item-qty').value = 1;
  document.getElementById('item-price').value = '';
  renderItemsList();
}

function removeItem(itemId) {
  requisitionItems = requisitionItems.filter((item) => item.id !== itemId);
  renderItemsList();
}

function renderItemsList() {
  if (requisitionItems.length === 0) {
    elements.itemsList.innerHTML = '<div class="empty-state">Belum ada item ditambahkan.</div>';
    elements.reqTotal.textContent = 'Total: IDR 0';
    return;
  }
  const html = requisitionItems
    .map(
      (item) => `
        <div class="highlight flex-between">
          <div>
            <strong>${item.description}</strong>
            <div class="small">Qty ${item.quantity} x ${formatCurrency(item.unitPrice)}</div>
          </div>
          <div class="inline-actions">
            <span>${formatCurrency(item.total)}</span>
            <button type="button" class="link" data-remove-item="${item.id}">Hapus</button>
          </div>
        </div>
      `
    )
    .join('');
  elements.itemsList.innerHTML = html;
  const total = requisitionItems.reduce((sum, item) => sum + item.total, 0);
  elements.reqTotal.textContent = `Total: ${formatCurrency(total)}`;
}

function handleRequisitionSubmit(event) {
  event.preventDefault();
  if (requisitionItems.length === 0) {
    window.alert('Tambahkan minimal satu item untuk membuat PR.');
    return;
  }
  const formData = new FormData(event.target);
  const requestorId = formData.get('requestorId');
  const departmentId = formData.get('departmentId');
  const categoryId = formData.get('categoryId');
  const vendorId = formData.get('vendorId');
  const budgetId = formData.get('budgetId');
  const neededBy = formData.get('neededBy');
  const justification = formData.get('justification');

  const budget = findById(state.budgets, budgetId);
  if (!budget) {
    window.alert('Anggaran tidak ditemukan.');
    return;
  }

  const totalAmount = requisitionItems.reduce((sum, item) => sum + item.total, 0);
  if (totalAmount > getAvailableBudget(budget)) {
    window.alert('Nilai PR melebihi sisa anggaran yang tersedia.');
    return;
  }

  const pr = {
    id: generateId('PR'),
    number: `PR-${padNumber(state.counters.PR - 1)}`,
    requestorId,
    departmentId,
    categoryId,
    vendorId,
    budgetId,
    justification,
    neededBy,
    requestDate: new Date().toISOString(),
    status: 'Pending Approval',
    items: JSON.parse(JSON.stringify(requisitionItems)),
    totalAmount,
    history: [],
  };

  const rule = determineApprovalRule(pr);
  if (!rule) {
    window.alert('Tidak ada aturan persetujuan yang cocok untuk PR ini. Periksa konfigurasi matriks.');
    return;
  }

  pr.approvalRuleId = rule.id;
  pr.approvalProgress = buildApprovalProgress(rule, pr);
  addHistory(pr, {
    action: 'Diajukan',
    actorId: requestorId,
    notes: `Total ${formatCurrency(totalAmount)} ke ${findById(state.vendors, vendorId)?.name || '-'} (${rule.name})`,
  });

  state.requisitions.push(pr);
  updateBudgetAfterRequisition(pr, totalAmount, 0);
  saveState();

  requisitionItems = [];
  renderItemsList();
  populateSelectOptions();
  renderRequisitions();
  renderBudgets();
  renderDashboard();
  renderApprovals();
  renderAnalytics();
  event.target.reset();
}

function approveStep(prId, levelIndex, roleIndex, actorId) {
  const pr = findById(state.requisitions, prId);
  if (!pr) return;
  const level = pr.approvalProgress[levelIndex];
  const role = level.roles[roleIndex];
  if (role.status !== 'pending') return;
  role.status = 'approved';
  role.actorId = actorId;
  role.decidedAt = new Date().toISOString();
  addHistory(pr, {
    action: `Disetujui - ${role.role}`,
    actorId,
  });

  const levelCompleted = level.roles.every((r) => r.status === 'approved');
  if (levelCompleted) {
    level.completed = true;
  }

  const stillPending = pr.approvalProgress.some((l) => !l.completed);
  if (!stillPending) {
    pr.status = 'Approved';
    addHistory(pr, {
      action: 'Selesai Disetujui',
      actorId,
      notes: 'Semua level persetujuan selesai.',
    });
  } else {
    pr.status = 'Pending Approval';
  }
  saveState();
  renderApprovals();
  renderRequisitions();
  renderDashboard();
}

function rejectStep(prId, levelIndex, roleIndex, actorId) {
  const pr = findById(state.requisitions, prId);
  if (!pr) return;
  const level = pr.approvalProgress[levelIndex];
  const role = level.roles[roleIndex];
  if (role.status !== 'pending') return;
  role.status = 'rejected';
  role.actorId = actorId;
  role.decidedAt = new Date().toISOString();
  pr.status = 'Rejected';
  level.completed = true;
  addHistory(pr, {
    action: `Ditolak - ${role.role}`,
    actorId,
  });
  updateBudgetAfterRequisition(pr, -pr.totalAmount, 0);
  saveState();
  renderApprovals();
  renderRequisitions();
  renderBudgets();
  renderDashboard();
}

function createPurchaseOrder(prId) {
  const pr = findById(state.requisitions, prId);
  if (!pr || pr.status !== 'Approved') return;
  const po = {
    id: generateId('PO'),
    number: `PO-${padNumber(state.counters.PO - 1)}`,
    prId: pr.id,
    vendorId: pr.vendorId,
    orderDate: new Date().toISOString(),
    status: 'Issued',
    totalAmount: pr.totalAmount,
    items: JSON.parse(JSON.stringify(pr.items)),
    receipts: [],
    invoices: [],
    history: [],
  };
  addHistory(po, {
    action: 'PO dibuat',
    actorId: findEmployeeByRole('Procurement Lead')?.id || null,
    notes: `Konversi dari ${pr.number}`,
  });
  pr.status = 'PO Issued';
  addHistory(pr, {
    action: 'PO Terbit',
    actorId: findEmployeeByRole('Procurement Lead')?.id || null,
    notes: po.number,
  });
  state.purchaseOrders.push(po);
  saveState();
  renderRequisitions();
  renderPurchaseOrders();
  renderDashboard();
}

function findEmployeeByRole(role) {
  return state.employees.find((emp) => emp.roles.includes(role)) || null;
}

function recordGoodsReceipt(poId) {
  const po = findById(state.purchaseOrders, poId);
  if (!po) return;
  const reference = window.prompt('Nomor referensi penerimaan (mis. GR-001):');
  if (!reference) return;
  const receiver = findEmployeeByRole('Warehouse Lead');
  const receipt = {
    id: generateId('GR'),
    poId: po.id,
    reference,
    receivedBy: receiver?.id || null,
    receiptDate: new Date().toISOString(),
  };
  po.receipts.push(receipt);
  po.status = 'Received';
  addHistory(po, {
    action: 'Barang diterima',
    actorId: receipt.receivedBy,
    notes: reference,
  });
  const pr = findById(state.requisitions, po.prId);
  if (pr) {
    pr.status = 'Received';
    addHistory(pr, {
      action: 'Penerimaan barang',
      actorId: receipt.receivedBy,
      notes: reference,
    });
    updateBudgetAfterRequisition(pr, -pr.totalAmount, pr.totalAmount);
  }
  saveState();
  renderPurchaseOrders();
  renderBudgets();
  renderRequisitions();
  renderDashboard();
}

function recordInvoice(poId) {
  const po = findById(state.purchaseOrders, poId);
  if (!po) return;
  const invoiceNumber = window.prompt('Nomor faktur vendor:');
  if (!invoiceNumber) return;
  const ap = findEmployeeByRole('Finance AP');
  const invoice = {
    id: generateId('INV'),
    poId: po.id,
    invoiceNumber,
    invoiceDate: new Date().toISOString(),
    amount: po.totalAmount,
    processedBy: ap?.id || null,
  };
  po.invoices.push(invoice);
  po.status = 'Closed';
  addHistory(po, {
    action: 'Faktur divalidasi',
    actorId: invoice.processedBy,
    notes: invoiceNumber,
  });
  const pr = findById(state.requisitions, po.prId);
  if (pr) {
    pr.status = 'Closed';
    addHistory(pr, {
      action: 'Pembayaran dijadwalkan',
      actorId: invoice.processedBy,
      notes: invoiceNumber,
    });
  }
  saveState();
  renderPurchaseOrders();
  renderRequisitions();
  renderDashboard();
}

function renderDashboard() {
  const totalAllocation = state.budgets.reduce((sum, b) => sum + b.allocation, 0);
  const totalCommitted = state.budgets.reduce((sum, b) => sum + b.committed, 0);
  const totalSpent = state.budgets.reduce((sum, b) => sum + b.spent, 0);
  const pendingApprovals = state.requisitions.filter((pr) => pr.status === 'Pending Approval');
  const urgentRequests = state.requisitions.filter((pr) => pr.status.startsWith('Pending') && pr.neededBy && new Date(pr.neededBy) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));
  const supplierScore = state.vendors.length
    ? (state.vendors.reduce((sum, v) => sum + (v.rating || 4), 0) / state.vendors.length).toFixed(1)
    : 'N/A';

  elements.dashboardMetrics.innerHTML = `
    <div class="metric">
      <h4>Total Alokasi Anggaran</h4>
      <p>${formatCurrency(totalAllocation)}</p>
    </div>
    <div class="metric">
      <h4>Komitmen Aktif</h4>
      <p>${formatCurrency(totalCommitted)}</p>
    </div>
    <div class="metric">
      <h4>Realisasi Pengeluaran</h4>
      <p>${formatCurrency(totalSpent)}</p>
    </div>
    <div class="metric">
      <h4>Skor Vendor Rata-rata</h4>
      <p>${supplierScore}</p>
    </div>
  `;

  if (pendingApprovals.length === 0 && state.purchaseOrders.length === 0) {
    elements.dashboardActions.innerHTML = '<div class="empty-state">Tidak ada tindakan mendesak. Semua proses berjalan sesuai rencana.</div>';
    return;
  }

  const actionItems = [];
  pendingApprovals.slice(0, 3).forEach((pr) => {
    const level = getCurrentApprovalLevel(pr);
    if (!level) return;
    const pendingRoles = level.roles.filter((r) => r.status === 'pending').map((r) => r.role).join(', ');
    actionItems.push(`
      <div class="highlight">
        <strong>${pr.number}</strong>
        <div class="small">Menunggu: ${pendingRoles || 'N/A'} • Nilai ${formatCurrency(pr.totalAmount)}</div>
      </div>
    `);
  });

  urgentRequests.slice(0, 2).forEach((pr) => {
    actionItems.push(`
      <div class="highlight alert">
        <strong>Prioritas Tanggal</strong>
        <div class="small">${pr.number} dibutuhkan ${formatDate(pr.neededBy)} • ${formatCurrency(pr.totalAmount)}</div>
      </div>
    `);
  });

  const openPOs = state.purchaseOrders.filter((po) => po.status !== 'Closed').slice(0, 3);
  openPOs.forEach((po) => {
    actionItems.push(`
      <div class="highlight">
        <strong>${po.number}</strong>
        <div class="small">Status: ${po.status} • ${formatCurrency(po.totalAmount)}</div>
      </div>
    `);
  });

  elements.dashboardActions.innerHTML = actionItems.join('');
}

function renderBudgets() {
  if (state.budgets.length === 0) {
    elements.budgetTable.innerHTML = '<div class="empty-state">Belum ada anggaran. Tambahkan untuk mengaktifkan kontrol pengeluaran.</div>';
    return;
  }
  const rows = state.budgets
    .map((budget) => {
      const dept = findById(state.departments, budget.departmentId);
      const cat = findById(state.categories, budget.categoryId);
      const available = getAvailableBudget(budget);
      const badgeClass = available <= budget.allocation * 0.1 ? 'danger' : available <= budget.allocation * 0.3 ? 'warning' : 'success';
      return `
        <tr>
          <td>
            <strong>${budget.name}</strong>
            <div class="small">${dept?.name || '-'} • ${cat?.name || '-'}</div>
          </td>
          <td>${formatCurrency(budget.allocation)}</td>
          <td>${formatCurrency(budget.committed)}</td>
          <td>${formatCurrency(budget.spent)}</td>
          <td><span class="badge ${badgeClass}">${formatCurrency(available)}</span></td>
          <td class="small">${formatDate(budget.startDate)} - ${formatDate(budget.endDate)}</td>
        </tr>
      `;
    })
    .join('');
  elements.budgetTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Anggaran</th>
          <th>Alokasi</th>
          <th>Komitmen</th>
          <th>Realisasi</th>
          <th>Sisa</th>
          <th>Periode</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderVendors() {
  if (state.vendors.length === 0) {
    elements.vendorTable.innerHTML = '<div class="empty-state">Belum ada vendor terdaftar.</div>';
    return;
  }
  const rows = state.vendors
    .map((vendor) => {
      const categoryNames = vendor.categories
        .map((id) => findById(state.categories, id)?.name || id)
        .map((name) => `<span class="tag">${name}</span>`)
        .join('');
      return `
        <tr>
          <td>
            <strong>${vendor.name}</strong>
            <div class="small">${vendor.email || '-'} • ${vendor.phone || '-'}</div>
          </td>
          <td>${vendor.contactPerson || '-'}</td>
          <td>${categoryNames || '-'}</td>
          <td>${vendor.rating ? vendor.rating.toFixed(1) : '4.0'}</td>
        </tr>
      `;
    })
    .join('');
  elements.vendorTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Vendor</th>
          <th>Kontak</th>
          <th>Kategori</th>
          <th>Rating</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderRequisitions() {
  if (state.requisitions.length === 0) {
    elements.requisitionTable.innerHTML = '<div class="empty-state">Belum ada permintaan pembelian dibuat.</div>';
    return;
  }
  const rows = state.requisitions
    .map((pr) => {
      const requestor = findById(state.employees, pr.requestorId);
      const dept = findById(state.departments, pr.departmentId);
      const category = findById(state.categories, pr.categoryId);
      const budget = findById(state.budgets, pr.budgetId);
      const rule = state.approvalMatrix.find((r) => r.id === pr.approvalRuleId);
      const statusClass = pr.status.includes('Rejected') ? 'danger' : pr.status.includes('Pending') ? 'warning' : 'success';
      const currentLevel = getCurrentApprovalLevel(pr);
      const approvalStatus = pr.status === 'Approved'
        ? 'Siap diterbitkan PO'
        : currentLevel
        ? `Level ${currentLevel.index + 1}: ${currentLevel.roles.filter((r) => r.status === 'pending').map((r) => r.role).join(', ')}`
        : pr.status;
      const canCreatePO = pr.status === 'Approved' && !state.purchaseOrders.some((po) => po.prId === pr.id);
      return `
        <tr>
          <td>
            <strong>${pr.number}</strong>
            <div class="small">${formatDate(pr.requestDate)}</div>
          </td>
          <td>${requestor?.fullName || '-'}</td>
          <td>${dept?.name || '-'}</td>
          <td>${category?.name || '-'}</td>
          <td>${budget?.name || '-'}</td>
          <td>${formatCurrency(pr.totalAmount)}</td>
          <td><span class="badge ${statusClass}">${pr.status}</span></td>
          <td class="small">${approvalStatus}</td>
          <td>
            ${canCreatePO ? `<button class="table-action" data-create-po="${pr.id}">Buat PO</button>` : ''}
          </td>
        </tr>
      `;
    })
    .join('');
  elements.requisitionTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>PR</th>
          <th>Pemohon</th>
          <th>Departemen</th>
          <th>Kategori</th>
          <th>Anggaran</th>
          <th>Total</th>
          <th>Status</th>
          <th>Progress</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderApprovals() {
  const pending = state.requisitions.filter((pr) => pr.status === 'Pending Approval');
  if (pending.length === 0) {
    elements.approvalsList.innerHTML = '<div class="empty-state">Tidak ada persetujuan yang menunggu.</div>';
    return;
  }
  elements.approvalsList.innerHTML = pending
    .map((pr) => {
      const current = getCurrentApprovalLevel(pr);
      const rule = state.approvalMatrix.find((r) => r.id === pr.approvalRuleId);
      const levelBlocks = pr.approvalProgress
        .map((level, levelIndex) => {
          const levelStatus = level.completed ? 'Selesai' : 'Berjalan';
          const levelClass = level.completed ? 'success' : 'warning';
          const roleBlocks = level.roles
            .map((role, roleIndex) => {
              if (role.status === 'approved' || role.status === 'rejected') {
                return `
                  <div class="highlight">
                    <div class="flex-between">
                      <div>
                        <strong>${role.role}</strong>
                        <div class="small">${role.status === 'approved' ? 'Disetujui' : 'Ditolak'} oleh ${resolveEmployeeName(role.actorId)}</div>
                      </div>
                      <span class="small">${formatDateTime(role.decidedAt)}</span>
                    </div>
                  </div>
                `;
              }
              const options = role.candidates.length
                ? role.candidates.map((emp) => `<option value="${emp.id}">${emp.fullName}</option>`).join('')
                : '<option value="">Tidak ada kandidat</option>';
              const disabled = role.candidates.length === 0 ? 'disabled' : '';
              return `
                <div class="highlight">
                  <strong>${role.role}</strong>
                  <div class="small">${level.type === 'parallel' ? 'Paralel' : 'Sekuensial'}</div>
                  <div class="inline-actions" style="margin-top: 8px;">
                    <select data-approver-select data-pr="${pr.id}" data-level="${levelIndex}" data-role="${roleIndex}" ${disabled}>
                      ${options}
                    </select>
                    <button class="approve" data-approve data-pr="${pr.id}" data-level="${levelIndex}" data-role="${roleIndex}" ${disabled}>Setujui</button>
                    <button class="reject" data-reject data-pr="${pr.id}" data-level="${levelIndex}" data-role="${roleIndex}" ${disabled}>Tolak</button>
                  </div>
                </div>
              `;
            })
            .join('');
          return `
            <details ${current === level ? 'open' : ''}>
              <summary>Level ${level.index + 1} • <span class="badge ${levelClass}">${levelStatus}</span></summary>
              <div class="list-grid">${roleBlocks}</div>
            </details>
          `;
        })
        .join('');
      return `
        <div class="card">
          <div class="flex-between">
            <div>
              <strong>${pr.number}</strong>
              <div class="small">${formatCurrency(pr.totalAmount)} • ${rule?.name || 'Aturan tidak ditemukan'}</div>
            </div>
            <span class="state-pill">${current ? `Level ${current.index + 1}` : 'Selesai'}</span>
          </div>
          <div class="list-grid" style="margin-top: 16px;">
            ${levelBlocks}
          </div>
        </div>
      `;
    })
    .join('');
}

function renderPurchaseOrders() {
  if (state.purchaseOrders.length === 0) {
    elements.poTable.innerHTML = '<div class="empty-state">Belum ada Purchase Order.</div>';
    elements.poDetail.innerHTML = '<div class="empty-state">Pilih PO untuk melihat detail.</div>';
    return;
  }
  const rows = state.purchaseOrders
    .map((po) => {
      const vendor = findById(state.vendors, po.vendorId);
      const pendingReceipt = po.status === 'Issued';
      const pendingInvoice = po.status === 'Received';
      return `
        <tr data-select-po="${po.id}" class="po-row ${selectedPoId === po.id ? 'active' : ''}">
          <td>
            <strong>${po.number}</strong>
            <div class="small">${formatDate(po.orderDate)}</div>
          </td>
          <td>${findById(state.requisitions, po.prId)?.number || '-'}</td>
          <td>${vendor?.name || '-'}</td>
          <td>${formatCurrency(po.totalAmount)}</td>
          <td><span class="badge ${po.status === 'Closed' ? 'success' : 'warning'}">${po.status}</span></td>
          <td class="inline-actions">
            ${pendingReceipt ? `<button data-goods-receipt="${po.id}">Terima Barang</button>` : ''}
            ${pendingInvoice ? `<button data-record-invoice="${po.id}">Catat Faktur</button>` : ''}
            <button data-view-po="${po.id}">Detail</button>
          </td>
        </tr>
      `;
    })
    .join('');
  elements.poTable.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>PO</th>
          <th>PR Asal</th>
          <th>Vendor</th>
          <th>Total</th>
          <th>Status</th>
          <th>Aksi</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
  if (!selectedPoId && state.purchaseOrders.length > 0) {
    selectedPoId = state.purchaseOrders[0].id;
  }
  renderPurchaseOrderDetail();
}

function renderPurchaseOrderDetail() {
  const po = selectedPoId ? findById(state.purchaseOrders, selectedPoId) : null;
  if (!po) {
    elements.poDetail.innerHTML = '<div class="empty-state">Pilih PO untuk melihat detail.</div>';
    return;
  }
  const pr = findById(state.requisitions, po.prId);
  const vendor = findById(state.vendors, po.vendorId);
  const items = po.items
    .map((item) => `<li>${item.description} • Qty ${item.quantity} • ${formatCurrency(item.total)}</li>`)
    .join('');
  const receiptTimeline = po.receipts
    .map((gr) => `<li><strong>${gr.reference}</strong> diterima ${formatDateTime(gr.receiptDate)} oleh ${resolveEmployeeName(gr.receivedBy)}</li>`)
    .join('');
  const invoiceTimeline = po.invoices
    .map((inv) => `<li><strong>${inv.invoiceNumber}</strong> divalidasi ${formatDateTime(inv.invoiceDate)} oleh ${resolveEmployeeName(inv.processedBy)}</li>`)
    .join('');
  const history = (po.history || [])
    .map((entry) => `<li><strong>${entry.action}</strong> oleh ${resolveEmployeeName(entry.actorId)} • ${formatDateTime(entry.timestamp)}${entry.notes ? ` — ${entry.notes}` : ''}</li>`)
    .join('');
  elements.poDetail.innerHTML = `
    <div class="list-grid">
      <div>
        <h3>${po.number}</h3>
        <p class="small">Vendor: ${vendor?.name || '-'} • Total ${formatCurrency(po.totalAmount)}</p>
        <div class="highlight">
          <strong>Item</strong>
          <ul>${items}</ul>
        </div>
      </div>
      <div>
        <h3>Penerimaan</h3>
        ${receiptTimeline ? `<ul class="timeline">${receiptTimeline}</ul>` : '<div class="small">Belum ada penerimaan.</div>'}
      </div>
      <div>
        <h3>Faktur</h3>
        ${invoiceTimeline ? `<ul class="timeline">${invoiceTimeline}</ul>` : '<div class="small">Belum ada faktur.</div>'}
      </div>
      <div>
        <h3>Jejak Audit</h3>
        ${history ? `<ul class="timeline">${history}</ul>` : '<div class="small">Belum ada histori.</div>'}
      </div>
      ${pr ? `<div><h3>Referensi PR</h3><div class="highlight">${pr.number} • ${formatCurrency(pr.totalAmount)} • ${pr.status}</div></div>` : ''}
    </div>
  `;
}

function renderAnalytics() {
  const topBudgets = [...state.budgets]
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 3)
    .map((budget) => `<li><strong>${budget.name}</strong> • ${formatCurrency(budget.spent)} (${((budget.spent / budget.allocation) * 100 || 0).toFixed(1)}% dari alokasi)</li>`)
    .join('');

  const approvalDurations = state.requisitions
    .filter((pr) => pr.history?.length)
    .map((pr) => {
      const submitted = pr.history.find((h) => h.action === 'Diajukan');
      const approved = pr.history.find((h) => h.action === 'Selesai Disetujui');
      if (!submitted || !approved) return null;
      const duration = (new Date(approved.timestamp).getTime() - new Date(submitted.timestamp).getTime()) / (1000 * 60 * 60);
      return duration;
    })
    .filter((value) => value != null);
  const avgApprovalHours = approvalDurations.length
    ? (approvalDurations.reduce((sum, value) => sum + value, 0) / approvalDurations.length).toFixed(1)
    : '—';

  const vendorCoverage = state.categories
    .map((cat) => {
      const count = state.vendors.filter((vendor) => vendor.categories.includes(cat.id)).length;
      return `<li>${cat.name}: <strong>${count}</strong> vendor</li>`;
    })
    .join('');

  elements.analyticsContent.innerHTML = `
    <div class="highlight">
      <h3>3 Anggaran Dengan Realisasi Terbesar</h3>
      <ul>${topBudgets || '<li>Belum ada realisasi.</li>'}</ul>
    </div>
    <div class="highlight">
      <h3>Rata-rata SLA Persetujuan</h3>
      <p class="small">${avgApprovalHours === '—' ? 'Belum ada PR selesai.' : `${avgApprovalHours} jam dari pengajuan sampai final approval.`}</p>
    </div>
    <div class="highlight">
      <h3>Ketersediaan Vendor per Kategori</h3>
      <ul>${vendorCoverage}</ul>
    </div>
  `;
}

function renderConfig() {
  const deptList = state.departments
    .map((dept) => `<li>${dept.code} — ${dept.name}${dept.parentId ? ` (Parent: ${findById(state.departments, dept.parentId)?.name})` : ''}</li>`)
    .join('');
  const categoryList = state.categories
    .map((cat) => `<li>${cat.name} (${cat.type})</li>`)
    .join('');
  const matrixList = state.approvalMatrix
    .map((rule) => {
      const levelDesc = rule.levels
        .map((level, index) => `Level ${index + 1}: ${level.type === 'parallel' ? 'Paralel' : 'Sekuensial'} → ${level.roles.join(', ')}`)
        .join('<br/>');
      return `
        <li>
          <strong>${rule.name}</strong><br/>
          Departemen: ${rule.departments.join(', ')}<br/>
          Kategori: ${rule.categories.join(', ')}<br/>
          Nilai: ${formatCurrency(rule.minAmount)} - ${rule.maxAmount ? formatCurrency(rule.maxAmount) : 'Tanpa Batas'}<br/>
          ${levelDesc}
        </li>
      `;
    })
    .join('');
  const roleMap = {};
  state.employees.forEach((emp) => {
    emp.roles.forEach((role) => {
      if (!roleMap[role]) roleMap[role] = [];
      roleMap[role].push(emp.fullName);
    });
  });
  const roleList = Object.entries(roleMap)
    .map(([role, names]) => `<li><strong>${role}</strong>: ${names.join(', ')}</li>`)
    .join('');
  elements.configContent.innerHTML = `
    <details open>
      <summary>Struktur Departemen</summary>
      <ul>${deptList}</ul>
    </details>
    <details>
      <summary>Kategori Pengadaan</summary>
      <ul>${categoryList}</ul>
    </details>
    <details>
      <summary>Matriks Persetujuan</summary>
      <ul>${matrixList}</ul>
    </details>
    <details>
      <summary>Peran & Penugasan</summary>
      <ul>${roleList}</ul>
    </details>
    <div class="code-block">
      ${JSON.stringify(state.approvalMatrix, null, 2)}
    </div>
  `;
}

function renderAll() {
  populateSelectOptions();
  renderDashboard();
  renderBudgets();
  renderVendors();
  renderRequisitions();
  renderApprovals();
  renderPurchaseOrders();
  renderAnalytics();
  renderConfig();
}

function handleGlobalClicks(event) {
  const approveBtn = event.target.closest('[data-approve]');
  if (approveBtn) {
    const prId = approveBtn.dataset.pr;
    const levelIndex = Number(approveBtn.dataset.level);
    const roleIndex = Number(approveBtn.dataset.role);
    const select = document.querySelector(`select[data-pr="${prId}"][data-level="${levelIndex}"][data-role="${roleIndex}"]`);
    const actorId = select?.value;
    if (!actorId) {
      window.alert('Tidak ada approver yang tersedia untuk peran ini.');
      return;
    }
    approveStep(prId, levelIndex, roleIndex, actorId);
    return;
  }

  const rejectBtn = event.target.closest('[data-reject]');
  if (rejectBtn) {
    const prId = rejectBtn.dataset.pr;
    const levelIndex = Number(rejectBtn.dataset.level);
    const roleIndex = Number(rejectBtn.dataset.role);
    const select = document.querySelector(`select[data-pr="${prId}"][data-level="${levelIndex}"][data-role="${roleIndex}"]`);
    const actorId = select?.value;
    if (!actorId) {
      window.alert('Pilih approver yang melakukan penolakan.');
      return;
    }
    if (window.confirm('Yakin menolak permintaan ini?')) {
      rejectStep(prId, levelIndex, roleIndex, actorId);
    }
    return;
  }

  const removeBtn = event.target.closest('[data-remove-item]');
  if (removeBtn) {
    const itemId = removeBtn.dataset.removeItem;
    removeItem(itemId);
    return;
  }

  const createPoBtn = event.target.closest('[data-create-po]');
  if (createPoBtn) {
    const prId = createPoBtn.dataset.createPo;
    createPurchaseOrder(prId);
    return;
  }

  const goodsBtn = event.target.closest('[data-goods-receipt]');
  if (goodsBtn) {
    recordGoodsReceipt(goodsBtn.dataset.goodsReceipt);
    return;
  }

  const invoiceBtn = event.target.closest('[data-record-invoice]');
  if (invoiceBtn) {
    recordInvoice(invoiceBtn.dataset.recordInvoice);
    return;
  }

  const viewPoBtn = event.target.closest('[data-view-po]');
  if (viewPoBtn) {
    selectedPoId = viewPoBtn.dataset.viewPo;
    renderPurchaseOrders();
    return;
  }

  const row = event.target.closest('[data-select-po]');
  if (row) {
    selectedPoId = row.dataset.selectPo;
    renderPurchaseOrders();
  }
}

document.addEventListener('click', handleGlobalClicks);
elements.addItemBtn.addEventListener('click', handleAddItem);
elements.budgetForm.addEventListener('submit', handleBudgetSubmit);
elements.vendorForm.addEventListener('submit', handleVendorSubmit);
elements.requisitionForm.addEventListener('submit', handleRequisitionSubmit);
elements.resetButton.addEventListener('click', () => {
  if (window.confirm('Reset seluruh data demo ke kondisi awal?')) {
    window.localStorage.removeItem(STORAGE_KEY);
    resetState();
  }
});

setupNavigation();
renderItemsList();
renderAll();
