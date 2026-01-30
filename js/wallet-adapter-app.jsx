// Solana Wallet Adapter App - Simple and reliable wallet connection
import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConnectionProvider, WalletProvider, useWallet } from '@solana/wallet-adapter-react';
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

// Get RPC endpoint (use mainnet or devnet)
const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com';

// Wallet Connect Component
function WalletConnectButton() {
  const { publicKey, disconnect, connected } = useWallet();
  
  React.useEffect(() => {
    console.log('Wallet state changed:', { 
      connected, 
      publicKey: publicKey?.toBase58() 
    });
    
    if (connected && publicKey) {
      const address = publicKey.toBase58();
      
      // Set wallet address globally
      if (window.userWalletAddress !== address) {
        window.userWalletAddress = address;
        console.log('✅ Setting wallet address:', address);
        console.log('✅ Dispatching wallet-adapter-connected event');
        
        // Dispatch events (turnkey-* for compatibility with existing game.js listeners)
        window.dispatchEvent(new CustomEvent('turnkey-wallet-connected', { detail: { address } }));
        window.dispatchEvent(new CustomEvent('wallet-adapter-connected', { detail: { address } }));
        
        // Show success notification
        setTimeout(() => {
          if (window.showWalletSuccessNotification) {
            window.showWalletSuccessNotification(address);
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
    } else if (!connected) {
      // Wallet disconnected
      if (window.userWalletAddress) {
        console.log('Wallet disconnected, clearing address');
        window.userWalletAddress = null;
        window.dispatchEvent(new CustomEvent('turnkey-wallet-disconnected'));
        window.dispatchEvent(new CustomEvent('wallet-adapter-disconnected'));
      }
    }
  }, [connected, publicKey]);
  
  // Custom button that matches your design
  if (connected && publicKey) {
    const address = publicKey.toBase58();
    const shortAddress = `${address.substring(0, 4)}...${address.substring(address.length - 4)}`;
    
    return (
      <div id="header-wallet-info" style={{ display: 'block', color: '#fff', fontSize: '0.9em', marginTop: '5px', textAlign: 'center' }}>
        <div id="header-wallet-address" style={{ marginBottom: '5px' }}>
          {shortAddress}
        </div>
        <button 
          id="header-wallet-disconnect" 
          onClick={() => disconnect()}
          style={{ padding: '5px 10px', fontSize: '0.8em', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '5px', color: '#fff', cursor: 'pointer' }}
        >
          Disconnect
        </button>
      </div>
    );
  }
  
  // Use WalletMultiButton but style it to match your design
  return (
    <div style={{ position: 'relative' }}>
      <WalletMultiButton 
        style={{
          background: 'linear-gradient(135deg, #9945FF 0%, #14F195 100%)',
          color: '#fff',
          border: 'none',
          padding: '10px 20px',
          borderRadius: '8px',
          fontWeight: '700',
          cursor: 'pointer',
          boxShadow: '0 3px 8px rgba(0,0,0,0.3)',
          fontFamily: 'Nunito, sans-serif'
        }}
      />
    </div>
  );
}

// Main Wallet Adapter App Component
function WalletAdapterApp() {
  // Make success notification function globally available
  React.useEffect(() => {
    window.showWalletSuccessNotification = (walletAddress) => {
      const existing = document.getElementById('wallet-success-notification');
      if (existing) {
        existing.remove();
      }
      
      const shortAddress = walletAddress ? `${walletAddress.substring(0, 4)}...${walletAddress.substring(walletAddress.length - 4)}` : '';
      
      const notification = document.createElement('div');
      notification.id = 'wallet-success-notification';
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
      
      if (!document.getElementById('wallet-success-animation')) {
        const style = document.createElement('style');
        style.id = 'wallet-success-animation';
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
        ">💰 <strong>Rewards:</strong> When you win, rewards will be sent directly to this wallet address. You can claim them anytime!</p>
        <button onclick="this.closest('#wallet-success-notification').remove()" style="
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
  
  // Initialize wallets
  const wallets = React.useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );
  
  return (
    <ConnectionProvider endpoint={SOLANA_RPC_URL}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WalletConnectButton />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

// Initialize React app (only once)
let walletAdapterAppInitialized = false;
function initWalletAdapterApp() {
  if (walletAdapterAppInitialized) {
    return;
  }
  
  const container = document.getElementById('wallet-connect-header');
  if (container && !container.hasChildNodes()) {
    walletAdapterAppInitialized = true;
    const root = ReactDOM.createRoot(container);
    root.render(React.createElement(WalletAdapterApp));
  }
}

// Export for global access
if (typeof window !== 'undefined') {
  window.WalletAdapterApp = {
    initWalletAdapterApp: initWalletAdapterApp
  };
  
  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initWalletAdapterApp, 100);
    });
  } else {
    setTimeout(initWalletAdapterApp, 100);
  }
}
