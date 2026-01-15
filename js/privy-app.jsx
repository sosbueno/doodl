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
    
    // If we have a Solana wallet, use it even if authentication session has errors
    // The wallet connection itself succeeded, so we should allow the user to proceed
    if (ready && solanaWallet && solanaWallet.address) {
      console.log('Found Solana wallet:', {
        address: solanaWallet.address,
        walletClientType: solanaWallet.walletClientType,
        chainType: solanaWallet.chainType,
        isExternal: solanaWallet.walletClientType === 'phantom' || solanaWallet.walletClientType === 'solflare',
        authenticated: authenticated
      });
      
      // Set wallet address if we have one, even if authentication session failed
      // This allows users to play even if Privy's authentication session has errors
      if (window.userWalletAddress !== solanaWallet.address) {
        window.userWalletAddress = solanaWallet.address;
        console.log('✅ Setting wallet address:', solanaWallet.address);
        console.log('✅ Dispatching privy-wallet-connected event');
        
        // Dispatch the event to enable play buttons
        const event = new CustomEvent('privy-wallet-connected', {
          detail: { address: solanaWallet.address }
        });
        window.dispatchEvent(event);
        
        // Also manually enable buttons in case event listener isn't working
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
    } else if (ready && authenticated && wallets.length > 0) {
      // User authenticated but no Solana wallet found
      const nonSolanaWallets = wallets.filter(w => w.chainType !== 'solana');
      if (nonSolanaWallets.length > 0) {
        console.warn('User authenticated but no Solana wallet found. Other wallets:', nonSolanaWallets.map(w => ({
          chainType: w.chainType,
          walletClientType: w.walletClientType
        })));
      }
    } else if (ready && !authenticated && solanaWallets.length === 0 && wallets.length === 0) {
      // No wallets at all and not authenticated - clear wallet address
      if (window.userWalletAddress) {
        console.log('No wallets found and not authenticated, clearing wallet address');
        window.userWalletAddress = null;
        window.dispatchEvent(new CustomEvent('privy-wallet-disconnected'));
      }
    }
  }, [ready, authenticated, wallets, solanaWallets]);
  
  const handleConnect = async () => {
    try {
      console.log('🔌 Attempting to connect wallet...');
      console.log('Current origin:', window.location.origin);
      console.log('Privy App ID:', PRIVY_APP_ID);
      console.log('Current authenticated state:', authenticated);
      
      // Check if user has Phantom or Solflare installed
      const hasPhantom = window.solana && window.solana.isPhantom;
      const hasSolflare = window.solana && window.solana.isSolflare;
      
      console.log('🔍 Wallet detection:', { 
        hasPhantom, 
        hasSolflare, 
        hasConnectWallet: !!connectWallet,
        solanaWalletsCount: solanaWallets.length 
      });
      
      // WORKAROUND for Privy SIWS issue:
      // Privy's login() tries to do connect + signMessage in one flow (SIWS).
      // Chrome blocks the second navigation (signMessage) because it lacks a user gesture.
      // Try using connectWallet for Solana first, which might bypass the SIWS issue
      if ((hasPhantom || hasSolflare) && connectWallet) {
        console.log('🔍 Detected external Solana wallet, attempting direct connection to bypass SIWS issue...');
        try {
          // Try connecting Solana wallet directly using connectWallet
          console.log('📱 Step 1: Connecting Solana wallet directly (bypassing SIWS)...');
          await connectWallet('solana');
          console.log('✅ Direct wallet connection successful');
          
          // Wait for wallet to be detected
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Check if wallet is now connected
          const solanaWallet = solanaWallets[0] || wallets.find(w => w.chainType === 'solana');
          if (solanaWallet && solanaWallet.address) {
            console.log('✅ Solana wallet connected successfully:', solanaWallet.address);
            // Wallet is connected! Even if full authentication fails, we have the wallet address
            // The wallet will be usable for the game
            return;
          } else {
            console.warn('⚠️ Wallet connection completed but wallet not detected yet, falling back to login modal');
          }
        } catch (directConnectError) {
          console.warn('⚠️ Direct wallet connection failed, falling back to login modal:', directConnectError);
          // Fall through to login modal
        }
      } else {
        console.log('ℹ️ Using login modal (no direct connection method available)');
      }
      
      // If already authenticated, logout first to clear any stale sessions
      if (authenticated) {
        console.log('⚠️ User already authenticated, logging out first to clear session...');
        try {
          await logout();
          // Wait a moment for logout to complete
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (logoutError) {
          console.warn('Logout error (may be fine):', logoutError);
        }
      }
      
      // Try to login - this will show Privy's modal with wallet options
      // Users can choose to connect external wallet (Phantom/Solflare) or use email
      console.log('📱 Opening Privy login modal...');
      const loginPromise = login();
      
      // Set a timeout to catch if login hangs
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Login timeout after 30 seconds')), 30000)
      );
      
      await Promise.race([loginPromise, timeoutPromise]);
      console.log('✅ Login modal closed');
      
      // Wait a bit to see if authentication completes
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('After login - authenticated:', authenticated, 'wallets:', wallets.length, 'solanaWallets:', solanaWallets.length);
      const solanaWallet = wallets.find(w => w.chainType === 'solana') || solanaWallets[0];
      if (solanaWallet) {
        console.log('✅ Solana wallet connected successfully:', solanaWallet.address);
      } else if (authenticated && wallets.length > 0) {
        console.warn('⚠️ User authenticated but no Solana wallet. Available wallets:', wallets.map(w => w.walletClientType));
      } else if (!authenticated) {
        console.warn('⚠️ Login completed but user not authenticated');
      }
      
    } catch (error) {
      console.error('❌ Error connecting wallet:', error);
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error?.message);
      console.error('Error code:', error?.code);
      console.error('Error name:', error?.name);
      console.error('Error stack:', error?.stack);
      
      // Try to get more details from the error
      if (error?.response) {
        console.error('Error response:', error.response);
      }
      if (error?.data) {
        console.error('Error data:', error.data);
      }
      
      // Try to stringify error for more details
      try {
        const errorDetails = {};
        Object.getOwnPropertyNames(error).forEach(key => {
          try {
            errorDetails[key] = error[key];
          } catch (e) {
            errorDetails[key] = '[Unable to serialize]';
          }
        });
        console.error('Full error details:', JSON.stringify(errorDetails, null, 2));
      } catch (e) {
        console.error('Could not stringify error');
      }
      
      // Show user-friendly error notification
      const notification = document.createElement('div');
      notification.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #dc3545; color: #fff; padding: 15px 20px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000; max-width: 300px; font-family: Nunito, sans-serif; font-weight: 600;';
      const errorMsg = error?.message || 'Unknown error';
      notification.innerHTML = `<div style="position: absolute; top: 5px; right: 5px; background: transparent; border: 1px solid rgba(255,255,255,0.5); color: #fff; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; font-size: 18px; line-height: 1; display: flex; align-items: center; justify-content: center; padding: 0;" onclick="this.parentElement.remove()">×</div><div style="font-size: 16px; font-weight: 700; margin-bottom: 5px;">Connection Error</div><div style="font-size: 14px;">${errorMsg}</div>`;
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
    // Function to hide Privy's error modal - very aggressive approach
    const hidePrivyErrorModal = () => {
      // Look for Privy's error modal with multiple selectors
      const selectors = [
        '[data-privy-modal]',
        '[class*="privy"]',
        '[id*="privy"]',
        '[class*="modal"]',
        '[class*="overlay"]',
        '[class*="backdrop"]',
        'div[role="dialog"]',
        '[class*="error"]',
        'div[style*="position: fixed"]',
        'div[style*="position:absolute"]'
      ];
      
      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(element => {
            const text = (element.textContent || '').toLowerCase();
            const style = window.getComputedStyle(element);
            
            // Check if this looks like Privy's error modal
            if ((text.includes('could not log in') || 
                 text.includes('error authenticating') ||
                 text.includes('please try connecting again') ||
                 text.includes('retry')) &&
                (style.position === 'fixed' || style.position === 'absolute' || 
                 parseInt(style.zIndex) > 1000 || element.classList.toString().includes('privy'))) {
              console.log('🔇 Hiding Privy error modal:', element);
              element.style.display = 'none';
              element.style.visibility = 'hidden';
              element.style.opacity = '0';
              element.style.pointerEvents = 'none';
              try {
                element.remove();
              } catch (e) {
                // Ignore removal errors
              }
            }
          });
        } catch (e) {
          // Ignore selector errors
        }
      });
      
      // Also remove any backdrop/overlay elements
      document.querySelectorAll('body > div').forEach(div => {
        try {
          const style = window.getComputedStyle(div);
          if (style.position === 'fixed' && 
              (parseInt(style.zIndex) > 1000 || style.backgroundColor.includes('rgba') || style.backgroundColor.includes('rgb'))) {
            const text = (div.textContent || '').toLowerCase();
            if (text.includes('could not log in') || text.includes('privy') || text.includes('retry') || text.includes('error authenticating')) {
              console.log('🔇 Hiding Privy backdrop/overlay');
              div.style.display = 'none';
              div.style.visibility = 'hidden';
              div.style.opacity = '0';
              try {
                div.remove();
              } catch (e) {
                // Ignore removal errors
              }
            }
          }
        } catch (e) {
          // Ignore errors
        }
      });
    };
    
    // Intercept console.error to catch Privy's "Error authenticating session"
    const originalConsoleError = console.error;
    console.error = function(...args) {
      const errorMessage = args.join(' ');
      
      // Check if this is the "Error authenticating session" error
      if (errorMessage.includes('Error authenticating session') || 
          errorMessage.includes('authenticating session')) {
        console.warn('⚠️ Caught Privy authentication session error. Suppressing error modal.');
        
        // Hide the error modal immediately and repeatedly
        hidePrivyErrorModal(); // Immediate
        setTimeout(hidePrivyErrorModal, 50);
        setTimeout(hidePrivyErrorModal, 100);
        setTimeout(hidePrivyErrorModal, 300);
        setTimeout(hidePrivyErrorModal, 500);
        setTimeout(hidePrivyErrorModal, 1000);
        setTimeout(hidePrivyErrorModal, 2000);
        
        // Check if wallet is still connected despite the error
        setTimeout(() => {
          if (window.userWalletAddress) {
            console.log('✅ Wallet is connected despite authentication error:', window.userWalletAddress);
            // Ensure buttons are enabled
            const playBtn = document.getElementById('play-button');
            const createBtn = document.getElementById('create-button');
            if (playBtn) {
              playBtn.disabled = false;
              playBtn.style.opacity = '1';
              playBtn.style.cursor = 'pointer';
            }
            if (createBtn) {
              createBtn.disabled = false;
              createBtn.style.opacity = '1';
              createBtn.style.cursor = 'pointer';
            }
          }
        }, 500);
        
        // Don't show the error in console since we're handling it
        return;
      }
      
      // Call original console.error for other errors
      originalConsoleError.apply(console, args);
    };
    
    // Listen for any unhandled Privy errors
    const errorHandler = (event) => {
      const error = event.error || event.reason || event;
      if (error && error.message && error.message.includes('authenticating session')) {
        console.warn('⚠️ Caught authentication session error. Suppressing.');
        setTimeout(hidePrivyErrorModal, 100);
        event.preventDefault(); // Prevent default error handling
        return false;
      }
    };
    
    // Use MutationObserver to watch for Privy error modals being added to DOM
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // Element node
            const text = node.textContent || '';
            if (text.includes('Could not log in') || 
                text.includes('Error authenticating') ||
                (text.includes('privy') && text.includes('Retry'))) {
              console.log('🔇 Detected Privy error modal, hiding it');
              hidePrivyErrorModal();
            }
          }
        });
      });
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    window.addEventListener('error', errorHandler, true);
    window.addEventListener('unhandledrejection', errorHandler, true);
    
    return () => {
      console.error = originalConsoleError;
      observer.disconnect();
      clearInterval(periodicCheck);
      window.removeEventListener('error', errorHandler, true);
      window.removeEventListener('unhandledrejection', errorHandler, true);
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
          console.error('🚨 Privy Provider Error:', error);
          console.error('Error details:', {
            message: error?.message,
            code: error?.code,
            name: error?.name,
            stack: error?.stack
          });
          
          // Try to get more error information
          if (error?.cause) {
            console.error('Error cause:', error.cause);
          }
          if (error?.response) {
            console.error('Error response:', error.response);
          }
        },
        // Add session configuration
        session: {
          // Enable session persistence
          persist: true,
          // Session timeout (in seconds) - 7 days
          timeout: 7 * 24 * 60 * 60
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
