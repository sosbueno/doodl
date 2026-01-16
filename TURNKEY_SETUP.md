# Turnkey Setup Guide

## Prerequisites

1. Create a Turnkey account at https://www.turnkey.com
2. Create a Turnkey Organization
3. Set up Auth Proxy (required for frontend authentication)
4. Get your Organization ID and Auth Proxy Config ID from the Turnkey dashboard

## Environment Variables

Set these environment variables in your `.env` file or hosting platform:

```bash
TURNKEY_ORG_ID=your-organization-id-here
TURNKEY_AUTH_PROXY_CONFIG_ID=your-auth-proxy-config-id-here
TURNKEY_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id-here  # Optional, for WalletConnect support
```

## Getting Your Turnkey Credentials

1. **Organization ID**: 
   - Go to your Turnkey dashboard
   - Navigate to Settings > Organization
   - Copy your Organization ID

2. **Auth Proxy Config ID**:
   - Go to Settings > Auth Proxy
   - Create a new Auth Proxy configuration (if you haven't already)
   - Copy the Config ID

3. **WalletConnect Project ID** (Optional):
   - Go to https://cloud.walletconnect.com
   - Create a new project
   - Copy the Project ID
   - This enables WalletConnect support for mobile wallets

## Features

- ✅ Embedded wallets (created automatically when users authenticate)
- ✅ External wallet connection (Phantom, Solflare, etc.)
- ✅ Solana support
- ✅ Social login (via Turnkey's auth system)
- ✅ Secure key management

## How It Works

1. User clicks "Connect Wallet"
2. Turnkey shows authentication modal (passkey, email, etc.)
3. After authentication, a Solana wallet is automatically created
4. Wallet address is stored and game buttons are enabled

## Testing

1. Set your environment variables
2. Restart your server
3. Visit your site and click "Connect Wallet"
4. Authenticate with Turnkey
5. Your Solana wallet should be created automatically

## Troubleshooting

- **"Initializing..." button**: Check that your environment variables are set correctly
- **Authentication fails**: Verify your Auth Proxy Config ID is correct
- **No wallet created**: Check browser console for errors

## Documentation

- Turnkey Docs: https://docs.turnkey.com
- React Wallet Kit: https://docs.turnkey.com/sdks/react/using-embedded-wallets
- Solana Support: https://docs.turnkey.com/networks/solana
