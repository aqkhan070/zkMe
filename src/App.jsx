import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { Wallet, AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import { ZkMeWidget } from '@zkmelabs/widget';
import '@zkmelabs/widget/dist/style.css';
import Header from './components/Header';

const App = () => {
  const [walletData, setWalletData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState('');
  const [balance, setBalance] = useState(null);
  const [kycStatus, setKycStatus] = useState(null);
  const [showMetaMaskDialog, setShowMetaMaskDialog] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('https://metamask.io/download/');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Detect if user is on mobile
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      setIsMobile(isMobileDevice);
    };
    checkMobile();

    // Detect browser and set appropriate download URL
    const userAgent = navigator.userAgent.toLowerCase();
    let url = 'https://metamask.io/download/';

    if (userAgent.includes('chrome')) {
      url = 'https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn';
    } else if (userAgent.includes('firefox')) {
      url = 'https://addons.mozilla.org/en-US/firefox/addon/ether-metamask/';
    } else if (userAgent.includes('edge')) {
      url = 'https://microsoftedge.microsoft.com/addons/detail/metamask/ejbalbakoplchlghecdalmeeeajnimhm';
    } else if (userAgent.includes('safari')) {
      url = 'https://apps.apple.com/us/app/metamask-blockchain-wallet/id1438144202';
    }

    setDownloadUrl(url);
  }, []);

  const handleConnect = async () => {
    if (!window.ethereum) {
      if (isMobile) {
        // Use production URL for MetaMask deep link
        const dappUrl = 'https://zk-me.vercel.app';
        // Redirect to MetaMask app browser
        window.location.href = `https://metamask.app.link/dapp/${dappUrl}`;
        return;
      }
      setShowMetaMaskDialog(true);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      // First check if we already have permissions
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      
      if (accounts.length === 0) {
        // If no accounts are connected, request permissions
        await window.ethereum.request({ 
          method: 'wallet_requestPermissions', 
          params: [{ eth_accounts: {} }] 
        });
      }

      const signer = provider.getSigner();
      const address = await signer.getAddress();

      const balance = await provider.getBalance(address);
      setBalance(ethers.utils.formatEther(balance));

      setWalletData({ provider, signer, address });
      localStorage.setItem('walletAddress', address);
    } catch (err) {
      setError(err.message);
      // If there's a permission error on mobile, redirect to MetaMask browser
      if (isMobile && err.message.includes('permission')) {
        window.location.href = 'https://metamask.app.link/dapp/zk-me.vercel.app';
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setWalletData(null);
    setBalance(null);
    setKycStatus(null);
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('kycVerified');
  
    // Instead of reloading, we'll try to reconnect
    if (window.ethereum) {
      window.ethereum.request({ 
        method: 'wallet_requestPermissions', 
        params: [{ eth_accounts: {} }] 
      }).then(() => {
        // After requesting permissions, try to connect again
        handleConnect();
      }).catch(() => {
        // If permission is denied, redirect to MetaMask browser
        if (isMobile) {
          window.location.href = 'https://metamask.app.link/dapp/zk-me.vercel.app';
        }
      });
    }
  };
  

  const provider = {
    async getAccessToken() {
      // const res = await fetch("http://localhost:8000/api/zkme/token");
      // const json = await res.json();
      // return json.data.accessToken;
    },
    async getUserAccounts() {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      return accounts;
    },
    async delegateTransaction(tx) {
      const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = web3Provider.getSigner();
      const txResponse = await signer.sendTransaction(tx);
      return txResponse.hash;
    },
  };

  const zkMeWidget = new ZkMeWidget(
    'M2025012255531684563023546877743',
    'ivest-wellet-frontend',
    '137', // or '0x89' for Polygon Mainnet
    provider,
    {
      lv: 'zkKYC',
      programNo: '202504070001',
      theme: 'dark',
      locale: 'en',
      // showLogin: false, // disables email login
    }
  );

  zkMeWidget.on('kycFinished', (result) => {
    const { isGrant, associatedAccount } = result;
    if (isGrant && associatedAccount.toLowerCase() === walletData?.address.toLowerCase()) {
      setKycStatus('success');
      localStorage.setItem('kycVerified', 'true');
    } else {
      setKycStatus('fail');
      localStorage.removeItem('kycVerified');
    }
  });

  const launchKYCWidget = () => {
    zkMeWidget.launch();
  };

  const handleVerification = async () => {
    if (!walletData) {
      // If wallet is not connected, connect it first
      await handleConnect();
    }
    // After wallet is connected (or was already connected), launch KYC
    if (walletData) {
      launchKYCWidget();
    }
  };

  useEffect(() => {
    const isVerified = localStorage.getItem('kycVerified');
    if (isVerified === 'true') {
      setKycStatus('success');
    }
  }, []);
  useEffect(() => {
    const savedAddress = localStorage.getItem('walletAddress');
    const isVerified = localStorage.getItem('kycVerified') === 'true';
    if (isVerified) setKycStatus('success');

    if (savedAddress && window.ethereum) {
      const autoConnect = async () => {
        try {
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          const signer = provider.getSigner();
          const currentAddress = await signer.getAddress();

          if (currentAddress.toLowerCase() === savedAddress.toLowerCase()) {
            const balance = await provider.getBalance(currentAddress);
            setBalance(ethers.utils.formatEther(balance));
            setWalletData({ provider, signer, address: currentAddress });
          } else {
            localStorage.removeItem('walletAddress');
          }
        } catch {
          localStorage.removeItem('walletAddress');
        }
        setInitialLoading(false);
      };

      autoConnect();
    } else {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length === 0) {
          // Instead of disconnecting, try to reconnect
          handleConnect();
        } else {
          handleConnect();
        }
      });
      window.ethereum.on('chainChanged', () => {
        handleConnect();
      });
    }
  }, []);

  const MetaMaskDialog = () => (
    <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-[#edffee] rounded-xl shadow-lg p-6 max-w-md w-full mx-4 border-2 border-green-500">
        <div className="flex items-center space-x-3 mb-4">
          <Wallet className="w-6 h-6 text-[#8fef56]" />
          <h3 className="text-lg font-semibold text-gray-800">MetaMask Not Found</h3>
        </div>
        <p className="text-gray-600 mb-6">
          {isMobile 
            ? "To use this application, please open it in MetaMask's in-app browser."
            : "To use this application, you need to install MetaMask, a cryptocurrency wallet for your browser."}
        </p>
        <div className="flex space-x-3">
          {isMobile ? (
            <a
              href="https://metamask.app.link/dapp/zk-me.vercel.app"
              className="flex-1 bg-[#8fef56] hover:bg-[#7edf45] text-white font-bold py-3 px-4 rounded-lg transition-colors text-center"
            >
              Open in MetaMask
            </a>
          ) : (
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-[#8fef56] hover:bg-[#7edf45] text-white font-bold py-3 px-4 rounded-lg transition-colors text-center"
            >
              Install MetaMask
            </a>
          )}
          <button
            onClick={() => setShowMetaMaskDialog(false)}
            className="flex-1 bg-white hover:bg-gray-100 text-gray-800 font-medium py-3 px-4 rounded-lg transition-colors border border-gray-300"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[oklch(0.99_0.02_150)] text-black">
      {showMetaMaskDialog && <MetaMaskDialog />}
      <Header 
        walletData={walletData}
        balance={balance}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        loading={loading}
      />
      <div className="p-4">
        <div className="max-w-[1000px] mx-auto space-y-6">
          <div className="space-y-4 mt-8">
            <h2 className="text-5xl font-normal text-gray-800">Unlock your exclusive early adopters rewards while outsmarting bots!</h2>
            <p className="text-gray-600 text-lg mt-8">
              Prove that you are a unique human in two steps, by passing this multi-level credentialing system that ensures only unique humans can attain Level 2, effectively distinguishing themselves from bots and preventing Sybil attacks.
            </p>
            <p className="text-gray-600 text-lg mt-8">
              Passing both verifications is necessary to anchor your Proof of Uniqueness credential to the Verax attestation registry, making you eligible to participate in the LXP drop.
            </p>
          </div>

          <div className="max-w-xl mx-auto bg-[#edffee] rounded-xl shadow-lg p-6 space-y-6 border-2 border-green-500">
            {error && (
              <div className="bg-red-100 border border-red-600 rounded-lg p-4 text-red-800 flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 mt-0.5" />
                <span className="text-sm">{error}</span>
              </div>
            )}
            {!walletData && !initialLoading && (
              <div className="flex flex-col items-center space-y-2">
                <p className="text-sm text-gray-600">Please connect your wallet to verify your identity.</p>
              </div>
            )}

            {initialLoading && (
              <div className="flex flex-col items-center space-y-2">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <p className="text-sm text-gray-600">Connecting to wallet...</p>
              </div>
            )}

            <div className="bg-white border border-gray-300 rounded-lg p-4 space-y-2">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium">Network</span>
              </div>
              <p className="text-xs text-gray-400">Make sure you have enough gas fees</p>
            </div>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">Welcome to Identity Verification</p>
              <button
                onClick={handleVerification}
                disabled={kycStatus === 'success' || loading}
                className="bg-[#8fef56] hover:bg-[#7edf45] text-white font-bold py-3 px-4 rounded-lg"
              >
                {kycStatus === 'success' ? 'KYC Verified' : 'Verify now'}
              </button>

              {kycStatus === 'success' && (
                <div className="bg-green-100 border border-green-600 text-green-800 rounded p-3 text-center">
                  ✅ KYC Verification complete!
                </div>
              )}
              {kycStatus === 'fail' && (
                <div className="bg-red-100 border border-red-600 text-red-800 rounded p-3 text-center">
                  ❌ KYC Verification failed. Please try again.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
