// Privy React App - Wrapper for Privy SDK
import React from 'react';
import ReactDOM from 'react-dom/client';
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana';

// Get Privy App ID from server
let PRIVY_APP_ID = 'cmkdyx5cg02hvlb0cexfoj8sj';

// Fetch from server on init
fetch('/api/privy-config')
  .then(res => res.json())
  .then(config => {
    PRIVY_APP_ID = config.appId;
  })
  .catch(() => {
    // Use default if fetch fails
  });

// Wallet Connect Component
function WalletConnectButton() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useWallets();
  
  React.useEffect(() => {
    if (ready && authenticated && wallets.length > 0) {
      // User is authenticated and has a wallet
      const solanaWallet = wallets.find(w => w.chainType === 'solana');
      if (solanaWallet) {
        window.userWalletAddress = solanaWallet.address;
        window.dispatchEvent(new CustomEvent('privy-wallet-connected', {
          detail: { address: solanaWallet.address }
        }));
      }
    } else if (ready && !authenticated) {
      window.userWalletAddress = null;
      window.dispatchEvent(new CustomEvent('privy-wallet-disconnected'));
    }
  }, [ready, authenticated, wallets]);
  
  const handleConnect = () => {
    try {
      login();
    } catch (error) {
      console.error('Error connecting wallet:', error);
      // Show error notification
      if (window.showWalletRequiredNotification) {
        // Temporarily show error message
        const notification = document.createElement('div');
        notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #dc3545; color: #fff; padding: 15px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000; max-width: 300px; font-family: Nunito, sans-serif; font-weight: 600;';
        notification.innerHTML = '<div style="font-size: 16px; font-weight: 700; margin-bottom: 5px;">Connection Error</div><div style="font-size: 14px;">Please try again or use email login</div>';
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 5000);
      }
    }
  };
  
  const handleDisconnect = () => {
    logout();
  };
  
  if (!ready) {
    return null;
  }
  
  if (authenticated && wallets.length > 0) {
    const solanaWallet = wallets.find(w => w.chainType === 'solana');
    const address = solanaWallet?.address || '';
    const shortAddress = address ? `${address.substring(0, 4)}...${address.substring(address.length - 4)}` : '';
    
    return (
      <div id="header-wallet-info" style={{ display: 'block', color: '#fff', fontSize: '0.9em', marginTop: '5px', textAlign: 'center' }}>
        <div id="header-wallet-address" style={{ marginBottom: '5px' }}>{shortAddress}</div>
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

// Main Privy App Component
function PrivyApp() {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'wallet'],
        appearance: {
          theme: 'dark',
          accentColor: '#9945FF',
          logo: '/img/doodllogo.gif',
          walletChainType: 'solana-only'
        },
        embeddedWallets: {
          solana: {
            createOnLogin: 'users-without-wallets'
          }
        },
        externalWallets: {
          solana: {
            connectors: toSolanaWalletConnectors(['phantom', 'solflare'])
          }
        }
      }}
    >
      <WalletConnectButton />
    </PrivyProvider>
  );
}

// Initialize React app (only once)
let privyAppInitialized = false;
function initPrivyApp() {
  if (privyAppInitialized) {
    return; // Prevent duplicate initialization
  }
  
  const container = document.getElementById('wallet-connect-header');
  if (container && !container.hasChildNodes()) {
    privyAppInitialized = true;
    const root = ReactDOM.createRoot(container);
    root.render(React.createElement(PrivyApp));
  }
}

// Export for global access
if (typeof window !== 'undefined') {
  window.PrivyApp = {
    initPrivyApp: initPrivyApp
  };
  
  // Auto-init when DOM is ready (only once)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initPrivyApp, 100); // Small delay to ensure DOM is ready
    });
  } else {
    setTimeout(initPrivyApp, 100);
  }
}
