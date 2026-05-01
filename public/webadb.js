/* ═══════════════════════════════════════════════════════════════
   WebADB — Browser-native ADB over WebUSB
   Implements the ADB protocol directly in the browser.
   No server, no Node.js, no ADB binary required.
   Works on Chrome/Edge (WebUSB support required).
   ═══════════════════════════════════════════════════════════════ */

const ADB_CLASS = 0xFF;
const ADB_SUBCLASS = 0x42;
const ADB_PROTOCOL = 0x01;

// ADB protocol constants
const A_CNXN = 0x4e584e43; // CNXN
const A_AUTH = 0x48545541; // AUTH
const A_OPEN = 0x4e45504f; // OPEN
const A_OKAY = 0x59414b4f; // OKAY
const A_CLSE = 0x45534c43; // CLSE
const A_WRTE = 0x45545257; // WRTE

const ADB_VERSION = 0x01000001;
const MAX_PAYLOAD = 256 * 1024;

const AUTH_TOKEN = 1;
const AUTH_SIGNATURE = 2;
const AUTH_RSAPUBLICKEY = 3;

class WebADB {
  constructor() {
    this.device = null;
    this.interfaceNum = -1;
    this.endpointIn = -1;
    this.endpointOut = -1;
    this.localId = 1;
    this.connected = false;
    this.keyPair = null;
  }

  /* ── Check if WebUSB is supported ── */
  static isSupported() {
    return !!navigator.usb;
  }

  /* ── Request and connect to an Android device ── */
  async connect() {
    if (!WebADB.isSupported()) {
      throw new Error('WebUSB is not supported in this browser. Use Chrome or Edge.');
    }

    // Request device with ADB interface filter
    this.device = await navigator.usb.requestDevice({
      filters: [
        { classCode: ADB_CLASS, subclassCode: ADB_SUBCLASS, protocolCode: ADB_PROTOCOL }
      ]
    });

    await this.device.open();

    // Find the ADB interface
    const config = this.device.configuration || this.device.configurations[0];
    if (!this.device.configuration) {
      await this.device.selectConfiguration(config.configurationValue);
    }

    let foundInterface = false;
    for (const iface of config.interfaces) {
      for (const alt of iface.alternates) {
        if (alt.interfaceClass === ADB_CLASS &&
            alt.interfaceSubclass === ADB_SUBCLASS &&
            alt.interfaceProtocol === ADB_PROTOCOL) {
          this.interfaceNum = iface.interfaceNumber;

          for (const ep of alt.endpoints) {
            if (ep.direction === 'in') this.endpointIn = ep.endpointNumber;
            if (ep.direction === 'out') this.endpointOut = ep.endpointNumber;
          }
          foundInterface = true;
          break;
        }
      }
      if (foundInterface) break;
    }

    if (!foundInterface) {
      throw new Error('No ADB interface found on device. Enable USB debugging on your phone.');
    }

    await this.device.claimInterface(this.interfaceNum);

    // Generate RSA key pair for authentication
    await this._generateKeyPair();

    // Perform ADB handshake
    await this._handshake();

    this.connected = true;
    return this._getDeviceInfo();
  }

  /* ── Disconnect ── */
  async disconnect() {
    if (this.device) {
      try {
        await this.device.releaseInterface(this.interfaceNum);
        await this.device.close();
      } catch (e) {
        // Ignore close errors
      }
      this.device = null;
      this.connected = false;
    }
  }

  /* ── Get device info ── */
  _getDeviceInfo() {
    return {
      serial: this.device.serialNumber || 'unknown',
      model: this.device.productName || 'Android Device',
      manufacturer: this.device.manufacturerName || 'Unknown',
      state: 'device'
    };
  }

  /* ── Generate RSA key pair for ADB auth ── */
  async _generateKeyPair() {
    // Check if we have stored keys
    const storedKey = localStorage.getItem('adb_private_key');
    if (storedKey) {
      try {
        const keyData = JSON.parse(storedKey);
        this.keyPair = await crypto.subtle.importKey(
          'jwk', keyData.privateKey,
          { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-1' },
          true, ['sign']
        );
        this.publicKeyBytes = this._base64ToArray(keyData.publicKey);
        return;
      } catch (e) {
        // Key corrupted, regenerate
      }
    }

    // Generate new key pair
    const pair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
        hash: 'SHA-1'
      },
      true,
      ['sign', 'verify']
    );

    this.keyPair = pair.privateKey;

    // Export public key in the format ADB expects
    const pubKeyDer = await crypto.subtle.exportKey('spki', pair.publicKey);
    const privKeyJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);

    // Convert public key to ADB format (Android RSA public key format)
    this.publicKeyBytes = this._formatAdbPublicKey(pubKeyDer);

    // Store for reuse
    localStorage.setItem('adb_private_key', JSON.stringify({
      privateKey: privKeyJwk,
      publicKey: this._arrayToBase64(this.publicKeyBytes)
    }));
  }

  /* ── Format public key for ADB ── */
  _formatAdbPublicKey(derKey) {
    // ADB expects the public key as base64-encoded DER with " user@host\0"
    const b64 = btoa(String.fromCharCode(...new Uint8Array(derKey)));
    const suffix = ' DroidPurge@WebUSB\0';
    const encoder = new TextEncoder();
    const keyStr = b64 + suffix;
    return encoder.encode(keyStr);
  }

  /* ── ADB protocol handshake ── */
  async _handshake() {
    const hostBanner = 'host::features=shell_v2,cmd,stat_v2,ls_v2,fixed_push_mkdir,apex,abb,fixed_push_symlink_timestamp,abb_exec,remount_shell,track_app,sendrecv_v2,sendrecv_v2_brotli,sendrecv_v2_lz4,sendrecv_v2_zstd,sendrecv_v2_dry_run_send,openscreen_mdns,delayed_ack';
    const bannerBytes = new TextEncoder().encode(hostBanner);

    // Send CNXN
    await this._sendMessage(A_CNXN, ADB_VERSION, MAX_PAYLOAD, bannerBytes);

    // Read response
    let maxAttempts = 20;
    while (maxAttempts-- > 0) {
      const msg = await this._receiveMessage();

      if (msg.command === A_CNXN) {
        // Connected!
        return;
      }

      if (msg.command === A_AUTH) {
        if (msg.arg0 === AUTH_TOKEN) {
          // Try to sign the token
          try {
            const signature = await crypto.subtle.sign(
              'RSASSA-PKCS1-v1_5',
              this.keyPair,
              msg.data
            );
            await this._sendMessage(A_AUTH, AUTH_SIGNATURE, 0, new Uint8Array(signature));

            // Wait for response
            const signResp = await this._receiveMessage();
            if (signResp.command === A_CNXN) {
              return; // Authenticated with existing key
            }
          } catch (e) {
            // Signature failed, send public key
          }

          // Send public key - user needs to accept on phone
          await this._sendMessage(A_AUTH, AUTH_RSAPUBLICKEY, 0, this.publicKeyBytes);

          // Wait for user to accept on phone (with timeout)
          const startTime = Date.now();
          const timeout = 60000; // 60 seconds to accept

          while (Date.now() - startTime < timeout) {
            try {
              const resp = await this._receiveMessageWithTimeout(2000);
              if (resp.command === A_CNXN) {
                return; // User accepted!
              }
            } catch (e) {
              // Timeout, keep waiting
              continue;
            }
          }
          throw new Error('Authentication timeout. Please accept the USB debugging prompt on your phone.');
        }
      }
    }
    throw new Error('Failed to complete ADB handshake');
  }

  /* ── Execute shell command ── */
  async shell(command) {
    const localId = this.localId++;
    const destination = `shell:${command}`;
    const destBytes = new TextEncoder().encode(destination + '\0');

    // Send OPEN
    await this._sendMessage(A_OPEN, localId, 0, destBytes);

    // Read OKAY
    const okay = await this._receiveMessage();
    if (okay.command !== A_OKAY) {
      throw new Error('Failed to open shell stream');
    }
    const remoteId = okay.arg0;

    // Read all data until CLSE
    let output = '';
    const decoder = new TextDecoder();

    while (true) {
      const msg = await this._receiveMessage();

      if (msg.command === A_WRTE) {
        output += decoder.decode(msg.data);
        // Send OKAY to acknowledge
        await this._sendMessage(A_OKAY, localId, remoteId);
      } else if (msg.command === A_CLSE) {
        // Send CLSE back
        await this._sendMessage(A_CLSE, localId, remoteId);
        break;
      }
    }

    return output;
  }

  /* ── Low-level: Send ADB message ── */
  async _sendMessage(command, arg0, arg1, data = null) {
    const dataBytes = data || new Uint8Array(0);
    const header = new ArrayBuffer(24);
    const view = new DataView(header);

    view.setUint32(0, command, true);
    view.setUint32(4, arg0, true);
    view.setUint32(8, arg1, true);
    view.setUint32(12, dataBytes.length, true);
    view.setUint32(16, this._checksum(dataBytes), true);
    view.setUint32(20, command ^ 0xFFFFFFFF, true);

    await this.device.transferOut(this.endpointOut, header);

    if (dataBytes.length > 0) {
      await this.device.transferOut(this.endpointOut, dataBytes);
    }
  }

  /* ── Low-level: Receive ADB message ── */
  async _receiveMessage() {
    const headerResult = await this.device.transferIn(this.endpointIn, 24);
    const view = new DataView(headerResult.data.buffer);

    const command = view.getUint32(0, true);
    const arg0 = view.getUint32(4, true);
    const arg1 = view.getUint32(8, true);
    const dataLength = view.getUint32(12, true);

    let data = new Uint8Array(0);
    if (dataLength > 0) {
      let received = new Uint8Array(0);
      let remaining = dataLength;

      while (remaining > 0) {
        const chunk = await this.device.transferIn(this.endpointIn, remaining);
        const chunkData = new Uint8Array(chunk.data.buffer);
        const merged = new Uint8Array(received.length + chunkData.length);
        merged.set(received);
        merged.set(chunkData, received.length);
        received = merged;
        remaining -= chunkData.length;
      }
      data = received;
    }

    return { command, arg0, arg1, data };
  }

  /* ── Receive with timeout ── */
  async _receiveMessageWithTimeout(timeoutMs) {
    return Promise.race([
      this._receiveMessage(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      )
    ]);
  }

  /* ── Checksum ── */
  _checksum(data) {
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return sum & 0xFFFFFFFF;
  }

  /* ── Utility ── */
  _base64ToArray(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  _arrayToBase64(arr) {
    return btoa(String.fromCharCode(...arr));
  }
}

/* ── Exported API for DroidPurge ── */
window.WebADB = WebADB;
