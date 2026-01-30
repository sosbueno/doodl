/**
 * Vanilla JS Solana wallet connection (Phantom, Solflare, etc.)
 * No React, no build step - works with just npm start.
 */
(function () {
  'use strict';

  var container = document.getElementById('wallet-connect-header');
  if (!container) return;

  /* Grey, 3D, curved button; panel = grey bg, light text */
  var style = {
    connectBtn: 'background:linear-gradient(180deg,#9a9a9a 0%,#7a7a7a 50%,#6a6a6a 100%);color:#fff;border:none;padding:10px 22px;border-radius:14px;font-weight:700;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,0.28),0 4px 0 #5a5a5a,0 6px 14px rgba(0,0,0,0.4);text-shadow:1px 1px 0 rgba(0,0,0,0.3);font-family:Nunito,sans-serif;transition:all 0.15s ease;',
    disconnectBtn: 'padding:6px 12px;font-size:0.85em;background:linear-gradient(180deg,#6e6e6e 0%,#5a5a5a 100%);border:none;border-radius:10px;color:#f0f0f0;cursor:pointer;font-weight:600;box-shadow:inset 0 1px 0 rgba(255,255,255,0.12),0 2px 0 #4a4a4a;text-shadow:0 1px 0 rgba(0,0,0,0.3);transition:all 0.15s ease;',
    box: 'display:block;background:rgba(80,80,80,0.85);color:#f0f0f0;font-size:0.9em;padding:10px 14px;border-radius:12px;text-align:center;font-family:Nunito,sans-serif;box-shadow:inset 0 1px 0 rgba(255,255,255,0.08),0 3px 10px rgba(0,0,0,0.3);'
  };

  function getProvider() {
    if (window.phantom?.solana?.isPhantom) return window.phantom.solana;
    if (window.solflare?.isSolflare) return window.solflare;
    if (window.solana?.isPhantom) return window.solana;
    if (window.solana) return window.solana;
    return null;
  }

  function renderConnect() {
    var btn = '<button id="header-wallet-connect-btn" style="' + style.connectBtn + '" ';
    btn += 'onmouseover="this.style.background=\'linear-gradient(180deg,#a5a5a5 0%,#858585 50%,#757575 100%)\';this.style.boxShadow=\'inset 0 1px 0 rgba(255,255,255,0.3),0 5px 0 #5a5a5a,0 8px 18px rgba(0,0,0,0.45)\';this.style.transform=\'translateY(-1px)\'" ';
    btn += 'onmouseout="this.style.background=\'linear-gradient(180deg,#9a9a9a 0%,#7a7a7a 50%,#6a6a6a 100%)\';this.style.boxShadow=\'inset 0 1px 0 rgba(255,255,255,0.28),0 4px 0 #5a5a5a,0 6px 14px rgba(0,0,0,0.4)\';this.style.transform=\'translateY(0)\'" ';
    btn += 'onmousedown="this.style.transform=\'translateY(3px)\';this.style.boxShadow=\'inset 0 1px 0 rgba(255,255,255,0.1),0 1px 0 #5a5a5a,0 2px 6px rgba(0,0,0,0.35)\'" ';
    btn += 'onmouseup="this.style.transform=\'translateY(0)\';this.style.boxShadow=\'inset 0 1px 0 rgba(255,255,255,0.28),0 4px 0 #5a5a5a,0 6px 14px rgba(0,0,0,0.4)\'">Connect Wallet</button>';
    container.innerHTML = btn;
    container.querySelector('#header-wallet-connect-btn').onclick = connect;
  }

  function renderConnected(address) {
    var short = address ? address.slice(0, 4) + '...' + address.slice(-4) : '';
    container.innerHTML =
      '<div id="header-wallet-info" style="' + style.box + '">' +
      '<div id="header-wallet-address" style="margin-bottom:6px;font-weight:600">' + short + '</div>' +
      '<button id="header-wallet-disconnect" style="' + style.disconnectBtn + '" onmouseover="this.style.background=\'linear-gradient(180deg,#7e7e7e 0%,#686868 100%)\';this.style.boxShadow=\'inset 0 1px 0 rgba(255,255,255,0.15),0 3px 0 #4a4a4a\'" onmouseout="this.style.background=\'linear-gradient(180deg,#6e6e6e 0%,#5a5a5a 100%)\';this.style.boxShadow=\'inset 0 1px 0 rgba(255,255,255,0.12),0 2px 0 #4a4a4a\'" onmousedown="this.style.transform=\'translateY(2px)\';this.style.boxShadow=\'inset 0 1px 0 rgba(0,0,0,0.1),0 0 0 1px #4a4a4a\'" onmouseup="this.style.transform=\'translateY(0)\';this.style.boxShadow=\'inset 0 1px 0 rgba(255,255,255,0.12),0 2px 0 #4a4a4a\'">Disconnect</button>' +
      '</div>';
    container.querySelector('#header-wallet-disconnect').onclick = disconnect;
  }

  var PROOF_KEY = 'doodls_wallet_proven';

  /** Ask wallet to sign a message to prove ownership (watched wallets cannot sign). */
  function requestOwnershipProof(provider, address) {
    var message = 'Sign to prove you own this wallet on doodls.fun\n' + Date.now();
    var messageBytes = new TextEncoder().encode(message);
    var signPromise = typeof provider.signMessage === 'function'
      ? provider.signMessage(messageBytes, 'utf8')
      : (typeof provider.request === 'function'
          ? provider.request({ method: 'signMessage', params: { message: messageBytes } })
          : Promise.reject(new Error('This wallet cannot sign messages')));
    return signPromise.then(function (out) {
      if (!out || (!out.signature && !out)) return Promise.reject(new Error('No signature'));
      try { sessionStorage.setItem(PROOF_KEY, address); } catch (e) {}
      return out;
    });
  }

  function hasProvenOwnership(address) {
    try { return sessionStorage.getItem(PROOF_KEY) === address; } catch (e) { return false; }
  }

  function clearProvenOwnership() {
    try { sessionStorage.removeItem(PROOF_KEY); } catch (e) {}
  }

  /** In-page toast (no browser alert popups). */
  function showToast(msg) {
    var id = 'wallet-toast-' + Date.now();
    var el = document.createElement('div');
    el.id = id;
    el.setAttribute('role', 'alert');
    el.style.cssText = 'position:fixed;bottom:24px;right:24px;max-width:320px;padding:12px 16px;background:rgba(60,60,60,0.95);color:#f0f0f0;border-radius:12px;font-family:Nunito,sans-serif;font-size:14px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.4);z-index:10001;cursor:pointer;';
    el.textContent = msg;
    el.onclick = function () { el.remove(); };
    document.body.appendChild(el);
    setTimeout(function () { if (el.parentNode) el.remove(); }, 5000);
  }

  function connect() {
    var provider = getProvider();
    if (!provider) {
      showToast('Install a Solana wallet (Phantom or Solflare) from phantom.app or solflare.com');
      return;
    }
    provider.connect()
      .then(function (res) {
        var pubkey = res.publicKey || (res && res.publicKey);
        if (!pubkey) return Promise.reject(new Error('No public key'));
        var address = typeof pubkey === 'string' ? pubkey : (pubkey.toBase58 ? pubkey.toBase58() : String(pubkey));
        return requestOwnershipProof(provider, address).then(
          function () {
            window.userWalletAddress = address;
            window.dispatchEvent(new CustomEvent('turnkey-wallet-connected', { detail: { address: address } }));
            var playBtn = document.getElementById('play-button');
            var createBtn = document.getElementById('create-button');
            if (playBtn) { playBtn.disabled = false; playBtn.style.opacity = '1'; playBtn.style.cursor = 'pointer'; }
            if (createBtn) { createBtn.disabled = false; createBtn.style.opacity = '1'; createBtn.style.cursor = 'pointer'; }
            renderConnected(address);
          },
          function (err) {
            if (provider.disconnect) provider.disconnect();
            var msg = (err && err.message) || '';
            if (/reject|denied|cancel/i.test(msg)) {
              showToast('Please sign the message in your wallet to prove you own it.');
            } else {
              showToast('Watched or read-only wallets cannot be used. Sign to prove ownership.');
            }
          }
        );
      })
      .catch(function (err) {
        console.error('Wallet connect error:', err);
        showToast('Could not connect. Try again or use another wallet.');
      });
  }

  function disconnect() {
    var provider = getProvider();
    if (provider && typeof provider.disconnect === 'function') provider.disconnect();
    clearProvenOwnership();
    window.userWalletAddress = null;
    window.dispatchEvent(new CustomEvent('turnkey-wallet-disconnected'));
    renderConnect();
    enableButtons();
  }

  function enableButtons() {
    var playBtn = document.getElementById('play-button');
    var createBtn = document.getElementById('create-button');
    if (playBtn) { playBtn.disabled = false; playBtn.style.opacity = '1'; playBtn.style.cursor = 'pointer'; }
    if (createBtn) { createBtn.disabled = false; createBtn.style.opacity = '1'; createBtn.style.cursor = 'pointer'; }
  }

  function init() {
    var provider = getProvider();
    if (provider && provider.isConnected && provider.publicKey) {
      var pk = provider.publicKey;
      var address = pk.toBase58 ? pk.toBase58() : String(pk);
      if (hasProvenOwnership(address)) {
        window.userWalletAddress = address;
        renderConnected(address);
        window.dispatchEvent(new CustomEvent('turnkey-wallet-connected', { detail: { address: address } }));
        setTimeout(enableButtons, 50);
      } else {
        renderConnect();
      }
    } else {
      clearProvenOwnership();
      renderConnect();
      enableButtons();
    }
    if (provider && provider.on) {
      provider.on('accountChanged', function () {
        clearProvenOwnership();
        var p = getProvider();
        if (!p || !p.publicKey) disconnect();
        else init();
      });
      provider.on('disconnect', function () { disconnect(); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
