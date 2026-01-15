// Privy React App - Wrapper for Privy SDK
import React from 'react';
import ReactDOM from 'react-dom/client';
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';
import { toSolanaWalletConnectors, useSolanaWallets } from '@privy-io/react-auth/solana';

// Get Privy App ID from server
let PRIVY_APP_ID = 'cmkdyx5cg02hvlb0cexfoj8sj';

// Log current domain for debugging
console.log('Current origin:', window.location.origin);
console.log('Current hostname:', window.location.hostname);

// Fetch from server on init
fetch('/api/privy-config')
  .then(res => res.json())
  .then(config => {
    PRIVY_APP_ID = config.appId;
    console.log('Privy App ID loaded:', PRIVY_APP_ID);
  })
  .catch((err) => {
    console.warn('Failed to fetch Privy config, using default:', err);
    // Use default if fetch fails
  });

// Wallet Connect Component
function WalletConnectButton() {
  const { ready, authenticated, login, logout, user, connectWallet } = usePrivy();
  const { wallets } = useWallets();
  const { wallets: solanaWallets } = useSolanaWallets();
  
  React.useEffect(() => {
    console.log('Wallet state changed:', { 
      ready, 
      authenticated, 
      walletCount: wallets.length,
      solanaWalletCount: solanaWallets.length 
    });
    
    // Check both regular wallets and Solana-specific wallets
    const solanaWallet = wallets.find(w => w.chainType === 'solana') || solanaWallets[0];
    
    if (ready && authenticated && solanaWallet) {
      console.log('Found Solana wallet:', {
        address: solanaWallet.address,
        walletClientType: solanaWallet.walletClientType,
        chainType: solanaWallet.chainType,
        isExternal: solanaWallet.walletClientType === 'phantom' || solanaWallet.walletClientType === 'solflare'
      });
      
      window.userWalletAddress = solanaWallet.address;
      console.log('Setting wallet address:', solanaWallet.address);
      window.dispatchEvent(new CustomEvent('privy-wallet-connected', {
        detail: { address: solanaWallet.address }
      }));
    } else if (ready && authenticated && wallets.length > 0) {
      console.warn('User authenticated but no Solana wallet found. Wallets:', wallets.map(w => ({
        chainType: w.chainType,
        walletClientType: w.walletClientType
      })));
    } else if (ready && !authenticated) {
      console.log('User not authenticated, clearing wallet address');
      window.userWalletAddress = null;
      window.dispatchEvent(new CustomEvent('privy-wallet-disconnected'));
    }
  }, [ready, authenticated, wallets, solanaWallets]);
  
  const handleConnect = async () => {
    try {
      console.log('Attempting to login with Privy...');
      console.log('Current origin:', window.location.origin);
      console.log('Privy App ID:', PRIVY_APP_ID);
      
      // Try to login - this will show Privy's modal with wallet options
      // Users can choose to connect external wallet (Phantom/Solflare) or use email
      await login();
      console.log('Login call completed');
      
      // Wait a bit to see if authentication completes
      setTimeout(() => {
        console.log('After login - authenticated:', authenticated, 'wallets:', wallets.length, 'solanaWallets:', solanaWallets.length);
        const solanaWallet = wallets.find(w => w.chainType === 'solana') || solanaWallets[0];
        if (solanaWallet) {
          console.log('✅ Solana wallet connected successfully:', solanaWallet.address);
        } else if (authenticated && wallets.length > 0) {
          console.warn('⚠️ User authenticated but no Solana wallet. Available wallets:', wallets.map(w => w.walletClientType));
        } else if (!authenticated) {
          console.warn('⚠️ Login completed but user not authenticated');
        }
      }, 2000);
      
    } catch (error) {
      console.error('❌ Error connecting wallet:', error);
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error?.message);
      console.error('Error code:', error?.code);
      console.error('Error stack:', error?.stack);
      
      // Try to stringify error for more details
      try {
        console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
      } catch (e) {
        console.error('Could not stringify error');
      }
      
      // Show user-friendly error notification
      const notification = document.createElement('div');
      notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #dc3545; color: #fff; padding: 15px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000; max-width: 300px; font-family: Nunito, sans-serif; font-weight: 600;';
      notification.innerHTML = '<div style="position: absolute; top: 5px; right: 5px; background: transparent; border: 1px solid rgba(255,255,255,0.5); color: #fff; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 18px; line-height: 1; display: flex; align-items: center; justify-content: center; padding: 0;" onclick="this.parentElement.remove()">×</div><div style="font-size: 16px; font-weight: 700; margin-bottom: 5px;">Connection Error</div><div style="font-size: 14px;">Please try again or use email login</div>';
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    }
  };
  
  const handleDisconnect = () => {
    logout();
  };
  
  if (!ready) {
    return null;
  }
  
  if (authenticated) {
    // User is authenticated - check if they have a Solana wallet
    const solanaWallet = wallets.find(w => w.chainType === 'solana') || solanaWallets[0];
    
    if (solanaWallet) {
      // User has a Solana wallet (embedded or external)
      const address = solanaWallet.address || '';
      const shortAddress = address ? `${address.substring(0, 4)}...${address.substring(address.length - 4)}` : '';
      const isExternal = solanaWallet.walletClientType === 'phantom' || solanaWallet.walletClientType === 'solflare';
      
      return (
        <div id="header-wallet-info" style={{ display: 'block', color: '#fff', fontSize: '0.9em', marginTop: '5px', textAlign: 'center' }}>
          <div id="header-wallet-address" style={{ marginBottom: '5px' }}>
            {shortAddress}
            {isExternal && <span style={{ fontSize: '0.8em', opacity: 0.7, marginLeft: '5px' }}>({solanaWallet.walletClientType})</span>}
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
    } else {
      // User is authenticated but no Solana wallet yet
      // This can happen if they logged in with email but haven't connected a wallet
      console.warn('User authenticated but no Solana wallet found. Available wallets:', wallets);
      return (
        <div id="header-wallet-info" style={{ display: 'block', color: '#fff', fontSize: '0.9em', marginTop: '5px', textAlign: 'center' }}>
          <div style={{ marginBottom: '5px', color: '#ffa500' }}>No Solana wallet</div>
          <button 
            onClick={() => connectWallet('solana')}
            style={{ padding: '5px 10px', fontSize: '0.8em', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '5px', color: '#fff', cursor: 'pointer' }}
          >
            Connect Wallet
          </button>
        </div>
      );
    }
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
  // Add error handler for Privy errors
  React.useEffect(() => {
    // Listen for any unhandled Privy errors
    const errorHandler = (event) => {
      console.error('Privy Error:', event.error || event);
      if (event.error && event.error.message) {
        console.error('Error message:', event.error.message);
        console.error('Error stack:', event.error.stack);
      }
    };
    
    window.addEventListener('error', errorHandler);
    window.addEventListener('unhandledrejection', errorHandler);
    
    return () => {
      window.removeEventListener('error', errorHandler);
      window.removeEventListener('unhandledrejection', errorHandler);
    };
  }, []);
  
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
        },
        // Add error handling
        onError: (error) => {
          console.error('Privy Provider Error:', error);
          console.error('Error details:', {
            message: error?.message,
            code: error?.code,
            name: error?.name,
            stack: error?.stack
          });
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
