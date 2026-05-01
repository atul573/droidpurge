/* ═══════════════════════════════════════════
   ADB App Manager — Client Logic
   ═══════════════════════════════════════════ */

const API = '';  // same origin

let state = {
  devices: [],
  selectedDevice: null,
  packages: [],
  filteredPackages: [],
  selectedPackages: new Set(),
  filter: 'user',  // 'user' | 'all'
  pendingUninstall: [],
};

// ── Init ──
document.addEventListener('DOMContentLoaded', () => {
  loadDevices();
});

// ── Device Management ──
async function loadDevices() {
  const container = document.getElementById('device-list');
  container.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Scanning for devices…</p></div>`;

  try {
    const res = await fetch(`${API}/api/devices`);
    const data = await res.json();

    if (!data.ok) throw new Error(data.error);

    state.devices = data.devices;

    if (state.devices.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📱</div>
          <p>No devices found</p>
          <p style="font-size:0.78rem; margin-top:4px; color:var(--text-tertiary);">
            Connect an Android device via USB and enable USB debugging
          </p>
        </div>`;
      return;
    }

    container.innerHTML = state.devices.map((d, i) => `
      <div class="device-card ${state.selectedDevice === d.serial ? 'selected' : ''}"
           onclick="selectDevice('${d.serial}')" id="device-${i}">
        <div class="device-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <rect x="5" y="2" width="14" height="20" rx="2"/>
            <line x1="12" y1="18" x2="12.01" y2="18"/>
          </svg>
        </div>
        <div class="device-info">
          <h3>${d.model}</h3>
          <p>${d.serial}</p>
        </div>
        <span class="device-state ${d.state === 'device' ? 'online' : d.state === 'unauthorized' ? 'unauthorized' : 'offline'}">
          ${d.state === 'device' ? 'Online' : d.state}
        </span>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>Error: ${e.message}</p>
        <p style="font-size:0.78rem; margin-top:4px;">Make sure ADB is running</p>
      </div>`;
  }
}

function selectDevice(serial) {
  const device = state.devices.find(d => d.serial === serial);
  if (!device || device.state !== 'device') return;

  state.selectedDevice = serial;

  // Update UI
  document.querySelectorAll('.device-card').forEach(el => el.classList.remove('selected'));
  const cards = document.querySelectorAll('.device-card');
  const idx = state.devices.findIndex(d => d.serial === serial);
  if (idx >= 0 && cards[idx]) cards[idx].classList.add('selected');

  // Show package section
  document.getElementById('package-section').classList.remove('hidden');
  document.getElementById('results-section').classList.add('hidden');

  loadPackages();
}

// ── Package Management ──
async function loadPackages() {
  const container = document.getElementById('package-list');
  const label = document.getElementById('pkg-count-label');
  container.innerHTML = `<div class="empty-state"><div class="spinner"></div><p>Fetching installed applications…</p></div>`;
  label.textContent = 'Loading packages…';

  state.selectedPackages.clear();
  updateSelectionUI();

  const endpoint = state.filter === 'all' ? '/api/packages/all' : '/api/packages';

  try {
    const res = await fetch(`${API}${endpoint}?serial=${state.selectedDevice}`);
    const data = await res.json();

    if (!data.ok) throw new Error(data.error);

    state.packages = data.packages;
    state.filteredPackages = [...state.packages];
    label.textContent = `${data.total} ${state.filter === 'all' ? 'total' : 'user'} apps found`;

    renderPackages();
  } catch (e) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <p>Error: ${e.message}</p>
      </div>`;
    label.textContent = 'Failed to load packages';
  }
}

function renderPackages() {
  const container = document.getElementById('package-list');

  if (state.filteredPackages.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <p>No packages match your search</p>
      </div>`;
    return;
  }

  container.innerHTML = state.filteredPackages.map(pkg => {
    const isSelected = state.selectedPackages.has(pkg.packageName);
    const initials = pkg.packageName.split('.').pop().substring(0, 2);
    return `
      <div class="package-item ${isSelected ? 'selected' : ''}"
           onclick="togglePackage('${pkg.packageName}')" id="pkg-${pkg.packageName.replace(/\./g, '-')}">
        <div class="checkbox"></div>
        <div class="pkg-icon">${initials}</div>
        <div class="pkg-info">
          <div class="pkg-name">${pkg.packageName}</div>
          ${pkg.version ? `<div class="pkg-version">v${pkg.version}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function togglePackage(pkgName) {
  if (state.selectedPackages.has(pkgName)) {
    state.selectedPackages.delete(pkgName);
  } else {
    state.selectedPackages.add(pkgName);
  }

  // Update item visually
  const el = document.getElementById(`pkg-${pkgName.replace(/\./g, '-')}`);
  if (el) el.classList.toggle('selected', state.selectedPackages.has(pkgName));

  updateSelectionUI();
}

function selectAll() {
  state.filteredPackages.forEach(pkg => state.selectedPackages.add(pkg.packageName));
  renderPackages();
  updateSelectionUI();
}

function deselectAll() {
  state.selectedPackages.clear();
  renderPackages();
  updateSelectionUI();
}

function updateSelectionUI() {
  const count = state.selectedPackages.size;
  document.getElementById('selected-count').textContent = `${count} selected`;
  document.getElementById('action-count').textContent = `${count} app${count !== 1 ? 's' : ''} selected`;

  const actionBar = document.getElementById('action-bar');
  if (count > 0) {
    actionBar.classList.remove('hidden');
  } else {
    actionBar.classList.add('hidden');
  }
}

function filterPackages() {
  const query = document.getElementById('search-input').value.toLowerCase();
  state.filteredPackages = state.packages.filter(pkg =>
    pkg.packageName.toLowerCase().includes(query)
  );
  renderPackages();
}

function setFilter(type) {
  state.filter = type;
  document.getElementById('btn-user-apps').classList.toggle('active', type === 'user');
  document.getElementById('btn-all-apps').classList.toggle('active', type === 'all');
  loadPackages();
}

// ── Uninstall Flow ──
function uninstallSelected() {
  const pkgs = Array.from(state.selectedPackages);
  if (pkgs.length === 0) return;

  state.pendingUninstall = pkgs;

  // Fill modal
  document.getElementById('confirm-text').innerHTML =
    `Are you sure you want to uninstall <strong>${pkgs.length}</strong> app${pkgs.length !== 1 ? 's' : ''}? This action cannot be undone.`;
  document.getElementById('confirm-list').innerHTML = pkgs.map(p => `• ${p}`).join('\n');

  document.getElementById('confirm-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('confirm-modal').classList.add('hidden');
}

async function confirmUninstall() {
  closeModal();

  const pkgs = state.pendingUninstall;
  if (pkgs.length === 0) return;

  // Show progress overlay
  const overlay = document.createElement('div');
  overlay.className = 'progress-overlay';
  overlay.id = 'progress-overlay';
  overlay.innerHTML = `
    <div class="spinner"></div>
    <p>Uninstalling applications…</p>
    <p class="progress-detail" id="progress-detail">0 / ${pkgs.length}</p>
  `;
  document.body.appendChild(overlay);

  const endpoint = state.filter === 'all' ? '/api/uninstall-system' : '/api/uninstall';

  try {
    const res = await fetch(`${API}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serial: state.selectedDevice,
        packages: pkgs,
      }),
    });

    const data = await res.json();

    // Remove overlay
    document.getElementById('progress-overlay')?.remove();

    if (!data.ok) throw new Error(data.error || 'Uninstall failed');

    // Show results
    showResults(data.results);
  } catch (e) {
    document.getElementById('progress-overlay')?.remove();
    alert('Error: ' + e.message);
  }
}

function showResults(results) {
  document.getElementById('package-section').classList.add('hidden');
  document.getElementById('results-section').classList.remove('hidden');
  document.getElementById('action-bar').classList.add('hidden');

  const container = document.getElementById('results-list');
  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  container.innerHTML = `
    <div style="padding:16px 24px; display:flex; gap:16px; flex-wrap:wrap;">
      <div class="badge" style="background:rgba(63,185,80,0.15); color:var(--success); font-size:0.85rem; padding:6px 14px;">
        ✓ ${successCount} succeeded
      </div>
      ${failCount > 0 ? `
        <div class="badge" style="background:var(--danger-dim); color:var(--danger); font-size:0.85rem; padding:6px 14px;">
          ✗ ${failCount} failed
        </div>
      ` : ''}
    </div>
    ${results.map(r => `
      <div class="result-item">
        <div class="result-icon ${r.success ? 'success' : 'fail'}">${r.success ? '✓' : '✗'}</div>
        <span class="result-pkg">${r.packageName}</span>
        <span class="result-status ${r.success ? 'success' : 'fail'}">${r.success ? 'Removed' : 'Failed'}</span>
      </div>
    `).join('')}
  `;
}

function reloadPackages() {
  state.selectedPackages.clear();
  document.getElementById('results-section').classList.add('hidden');
  document.getElementById('package-section').classList.remove('hidden');
  loadPackages();
}
