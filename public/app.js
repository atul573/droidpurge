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
    const isCloud = !location.hostname.includes('localhost') && !location.hostname.includes('127.0.0.1');
    const isAdbMissing = e.message && e.message.toLowerCase().includes('adb');

    if (isCloud || isAdbMissing) {
      container.innerHTML = `
        <div class="setup-guide">
          <div class="setup-hero">
            <div class="setup-icon">🖥️</div>
            <h3>Run Locally to Manage Devices</h3>
            <p>This app requires a local connection to your Android phone via USB.<br>Follow these steps to get started in under 60 seconds.</p>
          </div>

          <div class="setup-steps">
            <div class="setup-step">
              <div class="setup-step-num">1</div>
              <div class="setup-step-content">
                <h4>Clone & Install</h4>
                <div class="code-block" onclick="copyCommand(this)">
                  <code>git clone https://github.com/atul573/droidpurge.git && cd droidpurge && npm install</code>
                  <span class="copy-hint">📋 Click to copy</span>
                </div>
              </div>
            </div>

            <div class="setup-step">
              <div class="setup-step-num">2</div>
              <div class="setup-step-content">
                <h4>Start the Server</h4>
                <div class="code-block" onclick="copyCommand(this)">
                  <code>npm start</code>
                  <span class="copy-hint">📋 Click to copy</span>
                </div>
              </div>
            </div>

            <div class="setup-step">
              <div class="setup-step-num">3</div>
              <div class="setup-step-content">
                <h4>Open in Browser</h4>
                <div class="code-block" onclick="copyCommand(this)">
                  <code>http://localhost:3000</code>
                  <span class="copy-hint">📋 Click to copy</span>
                </div>
              </div>
            </div>
          </div>

          <div class="setup-prereqs">
            <h4>Prerequisites</h4>
            <div class="prereq-grid">
              <div class="prereq-item">
                <span class="prereq-icon">📦</span>
                <div>
                  <strong>Node.js 18+</strong>
                  <span class="prereq-link"><a href="https://nodejs.org" target="_blank">nodejs.org</a></span>
                </div>
              </div>
              <div class="prereq-item">
                <span class="prereq-icon">🤖</span>
                <div>
                  <strong>ADB (Android Debug Bridge)</strong>
                  <span class="prereq-link">brew install android-platform-tools</span>
                </div>
              </div>
              <div class="prereq-item">
                <span class="prereq-icon">📱</span>
                <div>
                  <strong>USB Debugging Enabled</strong>
                  <span class="prereq-link">Settings → Developer Options</span>
                </div>
              </div>
            </div>
          </div>

          <a href="https://github.com/atul573/droidpurge" target="_blank" class="btn btn-primary" style="margin-top:8px;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            View on GitHub
          </a>
        </div>`;
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <p>Error: ${e.message}</p>
          <p style="font-size:0.78rem; margin-top:4px;">Make sure ADB is running</p>
        </div>`;
    }
  }
}

// ── Copy to clipboard helper ──
function copyCommand(el) {
  const code = el.querySelector('code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const hint = el.querySelector('.copy-hint');
    hint.textContent = '✅ Copied!';
    hint.style.color = 'var(--accent)';
    setTimeout(() => {
      hint.textContent = '📋 Click to copy';
      hint.style.color = '';
    }, 2000);
  });
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
