// Turnkey React App - Wallet Connection with Solana Support
import React from 'react';
import ReactDOM from 'react-dom/client';
import { TurnkeyProvider, useTurnkey } from '@turnkey/react-wallet-kit';

// Ensure we're in a browser environment
if (typeof window !== 'undefined') {
  // Polyfill for React Native storage detection
  window.navigator = window.navigator || {};
}

// Get Turnkey config from server
let TURNKEY_ORG_ID = '';
let TURNKEY_AUTH_PROXY_CONFIG_ID = '';
let TURNKEY_WALLETCONNECT_PROJECT_ID = '';

// Log current domain for debugging
console.log('Current origin:', window.location.origin);
console.log('Current hostname:', window.location.hostname);

// Fetch from server on init
fetch('/api/turnkey-config')
  .then(res => res.json())
  .then(config => {
    TURNKEY_ORG_ID = config.orgId;
    TURNKEY_AUTH_PROXY_CONFIG_ID = config.authProxyConfigId;
    TURNKEY_WALLETCONNECT_PROJECT_ID = config.walletConnectProjectId || '';
    console.log('Turnkey config loaded:', {
      orgId: TURNKEY_ORG_ID,
      authProxyConfigId: TURNKEY_AUTH_PROXY_CONFIG_ID
    });
  })
  .catch((err) => {
    console.warn('Failed to fetch Turnkey config, using defaults:', err);
    // Use defaults if fetch fails - you'll need to set these
    TURNKEY_ORG_ID = process.env.TURNKEY_ORG_ID || '';
    TURNKEY_AUTH_PROXY_CONFIG_ID = process.env.TURNKEY_AUTH_PROXY_CONFIG_ID || '';
  });

// Wallet Connect Component
function WalletConnectButton() {
  const { 
    isAuthenticated, 
    authenticate, 
    logout, 
    wallets, 
    createWallet,
    isLoading 
  } = useTurnkey();
  
  const [solanaWallet, setSolanaWallet] = React.useState(null);
  
  React.useEffect(() => {
    console.log('Turnkey wallet state changed:', { 
      isAuthenticated, 
      walletCount: wallets?.length || 0,
      isLoading 
    });
    
    // Find Solana wallet
    const solWallet = wallets?.find(w => 
      w.accounts?.some(acc => acc.addressFormat === 'ADDRESS_FORMAT_SOLANA')
    );
    
    if (solWallet) {
      const solanaAccount = solWallet.accounts?.find(acc => 
        acc.addressFormat === 'ADDRESS_FORMAT_SOLANA'
      );
      
      if (solanaAccount && solanaAccount.address) {
        setSolanaWallet({
          address: solanaAccount.address,
          walletId: solWallet.walletId,
          walletName: solWallet.walletName
        });
        
        // Set wallet address globally
        if (window.userWalletAddress !== solanaAccount.address) {
          window.userWalletAddress = solanaAccount.address;
          console.log('✅ Setting wallet address:', solanaAccount.address);
          console.log('✅ Dispatching turnkey-wallet-connected event');
          
          // Dispatch the event to enable play buttons
          const event = new CustomEvent('turnkey-wallet-connected', {
            detail: { address: solanaAccount.address }
          });
          window.dispatchEvent(event);
          
          // Show success notification
          setTimeout(() => {
            if (window.showTurnkeySuccessNotification) {
              window.showTurnkeySuccessNotification(solanaAccount.address);
            }
          }, 500);
          
          // Enable buttons
          setTimeout(() => {
            const playBtn = document.getElementById('play-button');
            const createBtn = document.getElementById('create-button');
            if (playBtn) {
              playBtn.disabled = false;
              playBtn.style.opacity = '1';
              playBtn.style.cursor = 'pointer';
              console.log('✅ Enabled play button');
            }
            if (createBtn) {
              createBtn.disabled = false;
              createBtn.style.opacity = '1';
              createBtn.style.cursor = 'pointer';
              console.log('✅ Enabled create button');
            }
          }, 100);
        }
      }
    } else if (!isLoading && !isAuthenticated && !wallets?.length) {
      // No wallets and not authenticated - clear wallet address
      if (window.userWalletAddress) {
        console.log('No wallets found and not authenticated, clearing wallet address');
        window.userWalletAddress = null;
        window.dispatchEvent(new CustomEvent('turnkey-wallet-disconnected'));
      }
      setSolanaWallet(null);
    }
  }, [isAuthenticated, wallets, isLoading]);
  
  const handleConnect = async () => {
    try {
      console.log('🔌 Attempting to connect wallet with Turnkey...');
      console.log('Current authenticated state:', isAuthenticated);
      
      if (!isAuthenticated) {
        // Authenticate first (this will show Turnkey's auth modal)
        console.log('📱 Opening Turnkey authentication...');
        await authenticate();
        console.log('✅ Authentication completed');
        
        // Wait a bit for wallets to load
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if we have wallets, if not create one
        if (!wallets || wallets.length === 0) {
          console.log('📱 No wallets found, creating embedded wallet with Solana account...');
          try {
            await createWallet({
              walletName: `Wallet ${Date.now()}`,
              accounts: ['ADDRESS_FORMAT_SOLANA']
            });
            console.log('✅ Wallet created successfully');
          } catch (createError) {
            console.error('❌ Error creating wallet:', createError);
            throw createError;
          }
        } else {
          // Check if any wallet has Solana account
          const hasSolana = wallets.some(w => 
            w.accounts?.some(acc => acc.addressFormat === 'ADDRESS_FORMAT_SOLANA')
          );
          
          if (!hasSolana) {
            console.log('📱 No Solana account found, creating one...');
            await createWallet({
              walletName: `Wallet ${Date.now()}`,
              accounts: ['ADDRESS_FORMAT_SOLANA']
            });
          }
        }
      } else {
        // Already authenticated - check for Solana wallet
        const solWallet = wallets?.find(w => 
          w.accounts?.some(acc => acc.addressFormat === 'ADDRESS_FORMAT_SOLANA')
        );
        
        if (!solWallet) {
          console.log('📱 Authenticated but no Solana wallet, creating one...');
          await createWallet({
            walletName: `Wallet ${Date.now()}`,
            accounts: ['ADDRESS_FORMAT_SOLANA']
          });
        }
      }
      
    } catch (error) {
      console.error('❌ Error connecting wallet:', error);
      console.error('Error details:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack
      });
      
      // Show user-friendly error notification
      const notification = document.createElement('div');
      notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #dc3545; color: #fff; padding: 15px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000; max-width: 300px; font-family: Nunito, sans-serif; font-weight: 600;';
      const errorMsg = error?.message || 'Unknown error';
      notification.innerHTML = `<div style="position: absolute; top: 5px; right: 5px; background: transparent; border: 1px solid rgba(255,255,255,0.5); color: #fff; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 18px; line-height: 1; display: flex; align-items: center; justify-content: center; padding: 0;" onclick="this.parentElement.remove()">×</div><div style="font-size: 16px; font-weight: 700; margin-bottom: 5px;">Connection Error</div><div style="font-size: 14px;">${errorMsg}</div>`;
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    }
  };
  
  const handleDisconnect = async () => {
    try {
      await logout();
      window.userWalletAddress = null;
      setSolanaWallet(null);
      window.dispatchEvent(new CustomEvent('turnkey-wallet-disconnected'));
    } catch (error) {
      console.error('Error disconnecting:', error);
    }
  };
  
  if (isLoading) {
    return (
      <button 
        disabled
        style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'not-allowed', opacity: 0.5 }}
      >
        Loading...
      </button>
    );
  }
  
  if (isAuthenticated && solanaWallet) {
    // User is authenticated and has a Solana wallet
    const address = solanaWallet.address || '';
    const shortAddress = address ? `${address.substring(0, 4)}...${address.substring(address.length - 4)}` : '';
    
    return (
      <div id="header-wallet-info" style={{ display: 'block', color: '#fff', fontSize: '0.9em', marginTop: '5px', textAlign: 'center' }}>
        <div id="header-wallet-address" style={{ marginBottom: '5px' }}>
          {shortAddress}
        </div>
        <button 
          id="header-wallet-disconnect" 
          onClick={handleDisconnect}
          style={{ padding: '5px 10px', fontSize: '0.8em', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '5px', color: '#fff', cursor: 'pointer' }}
        >
          Disconnect
        </button>
      </div>
    );
  }
  
  return (
    <button 
      id="header-wallet-connect-btn" 
      onClick={handleConnect}
      style={{ background: 'linear-gradient(135deg, #9945FF 0%, #14F195 100%)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 3px 8px rgba(0,0,0,0.3)' }}
    >
      <span id="wallet-btn-text">Connect Wallet</span>
    </button>
  );
}

// Main Turnkey App Component
function TurnkeyApp() {
  React.useEffect(() => {
    // Make success notification function globally available
    window.showTurnkeySuccessNotification = (walletAddress) => {
      const existing = document.getElementById('turnkey-success-notification');
      if (existing) {
        existing.remove();
      }
      
      const shortAddress = walletAddress ? `${walletAddress.substring(0, 4)}...${walletAddress.substring(walletAddress.length - 4)}` : '';
      
      const notification = document.createElement('div');
      notification.id = 'turnkey-success-notification';
      notification.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border: 2px solid #9945FF;
        border-radius: 16px;
        padding: 32px;
        box-shadow: 0 8px 32px rgba(153, 69, 255, 0.3);
        z-index: 10001;
        max-width: 400px;
        width: 90%;
        text-align: center;
        font-family: 'Nunito', sans-serif;
        color: #fff;
        animation: slideIn 0.3s ease-out;
      `;
      
      if (!document.getElementById('turnkey-success-animation')) {
        const style = document.createElement('style');
        style.id = 'turnkey-success-animation';
        style.textContent = `
          @keyframes slideIn {
            from {
              opacity: 0;
              transform: translate(-50%, -60%);
            }
            to {
              opacity: 1;
              transform: translate(-50%, -50%);
            }
          }
        `;
        document.head.appendChild(style);
      }
      
      notification.innerHTML = `
        <div style="margin-bottom: 20px;">
          <div style="
            width: 64px;
            height: 64px;
            margin: 0 auto;
            background: linear-gradient(135deg, #9945FF 0%, #14F195 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 32px;
            box-shadow: 0 4px 16px rgba(153, 69, 255, 0.4);
          ">
            ✓
          </div>
        </div>
        <h2 style="
          font-size: 24px;
          font-weight: 700;
          margin: 0 0 12px 0;
          color: #14F195;
        ">Wallet Connected Successfully!</h2>
        <p style="
          font-size: 16px;
          margin: 0 0 8px 0;
          color: rgba(255, 255, 255, 0.9);
        ">Your Solana wallet ${shortAddress ? `(${shortAddress})` : ''} is ready!</p>
        <p style="
          font-size: 14px;
          margin: 0 0 16px 0;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.4;
        ">💰 <strong>Rewards:</strong> When you win, rewards will be sent directly to this wallet. Just sign in with your email to claim them - no password needed!</p>
        <div style="
          margin-top: 24px;
          padding-top: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        ">
          <span>Secured by</span>
          <span style="
            background: linear-gradient(135deg, #9945FF 0%, #14F195 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            font-weight: 700;
          ">Turnkey</span>
        </div>
        <button onclick="this.closest('#turnkey-success-notification').remove()" style="
          margin-top: 20px;
          background: linear-gradient(135deg, #9945FF 0%, #14F195 100%);
          color: #fff;
          border: none;
          padding: 12px 32px;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
          font-size: 16px;
          font-family: 'Nunito', sans-serif;
          box-shadow: 0 4px 12px rgba(153, 69, 255, 0.3);
          transition: transform 0.2s;
        " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
          Continue
        </button>
      `;
      
      document.body.appendChild(notification);
      
      setTimeout(() => {
        if (notification.parentNode) {
          notification.style.animation = 'slideIn 0.3s ease-out reverse';
          setTimeout(() => notification.remove(), 300);
        }
      }, 5000);
    };
  }, []);
  
  // Wait for config to be loaded
  const [configReady, setConfigReady] = React.useState(false);
  
  React.useEffect(() => {
    // Check if config is available
    fetch('/api/turnkey-config')
      .then(res => res.json())
      .then(config => {
        if (config.orgId && config.authProxyConfigId) {
          setConfigReady(true);
        }
      })
      .catch(() => {
        // If API fails, check if we have env vars or defaults
        if (TURNKEY_ORG_ID && TURNKEY_AUTH_PROXY_CONFIG_ID) {
          setConfigReady(true);
        } else {
          console.warn('⚠️ Turnkey config not available. Please set TURNKEY_ORG_ID and TURNKEY_AUTH_PROXY_CONFIG_ID');
        }
      });
  }, []);
  
  if (!configReady) {
    return (
      <button 
        disabled
        style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'not-allowed', opacity: 0.5 }}
      >
        Initializing...
      </button>
    );
  }
  
  // Build config object - ensure all required fields are present
  if (!TURNKEY_ORG_ID || !TURNKEY_AUTH_PROXY_CONFIG_ID) {
    return (
      <button 
        disabled
        style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'not-allowed', opacity: 0.5 }}
      >
        Config Loading...
      </button>
    );
  }
  
  const turnkeyConfig = {
    organizationId: TURNKEY_ORG_ID,
    authProxyConfigId: TURNKEY_AUTH_PROXY_CONFIG_ID,
    auth: {
      methods: {
        passkeyAuthEnabled: false, // Disabled as requested
        walletAuthEnabled: true, // Enable external wallets
        emailOtpEnabled: true, // Enable email OTP
      }
    },
    walletConfig: {
      chains: {
        solana: {
          native: true, // Enable native Solana wallets (Phantom, Solflare, etc.)
          walletConnectNamespaces: TURNKEY_WALLETCONNECT_PROJECT_ID ? ['solana:mainnet'] : undefined
        }
      },
      walletConnect: TURNKEY_WALLETCONNECT_PROJECT_ID ? {
        projectId: TURNKEY_WALLETCONNECT_PROJECT_ID,
        appMetadata: {
          name: 'doodls.fun',
          description: 'Free multiplayer drawing and guessing game',
          url: window.location.origin,
          icons: [`${window.location.origin}/img/doodllogo.gif`]
        }
      } : undefined
    },
    ui: {
      darkMode: true,
      renderModalInProvider: true,
      borderRadius: '8px',
      backdropBlur: '10px'
    }
  };
  
  try {
    return (
      <TurnkeyProvider config={turnkeyConfig}>
        <WalletConnectButton />
      </TurnkeyProvider>
    );
  } catch (error) {
    console.error('TurnkeyProvider error:', error);
    return (
      <button 
        disabled
        style={{ background: 'rgba(255,0,0,0.2)', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: '700', cursor: 'not-allowed', opacity: 0.5 }}
      >
        Wallet Error
      </button>
    );
  }
}

// Initialize React app (only once)
let turnkeyAppInitialized = false;
function initTurnkeyApp() {
  if (turnkeyAppInitialized) {
    return; // Prevent duplicate initialization
  }
  
  const container = document.getElementById('wallet-connect-header');
  if (container && !container.hasChildNodes()) {
    turnkeyAppInitialized = true;
    const root = ReactDOM.createRoot(container);
    root.render(React.createElement(TurnkeyApp));
  }
}

// Export for global access
if (typeof window !== 'undefined') {
  window.TurnkeyApp = {
    initTurnkeyApp: initTurnkeyApp
  };
  
  // Auto-init when DOM is ready (only once)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initTurnkeyApp, 100); // Small delay to ensure DOM is ready
    });
  } else {
    setTimeout(initTurnkeyApp, 100);
  }
}
