import { useState, useEffect } from 'react'
import { ethers } from 'ethers'

export default function DocumentVerification() {
  const [account, setAccount] = useState('')
  const [contract, setContract] = useState(null)
  const [documentHash, setDocumentHash] = useState('')
  const [documentType, setDocumentType] = useState('CMND')
  const [verificationResult, setVerificationResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [fileName, setFileName] = useState('')
  const [status, setStatus] = useState('🔗 Kết nối Rootstock Testnet')
  const [contractDeployed, setContractDeployed] = useState(false)
  const [currentRPC, setCurrentRPC] = useState(0)
  const [userBalance, setUserBalance] = useState('0')
  const [transactionStats, setTransactionStats] = useState({
    canRegister: 0,
    canVerify: 0,
    registerCost: 0.0003,
    verifyCost: 0.00005,
    hasSufficientBalance: false
  })

  // ✅ CONSTANTS - GIẢM NGƯỠNG TỐI THIỂU
  const MINIMUM_BALANCE = 0.00005
  const ESTIMATED_REGISTER_COST = 0.0003
  const ESTIMATED_VERIFY_COST = 0.00005

  // ✅ CONTRACT ADDRESS
  const contractAddress = "0xF561493424f457938C078a304e5B6F96765cec1d"
  
  // Multiple RPC endpoints for fallback
  const rootstockRPCs = [
    'https://public-node.testnet.rsk.co',
    'https://mycrypto.testnet.rsk.co',
    'https://testnet.sovryn.app/rpc'
  ]

  // ABI contract
  const contractABI = [
    "function registerDocument(string _documentHash, string _documentType) external",
    "function verifyDocument(string _documentHash) external view returns (bool)",
    "function getUserDocuments(address _user) external view returns (string[])",
    "event DocumentRegistered(string indexed documentHash, address indexed owner, uint256 timestamp)"
  ]

  // Hàm lấy provider với retry
  const getProvider = () => {
    return new ethers.JsonRpcProvider(rootstockRPCs[currentRPC])
  }

  // Hàm lấy balance của user - ĐÃ SỬA HOÀN TOÀN
  const fetchUserBalance = async (provider = null) => {
    if (!account) return
    
    try {
      let usedProvider = provider
      if (!usedProvider) {
        // Ưu tiên sử dụng window.ethereum để lấy balance chính xác
        if (window.ethereum) {
          usedProvider = new ethers.BrowserProvider(window.ethereum)
        } else {
          usedProvider = getProvider()
        }
      }
      
      const balance = await usedProvider.getBalance(account)
      const formattedBalance = ethers.formatEther(balance)
      const balanceNum = parseFloat(formattedBalance)
      
      console.log('💰 Balance fetched:', balanceNum, 'tRBTC')
      
      // Lưu balance dạng số để so sánh chính xác
      setUserBalance(balanceNum.toString())
      
      // Tính toán số giao dịch có thể thực hiện
      const canRegister = Math.floor(balanceNum / ESTIMATED_REGISTER_COST)
      const canVerify = Math.floor(balanceNum / ESTIMATED_VERIFY_COST)
      
      setTransactionStats({
        canRegister: canRegister > 0 ? canRegister : 0,
        canVerify: canVerify > 0 ? canVerify : 0,
        registerCost: ESTIMATED_REGISTER_COST,
        verifyCost: ESTIMATED_VERIFY_COST,
        hasSufficientBalance: balanceNum >= MINIMUM_BALANCE
      })

    } catch (error) {
      console.error('Lỗi lấy balance:', error)
      setUserBalance('0')
      setTransactionStats({
        canRegister: 0,
        canVerify: 0,
        registerCost: ESTIMATED_REGISTER_COST,
        verifyCost: ESTIMATED_VERIFY_COST,
        hasSufficientBalance: false
      })
    }
  }

  // Chuyển sang RPC khác khi gặp lỗi
  const switchRPC = () => {
    const newIndex = (currentRPC + 1) % rootstockRPCs.length
    setCurrentRPC(newIndex)
    console.log(`🔄 Chuyển sang RPC: ${rootstockRPCs[newIndex]}`)
    return newIndex
  }

  // Kiểm tra contract deployment với retry
  const checkContractDeployment = async () => {
    let retries = 3
    while (retries > 0) {
      try {
        const provider = getProvider()
        const code = await provider.getCode(contractAddress)
        const isDeployed = code !== '0x'
        setContractDeployed(isDeployed)
        console.log(`✅ Contract deployment check: ${isDeployed}`)
        return isDeployed
      } catch (error) {
        console.error(`❌ Lỗi kiểm tra contract (${retries} retries left):`, error)
        retries--
        if (retries > 0) {
          switchRPC()
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }
    setContractDeployed(false)
    return false
  }

  // Thêm network Rootstock vào MetaMask
  const addRootstockNetwork = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: '0x1F',
          chainName: 'Rootstock Testnet',
          nativeCurrency: {
            name: 'tRBTC',
            symbol: 'tRBTC',
            decimals: 18
          },
          rpcUrls: [rootstockRPCs[0]],
          blockExplorerUrls: ['https://explorer.testnet.rootstock.io/']
        }]
      })
      return true
    } catch (error) {
      console.error('Error adding network:', error)
      return false
    }
  }

  // Chuyển sang network Rootstock
  const switchToRootstock = async () => {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x1F' }]
      })
      return true
    } catch (switchError) {
      if (switchError.code === 4902) {
        const added = await addRootstockNetwork()
        return added
      }
      return false
    }
  }

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        setStatus('🔄 Đang kết nối Rootstock...')

        // Kết nối ví trước
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        })
        setAccount(accounts[0])
        
        // Kiểm tra network
        const provider = new ethers.BrowserProvider(window.ethereum)
        const network = await provider.getNetwork()
        
        if (network.chainId !== 31n) {
          setStatus('🔄 Đang chuyển sang Rootstock Testnet...')
          const switched = await switchToRootstock()
          if (!switched) {
            setStatus('❌ Lỗi chuyển network')
            return
          }
          // Đợi network chuyển đổi
          await new Promise(resolve => setTimeout(resolve, 2000))
        }

        // ✅ KIỂM TRA CONTRACT
        setStatus('🔍 Đang kiểm tra contract...')
        const isDeployed = await checkContractDeployment()
        
        if (!isDeployed) {
          setStatus('❌ Contract không khả dụng')
          alert('❌ Contract không tồn tại hoặc RPC lỗi. Vui lòng thử lại sau.')
          return
        }

        // ✅ TẠO CONTRACT INSTANCE
        const signer = await provider.getSigner()
        const contractInstance = new ethers.Contract(contractAddress, contractABI, signer)
        setContract(contractInstance)
        
        // Lấy balance của user - TRUYỀN PROVIDER VÀO
        await fetchUserBalance(provider)
        
        setStatus(`✅ Đã kết nối Rootstock Testnet - Contract sẵn sàng!`)

      } catch (error) {
        console.error('Connection error:', error)
        handleConnectionError(error)
      }
    } else {
      alert('⚠️ Vui lòng cài đặt MetaMask!')
    }
  }

  const handleConnectionError = (error) => {
    if (error.code === 4001) {
      setStatus('❌ Từ chối kết nối')
      alert('❌ Bạn đã từ chối kết nối ví')
    } else if (error.message.includes('network') || error.message.includes('chain')) {
      setStatus('❌ Lỗi network')
      alert('❌ Lỗi kết nối network. Vui lòng thử lại.')
    } else if (error.message.includes('RPC') || error.message.includes('fetch')) {
      setStatus('❌ Lỗi RPC')
      alert('❌ Lỗi kết nối RPC. Đang thử RPC khác...')
      switchRPC()
    } else {
      setStatus('❌ Lỗi kết nối')
      alert('❌ Lỗi: ' + error.message)
    }
  }

  const calculateFileHash = async (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        try {
          const arrayBuffer = e.target.result
          const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer)
          const hashArray = Array.from(new Uint8Array(hashBuffer))
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
          resolve(hashHex)
        } catch (error) {
          reject(error)
        }
      }
      reader.onerror = reject
      reader.readAsArrayBuffer(file)
    })
  }

  const handleFileUpload = async (event) => {
    const file = event.target.files[0]
    if (file) {
      setLoading(true)
      try {
        const hash = await calculateFileHash(file)
        setDocumentHash(hash)
        setFileName(file.name)
        alert(`📄 Đã tạo hash: ${file.name}\n\n🔐 ${hash}`)
      } catch (error) {
        alert('❌ Lỗi file: ' + error.message)
      }
      setLoading(false)
    }
  }

  const registerDocument = async () => {
    console.log('🔍 DEBUG - Kiểm tra balance trước khi đăng ký:', {
      userBalance,
      type: typeof userBalance,
      parsedBalance: parseFloat(userBalance),
      minimum: MINIMUM_BALANCE,
      isSufficient: parseFloat(userBalance) >= MINIMUM_BALANCE
    })

    if (!contract) {
      alert('⚠️ Vui lòng kết nối ví trước')
      return
    }
    
    // Kiểm tra balance trước khi thực hiện
    const currentBalance = parseFloat(userBalance)
    if (currentBalance < MINIMUM_BALANCE) {
      alert(`❌ Không đủ tRBTC!\n\nBalance hiện tại: ${userBalance} tRBTC\nCần ít nhất: ${MINIMUM_BALANCE} tRBTC\n\nVui lòng nhận test token tại faucet.`)
      return
    }
    
    if (!documentHash) {
      alert('⚠️ Vui lòng upload file trước')
      return
    }

    try {
      setLoading(true)
      setStatus('🔄 Đang gửi transaction...')

      // ✅ GỌI CONTRACT
      const tx = await contract.registerDocument(documentHash, documentType, {
        gasLimit: 500000,
        gasPrice: ethers.parseUnits('1', 'gwei')
      })
      
      alert('⏳ Đang xác nhận transaction...\n💸 Phí gas: ~0.0003 tRBTC')
      
      const receipt = await tx.wait()
      console.log('Transaction receipt:', receipt)
      
      // Cập nhật balance sau giao dịch
      await fetchUserBalance()
      
      setStatus('✅ Đăng ký thành công!')
      alert(`🎉 THÀNH CÔNG! Giấy tờ đã được lưu trên Rootstock Blockchain\n\n📝 Transaction Hash: ${receipt.hash}\n🔍 Xem trên Explorer: https://explorer.testnet.rootstock.io/tx/${receipt.hash}`)

    } catch (error) {
      console.error('Lỗi transaction:', error)
      setStatus('❌ Lỗi transaction')
      handleTransactionError(error)
    }
    setLoading(false)
  }

  const handleTransactionError = (error) => {
    if (error.code === 'ACTION_REJECTED') {
      alert('❌ Bạn đã từ chối transaction')
    } else if (error.code === 'INSUFFICIENT_FUNDS') {
      alert('❌ Không đủ tRBTC! Vui lòng nhận test token tại:\nhttps://faucet.testnet.rsk.co')
    } else if (error.reason) {
      alert('❌ Lỗi contract: ' + error.reason)
    } else if (error.message.includes('RPC') || error.message.includes('fetch')) {
      alert('❌ Lỗi RPC. Đang thử kết nối lại...')
      switchRPC()
    } else if (error.message.includes('nonce')) {
      alert('❌ Lỗi nonce. Vui lòng reset tài khoản MetaMask.')
    } else {
      alert('❌ Lỗi: ' + error.message)
    }
  }

  const verifyDocument = async () => {
    if (!documentHash) {
      alert('⚠️ Vui lòng nhập hash document')
      return
    }

    try {
      setLoading(true)
      setStatus('🔍 Đang xác minh...')
      
      // ✅ XÁC MINH VỚI CONTRACT
      let retries = 2
      while (retries > 0) {
        try {
          const provider = getProvider()
          const contractInstance = new ethers.Contract(contractAddress, contractABI, provider)
          
          const isVerified = await contractInstance.verifyDocument(documentHash)
          setVerificationResult(isVerified ? '✅ GIẤY TỜ HỢP LỆ' : '❌ GIẤY TỜ KHÔNG HỢP LỆ')
          setStatus('✅ Xác minh hoàn tất')
          break
        } catch (error) {
          retries--
          if (retries === 0) {
            throw error
          }
          console.log(`Retrying verification... (${retries} left)`)
          switchRPC()
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      
    } catch (error) {
      console.error('Lỗi xác minh:', error)
      if (error.message.includes('document does not exist')) {
        setVerificationResult('❌ GIẤY TỜ KHÔNG TỒN TẠI')
      } else {
        alert('❌ Lỗi xác minh: ' + error.message)
        setVerificationResult('❌ LỖI XÁC MINH')
      }
      setStatus('❌ Lỗi xác minh')
    }
    setLoading(false)
  }

  const clearResults = () => {
    setDocumentHash('')
    setFileName('')
    setVerificationResult('')
  }

  const retryConnection = () => {
    setStatus('🔄 Đang thử kết nối lại...')
    connectWallet()
  }

  const getTestRBTC = () => {
    window.open('https://faucet.testnet.rsk.co', '_blank')
  }

  const viewOnExplorer = () => {
    window.open(`https://explorer.testnet.rootstock.io/address/${contractAddress}`, '_blank')
  }

  const copyContractAddress = async () => {
    try {
      await navigator.clipboard.writeText(contractAddress)
      alert('✅ Đã copy contract address!')
    } catch (error) {
      console.error('Lỗi copy:', error)
    }
  }

  // Format balance để hiển thị
  const displayBalance = userBalance === '0' ? '0' : parseFloat(userBalance).toFixed(6)
  const hasSufficientBalance = parseFloat(userBalance) >= MINIMUM_BALANCE

  // Thêm useEffect để debug
  useEffect(() => {
    console.log('🔄 UserBalance updated:', {
      userBalance,
      displayBalance,
      hasSufficientBalance,
      minimum: MINIMUM_BALANCE
    })
  }, [userBalance])

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🆔 XÁC THỰC GIẤY TỜ</h1>
        <p style={styles.subtitle}>Rootstock Blockchain - Testnet</p>
        <div style={styles.statusContainer}>
          <p style={styles.status}>{status}</p>
          {status.includes('Lỗi') && (
            <button onClick={retryConnection} style={styles.retryButton}>
              🔄 Thử lại
            </button>
          )}
        </div>
        
        {/* ✅ HIỂN THỊ THÔNG TIN CONTRACT */}
        <div style={styles.contractInfo}>
          <p>📝 <strong>Contract:</strong> {contractAddress.substring(0, 10)}...{contractAddress.substring(contractAddress.length - 8)}</p>
          <button onClick={viewOnExplorer} style={styles.explorerButton}>
            🔍 Explorer
          </button>
          <button onClick={copyContractAddress} style={styles.copyButton}>
            📋 Copy
          </button>
        </div>
      </header>

      {!account ? (
        <div style={styles.connectSection}>
          <button onClick={connectWallet} style={styles.connectButton}>
            🔗 Kết nối Rootstock Testnet
          </button>
          <p style={styles.note}>Tự động thêm Rootstock Testnet vào MetaMask</p>
          
          <div style={styles.info}>
            <p>💡 <strong>Thông tin Contract:</strong></p>
            <p>Address: <strong>{contractAddress}</strong></p>
            <p>Network: <strong>Rootstock Testnet</strong></p>
            <p>Chain ID: <strong>31 (0x1F)</strong></p>
            <p>Status: <strong>✅ Đã deploy thành công</strong></p>
          </div>

          <div style={styles.gasInfo}>
            <p>📦 Đăng ký document: ~0.0003 tRBTC</p>
            <p>🔍 Xác minh document: ~0.00005 tRBTC</p>
            <p>🆓 <button onClick={getTestRBTC} style={styles.linkButton}>
              Nhận tRBTC miễn phí tại đây
            </button></p>
          </div>
        </div>
      ) : (
        <div style={styles.mainContent}>
          {/* ✅ HIỂN THỊ BALANCE CỦA USER */}
          <div style={styles.accountInfo}>
            <div style={styles.balanceHeader}>
              <p>👤 Ví: {account.substring(0, 6)}...{account.substring(account.length - 4)}</p>
              <div style={styles.balanceDisplay}>
                <span style={styles.balanceLabel}>Balance:</span>
                <span style={styles.balanceAmount}>{displayBalance} tRBTC</span>
                {hasSufficientBalance ? (
                  <span style={styles.sufficientBalance}>✅ Đủ</span>
                ) : (
                  <span style={styles.lowBalanceWarning}>⚠️ Thấp</span>
                )}
              </div>
            </div>
            
            {/* THÔNG TIN CHI TIẾT BALANCE */}
            {parseFloat(userBalance) > 0 && (
              <div style={styles.balanceDetails}>
                <div style={styles.transactionStats}>
                  <p><strong>📊 Có thể thực hiện:</strong></p>
                  <div style={styles.statsGrid}>
                    <div style={styles.statItem}>
                      <span>📝 Đăng ký:</span>
                      <span style={styles.statValue}>{transactionStats.canRegister} documents</span>
                    </div>
                    <div style={styles.statItem}>
                      <span>🔍 Xác minh:</span>
                      <span style={styles.statValue}>{transactionStats.canVerify} lần</span>
                    </div>
                  </div>
                </div>
                
                <div style={styles.costBreakdown}>
                  <p><strong>💸 Chi phí ước tính:</strong></p>
                  <p>• Đăng ký document: ~0.0003 tRBTC</p>
                  <p>• Xác minh document: ~0.00005 tRBTC</p>
                  <p>• Tối thiểu: {MINIMUM_BALANCE} tRBTC</p>
                </div>
              </div>
            )}
            
            <p>🌐 Network: Rootstock Testnet</p>
            <p>📊 {status}</p>
          </div>

          <div style={styles.gasInfo}>
            <p>💰 Phí gas ước tính: Đăng ký ~0.0003 tRBTC | Xác minh ~0.00005 tRBTC</p>
            <p>🆓 <button onClick={getTestRBTC} style={styles.linkButton}>
              Nhận tRBTC test token
            </button></p>
            <p>🔍 <button onClick={viewOnExplorer} style={styles.linkButton}>
              Xem contract trên Explorer
            </button></p>
          </div>

          <div style={styles.section}>
            <h2>📤 ĐĂNG KÝ GIẤY TỜ MỚI</h2>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Loại giấy tờ:</label>
              <select 
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                style={styles.select}
              >
                <option value="CMND">CMND/CCCD</option>
                <option value="BANG_LAI">Bằng lái xe</option>
                <option value="HO_KHAU">Sổ hộ khẩu</option>
                <option value="BANG_CAP">Bằng cấp</option>
                <option value="HOP_DONG">Hợp đồng</option>
                <option value="KHAC">Khác</option>
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Chọn file:</label>
              <input 
                type="file" 
                onChange={handleFileUpload}
                style={styles.fileInput}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                disabled={loading}
              />
              {fileName && <p style={styles.fileName}>📄 {fileName}</p>}
            </div>

            {documentHash && (
              <div style={styles.hashDisplay}>
                <p><strong>🔐 Hash document:</strong></p>
                <p style={styles.hashText}>{documentHash}</p>
                <p style={styles.noteText}><small>Lưu hash này để xác minh sau</small></p>
              </div>
            )}

            <button 
              onClick={registerDocument}
              disabled={loading || !documentHash || !hasSufficientBalance}
              style={{
                ...styles.primaryButton,
                ...((loading || !documentHash || !hasSufficientBalance) && styles.disabledButton)
              }}
            >
              {loading ? '⏳ Đang xử lý...' : '✅ Đăng ký Document'}
            </button>

            {!hasSufficientBalance && (
              <p style={styles.insufficientFunds}>
                ❌ Không đủ balance để thực hiện giao dịch (cần ít nhất {MINIMUM_BALANCE} tRBTC)
              </p>
            )}
          </div>

          <div style={styles.section}>
            <h2>🔍 XÁC MINH GIẤY TỜ</h2>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Hash document:</label>
              <input 
                type="text"
                placeholder="Dán hash document tại đây..."
                value={documentHash}
                onChange={(e) => setDocumentHash(e.target.value)}
                style={styles.input}
              />
            </div>

            <div style={styles.buttonGroup}>
              <button 
                onClick={verifyDocument}
                disabled={loading || !documentHash}
                style={{
                  ...styles.secondaryButton,
                  ...((loading || !documentHash) && styles.disabledButton)
                }}
              >
                {loading ? '⏳ Đang xác minh...' : '🔎 Xác minh Document'}
              </button>
              
              <button onClick={clearResults} style={styles.clearButton}>
                🗑️ Xóa
              </button>
            </div>

            {verificationResult && (
              <div style={{
                ...styles.result,
                ...(verificationResult.includes('HỢP LỆ') ? styles.validResult : styles.invalidResult)
              }}>
                <h3>KẾT QUẢ XÁC MINH</h3>
                <p style={styles.resultText}>{verificationResult}</p>
                <p><strong>Hash:</strong> {documentHash.substring(0, 20)}...{documentHash.substring(documentHash.length - 10)}</p>
                <p><strong>Thời gian:</strong> {new Date().toLocaleString('vi-VN')}</p>
                <p><strong>Network:</strong> Rootstock Testnet</p>
                <p><strong>Contract:</strong> {contractAddress.substring(0, 10)}...{contractAddress.substring(contractAddress.length - 8)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <footer style={styles.footer}>
        <p>© 2024 Hệ thống xác thực giấy tờ - Rootstock Testnet</p>
        <p>Contract: {contractAddress}</p>
        <p>✅ Contract đã được deploy và sẵn sàng sử dụng!</p>
      </footer>
    </div>
  )
}

// Styles (giữ nguyên từ code trước)
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
  },
  header: {
    textAlign: 'center',
    color: 'white',
    marginBottom: '40px'
  },
  title: {
    fontSize: '2.5rem',
    margin: '0 0 10px 0',
    textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
  },
  subtitle: {
    fontSize: '1.2rem',
    opacity: 0.9,
    margin: 0
  },
  statusContainer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginTop: '10px'
  },
  status: {
    fontSize: '1rem',
    margin: 0,
    fontWeight: 'bold',
    background: 'rgba(255,255,255,0.2)',
    display: 'inline-block',
    padding: '5px 15px',
    borderRadius: '20px'
  },
  contractInfo: {
    background: 'rgba(255,255,255,0.1)',
    padding: '10px 15px',
    borderRadius: '10px',
    marginTop: '15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    flexWrap: 'wrap'
  },
  retryButton: {
    padding: '8px 16px',
    backgroundColor: '#ff6b6b',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '0.9rem'
  },
  explorerButton: {
    padding: '6px 12px',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '0.8rem'
  },
  copyButton: {
    padding: '6px 12px',
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '0.8rem'
  },
  connectSection: {
    textAlign: 'center',
    background: 'white',
    padding: '40px',
    borderRadius: '15px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
    maxWidth: '600px',
    margin: '0 auto'
  },
  connectButton: {
    padding: '15px 30px',
    fontSize: '1.1rem',
    backgroundColor: '#f6851b',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    marginBottom: '15px',
    width: '100%',
    fontWeight: 'bold'
  },
  note: {
    color: '#666',
    fontSize: '0.9rem',
    margin: '0 0 20px 0'
  },
  info: {
    background: '#e3f2fd',
    border: '1px solid #2196f3',
    padding: '15px',
    borderRadius: '8px',
    margin: '15px 0',
    textAlign: 'left',
    fontSize: '0.9rem'
  },
  gasInfo: {
    background: '#e8f5e8',
    border: '1px solid #4caf50',
    padding: '15px',
    borderRadius: '8px',
    margin: '15px 0',
    textAlign: 'left'
  },
  linkButton: {
    background: 'none',
    border: 'none',
    color: '#2196f3',
    textDecoration: 'underline',
    cursor: 'pointer',
    fontSize: '1rem'
  },
  mainContent: {
    maxWidth: '800px',
    margin: '0 auto'
  },
  accountInfo: {
    background: 'white',
    padding: '20px',
    borderRadius: '10px',
    marginBottom: '20px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
  },
  balanceHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
    flexWrap: 'wrap',
    gap: '10px'
  },
  balanceDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#f8f9fa',
    padding: '8px 15px',
    borderRadius: '20px',
    border: '1px solid #e9ecef'
  },
  balanceLabel: {
    fontWeight: 'bold',
    color: '#666'
  },
  balanceAmount: {
    fontWeight: 'bold',
    color: '#27ae60',
    fontSize: '1.1rem'
  },
  sufficientBalance: {
    background: '#27ae60',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '0.7rem',
    fontWeight: 'bold'
  },
  lowBalanceWarning: {
    background: '#ff6b6b',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '10px',
    fontSize: '0.7rem',
    fontWeight: 'bold'
  },
  balanceDetails: {
    background: '#f8f9fa',
    padding: '15px',
    borderRadius: '8px',
    margin: '15px 0',
    border: '1px solid #e9ecef'
  },
  transactionStats: {
    marginBottom: '15px'
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    marginTop: '10px'
  },
  statItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px',
    background: 'white',
    borderRadius: '6px',
    border: '1px solid #ddd'
  },
  statValue: {
    fontWeight: 'bold',
    color: '#27ae60'
  },
  costBreakdown: {
    fontSize: '0.9rem',
    color: '#666'
  },
  section: {
    background: 'white',
    padding: '30px',
    borderRadius: '15px',
    marginBottom: '20px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontWeight: 'bold',
    color: '#333'
  },
  select: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '1rem',
    marginTop: '5px'
  },
  fileInput: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    marginTop: '5px'
  },
  fileName: {
    margin: '10px 0 0 0',
    color: '#27ae60',
    fontWeight: 'bold'
  },
  input: {
    width: '100%',
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '1rem',
    marginTop: '5px'
  },
  hashDisplay: {
    background: '#f8f9fa',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '15px',
    border: '1px solid #e9ecef'
  },
  hashText: {
    wordBreak: 'break-all',
    fontSize: '0.9rem',
    fontFamily: 'monospace',
    background: '#e9ecef',
    padding: '10px',
    borderRadius: '4px',
    margin: '10px 0'
  },
  noteText: {
    color: '#666',
    fontSize: '0.8rem',
    margin: '5px 0 0 0'
  },
  primaryButton: {
    width: '100%',
    padding: '15px',
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    cursor: 'pointer',
    marginTop: '10px',
    fontWeight: 'bold'
  },
  secondaryButton: {
    padding: '15px 25px',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    cursor: 'pointer',
    flex: 1,
    fontWeight: 'bold'
  },
  clearButton: {
    padding: '15px 25px',
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    cursor: 'pointer',
    marginLeft: '10px',
    fontWeight: 'bold'
  },
  disabledButton: {
    opacity: 0.6,
    cursor: 'not-allowed'
  },
  buttonGroup: {
    display: 'flex',
    gap: '10px',
    marginTop: '15px'
  },
  result: {
    padding: '20px',
    borderRadius: '8px',
    textAlign: 'center',
    marginTop: '20px',
    border: '2px solid'
  },
  resultText: {
    fontSize: '1.2rem',
    fontWeight: 'bold',
    margin: '10px 0'
  },
  validResult: {
    backgroundColor: '#d4edda',
    color: '#155724',
    borderColor: '#c3e6cb'
  },
  invalidResult: {
    backgroundColor: '#f8d7da',
    color: '#721c24',
    borderColor: '#f5c6cb'
  },
  insufficientFunds: {
    color: '#e74c3c',
    textAlign: 'center',
    marginTop: '10px',
    fontWeight: 'bold'
  },
  footer: {
    textAlign: 'center',
    color: 'white',
    marginTop: '40px',
    opacity: 0.8,
    fontSize: '0.9rem'
  }
}