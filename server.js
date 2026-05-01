const express = require('express');
const cors = require('cors');
const { exec } = require('child_process');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: run a shell command and return stdout
function run(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout.trim());
    });
  });
}

// GET /api/devices — list connected devices
app.get('/api/devices', async (_req, res) => {
  try {
    const raw = await run('adb devices -l');
    const lines = raw.split('\n').slice(1).filter(l => l.trim());
    const devices = lines.map(line => {
      const parts = line.split(/\s+/);
      const serial = parts[0];
      const state = parts[1]; // device | offline | unauthorized
      const props = {};
      parts.slice(2).forEach(p => {
        const [k, v] = p.split(':');
        if (k && v) props[k] = v;
      });
      return {
        serial,
        state,
        model: props.model || 'Unknown',
        product: props.product || '',
        device: props.device || '',
        transportId: props.transport_id || ''
      };
    });
    res.json({ ok: true, devices });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/packages?serial=XXXX — list installed packages
app.get('/api/packages', async (req, res) => {
  const { serial } = req.query;
  if (!serial) return res.status(400).json({ ok: false, error: 'Missing serial' });

  try {
    // Get all third-party (user) packages
    const raw = await run(`adb -s ${serial} shell pm list packages -3`);
    const packages = raw
      .split('\n')
      .map(l => l.replace('package:', '').trim())
      .filter(Boolean)
      .sort();

    // Try to get friendly names via dumpsys (batch)
    const enriched = [];
    for (const pkg of packages) {
      let label = pkg;
      try {
        // Try getting app label from aapt on device
        const apkPath = await run(
          `adb -s ${serial} shell pm path ${pkg}`
        );
        const apk = apkPath.replace('package:', '').trim();
        if (apk) {
          const dumpRaw = await run(
            `adb -s ${serial} shell "dumpsys package ${pkg} | grep 'versionName'"`
          );
          const versionMatch = dumpRaw.match(/versionName=([^\s]+)/);
          const version = versionMatch ? versionMatch[1] : '';
          enriched.push({ packageName: pkg, label, version, apkPath: apk });
          continue;
        }
      } catch { /* ignore */ }
      enriched.push({ packageName: pkg, label, version: '', apkPath: '' });
    }

    res.json({ ok: true, packages: enriched, total: enriched.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// GET /api/packages/all?serial=XXXX — list ALL packages (system + user)
app.get('/api/packages/all', async (req, res) => {
  const { serial } = req.query;
  if (!serial) return res.status(400).json({ ok: false, error: 'Missing serial' });

  try {
    const raw = await run(`adb -s ${serial} shell pm list packages`);
    const packages = raw
      .split('\n')
      .map(l => l.replace('package:', '').trim())
      .filter(Boolean)
      .sort();

    const enriched = packages.map(pkg => ({
      packageName: pkg,
      label: pkg,
      version: '',
      apkPath: ''
    }));

    res.json({ ok: true, packages: enriched, total: enriched.length });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// POST /api/uninstall — uninstall selected packages
app.post('/api/uninstall', async (req, res) => {
  const { serial, packages } = req.body;
  if (!serial || !packages || !packages.length) {
    return res.status(400).json({ ok: false, error: 'Missing serial or packages' });
  }

  const results = [];
  for (const pkg of packages) {
    try {
      const out = await run(`adb -s ${serial} uninstall ${pkg}`);
      results.push({ packageName: pkg, success: out.includes('Success'), message: out });
    } catch (e) {
      results.push({ packageName: pkg, success: false, message: e.message });
    }
  }

  res.json({ ok: true, results });
});

// POST /api/uninstall-system — disable/uninstall system packages (requires --user 0)
app.post('/api/uninstall-system', async (req, res) => {
  const { serial, packages } = req.body;
  if (!serial || !packages || !packages.length) {
    return res.status(400).json({ ok: false, error: 'Missing serial or packages' });
  }

  const results = [];
  for (const pkg of packages) {
    try {
      const out = await run(`adb -s ${serial} shell pm uninstall -k --user 0 ${pkg}`);
      results.push({ packageName: pkg, success: out.includes('Success'), message: out });
    } catch (e) {
      results.push({ packageName: pkg, success: false, message: e.message });
    }
  }

  res.json({ ok: true, results });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`\n🤖 ADB Manager running at http://localhost:${PORT}\n`);
});

// Export for Vercel serverless
module.exports = app;
