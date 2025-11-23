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
  const [userBalance, setUserBalance] = useState(0) // ✅ ĐỔI THÀNH NUMBER
  const [hasSufficientBalance, setHasSufficientBalance] = useState(false)

  // ✅ CONSTANTS
  const MINIMUM_BALANCE = 0.00005
  const CONTRACT_ADDRESS = "0xF561493424f457938C078a304e5B6F96765cec1d"
  
  const contractABI = [
    "function registerDocument(string _documentHash, string _documentType) external",
    "function verifyDocument(string _documentHash) external view returns (bool)",
    "event DocumentRegistered(string indexed documentHash, address indexed owner, uint256 timestamp)"
  ]

  // ✅ HÀM LẤY BALANCE ĐƠN GIẢN
  const getBalance = async (address) => {
    if (!window.ethereum) return 0
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const balance = await provider.getBalance(address)
      return parseFloat(ethers.formatEther(balance))
    } catch (error) {
      console.error('Lỗi lấy balance:', error)
      return 0
    }
  }

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        setStatus('🔄 Đang kết nối...')

        // Kết nối ví
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        })
        const userAccount = accounts[0]
        setAccount(userAccount)
        
        // Kiểm tra network
        const provider = new ethers.BrowserProvider(window.ethereum)
        const network = await provider.getNetwork()
        
        if (network.chainId !== 31n) {
          setStatus('🔄 Đang chuyển sang Rootstock Testnet...')
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x1F' }]
            })
          } catch (switchError) {
            if (switchError.code === 4902) {
              await window.ethereum.request({
                method: 'wallet_addEthereumChain',
                params: [{
                  chainId: '0x1F',
                  chainName: 'Rootstock Testnet',
                  nativeCurrency: { name: 'tRBTC', symbol: 'tRBTC', decimals: 18 },
                  rpcUrls: ['https://public-node.testnet.rsk.co'],
                  blockExplorerUrls: ['https://explorer.testnet.rootstock.io/']
                }]
              })
            }
          }
          await new Promise(resolve => setTimeout(resolve, 2000))
        }

        // ✅ LẤY BALANCE TRƯỚC
        setStatus('💰 Đang lấy balance...')
        const balance = await getBalance(userAccount)
        console.log('💰 Balance thực tế:', balance)
        setUserBalance(balance)
        setHasSufficientBalance(balance >= MINIMUM_BALANCE)

        // Tạo contract instance
        const signer = await provider.getSigner()
        const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, contractABI, signer)
        setContract(contractInstance)
        
        setStatus(`✅ Đã kết nối! Balance: ${balance.toFixed(6)} tRBTC`)

      } catch (error) {
        console.error('Lỗi kết nối:', error)
        setStatus('❌ Lỗi kết nối')
        alert('Lỗi: ' + error.message)
      }
    } else {
      alert('⚠️ Vui lòng cài đặt MetaMask!')
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
    console.log('🔍 DEBUG REGISTER:', {
      userBalance,
      hasSufficientBalance,
      minimum: MINIMUM_BALANCE
    })

    if (!contract) {
      alert('⚠️ Vui lòng kết nối ví trước')
      return
    }
    
    // ✅ KIỂM TRA BALANCE ĐƠN GIẢN
    if (userBalance < MINIMUM_BALANCE) {
      alert(`❌ Không đủ tRBTC!\n\nBalance: ${userBalance.toFixed(6)} tRBTC\nCần ít nhất: ${MINIMUM_BALANCE} tRBTC`)
      return
    }
    
    if (!documentHash) {
      alert('⚠️ Vui lòng upload file trước')
      return
    }

    try {
      setLoading(true)
      setStatus('🔄 Đang gửi transaction...')

      const tx = await contract.registerDocument(documentHash, documentType, {
        gasLimit: 500000,
        gasPrice: ethers.parseUnits('1', 'gwei')
      })
      
      alert('⏳ Đang xác nhận transaction...')
      
      const receipt = await tx.wait()
      
      // ✅ CẬP NHẬT BALANCE SAU KHI THÀNH CÔNG
      const newBalance = await getBalance(account)
      setUserBalance(newBalance)
      setHasSufficientBalance(newBalance >= MINIMUM_BALANCE)
      
      setStatus('✅ Đăng ký thành công!')
      alert(`🎉 THÀNH CÔNG! Transaction Hash: ${receipt.hash}`)

    } catch (error) {
      console.error('Lỗi transaction:', error)
      setStatus('❌ Lỗi transaction')
      if (error.code === 'ACTION_REJECTED') {
        alert('❌ Bạn đã từ chối transaction')
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        alert('❌ Không đủ tRBTC!')
      } else {
        alert('❌ Lỗi: ' + error.message)
      }
    }
    setLoading(false)
  }

  const verifyDocument = async () => {
    if (!documentHash) {
      alert('⚠️ Vui lòng nhập hash document')
      return
    }

    try {
      setLoading(true)
      setStatus('🔍 Đang xác minh...')
      
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contractInstance = new ethers.Contract(CONTRACT_ADDRESS, contractABI, provider)
      
      const isVerified = await contractInstance.verifyDocument(documentHash)
      setVerificationResult(isVerified ? '✅ GIẤY TỜ HỢP LỆ' : '❌ GIẤY TỜ KHÔNG HỢP LỆ')
      setStatus('✅ Xác minh hoàn tất')
      
    } catch (error) {
      console.error('Lỗi xác minh:', error)
      setVerificationResult('❌ LỖI XÁC MINH')
      setStatus('❌ Lỗi xác minh')
    }
    setLoading(false)
  }

  const clearResults = () => {
    setDocumentHash('')
    setFileName('')
    setVerificationResult('')
  }

  const getTestRBTC = () => {
    window.open('https://faucet.testnet.rsk.co', '_blank')
  }

  // ✅ TÍNH TOÁN SỐ LẦN CÓ THỂ THỰC HIỆN
  const canRegister = Math.floor(userBalance / 0.0003)
  const canVerify = Math.floor(userBalance / 0.00005)

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🆔 XÁC THỰC GIẤY TỜ</h1>
        <p style={styles.subtitle}>Rootstock Testnet - Balance: {userBalance.toFixed(6)} tRBTC</p>
        <div style={styles.statusContainer}>
          <p style={styles.status}>{status}</p>
        </div>
      </header>

      {!account ? (
        <div style={styles.connectSection}>
          <button onClick={connectWallet} style={styles.connectButton}>
            🔗 Kết nối Ví MetaMask
          </button>
          <div style={styles.info}>
            <p>Contract: {CONTRACT_ADDRESS}</p>
            <p>Network: Rootstock Testnet (Chain ID: 31)</p>
          </div>
        </div>
      ) : (
        <div style={styles.mainContent}>
          {/* ✅ HIỂN THỊ BALANCE ĐƠN GIẢN */}
          <div style={styles.accountInfo}>
            <p>👤 Ví: {account.substring(0, 6)}...{account.substring(account.length - 4)}</p>
            <p>💰 Balance: <strong>{userBalance.toFixed(6)} tRBTC</strong></p>
            <p>📊 {hasSufficientBalance ? '✅ Đủ balance để giao dịch' : '❌ Balance thấp'}</p>
            {userBalance > 0 && (
              <div style={styles.balanceDetails}>
                <p>📝 Có thể đăng ký: <strong>{canRegister}</strong> documents</p>
                <p>🔍 Có thể xác minh: <strong>{canVerify}</strong> lần</p>
              </div>
            )}
            <button onClick={getTestRBTC} style={styles.faucetButton}>
              🆓 Nhận Test Token
            </button>
          </div>

          <div style={styles.section}>
            <h2>📤 ĐĂNG KÝ GIẤY TỜ MỚI</h2>
            
            <div style={styles.formGroup}>
              <label>Loại giấy tờ:</label>
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
              </select>
            </div>

            <div style={styles.formGroup}>
              <label>Chọn file:</label>
              <input 
                type="file" 
                onChange={handleFileUpload}
                style={styles.fileInput}
                disabled={loading}
              />
              {fileName && <p>📄 {fileName}</p>}
            </div>

            {documentHash && (
              <div style={styles.hashDisplay}>
                <p><strong>Hash:</strong> {documentHash}</p>
              </div>
            )}

            <button 
              onClick={registerDocument}
              disabled={loading || !documentHash || userBalance < MINIMUM_BALANCE}
              style={{
                ...styles.primaryButton,
                ...(userBalance < MINIMUM_BALANCE && styles.disabledButton)
              }}
            >
              {loading ? '⏳ Đang xử lý...' : '✅ Đăng ký Document'}
            </button>

            {userBalance < MINIMUM_BALANCE && (
              <p style={styles.warning}>
                ❌ Cần ít nhất {MINIMUM_BALANCE} tRBTC
              </p>
            )}
          </div>

          <div style={styles.section}>
            <h2>🔍 XÁC MINH GIẤY TỜ</h2>
            
            <div style={styles.formGroup}>
              <label>Hash document:</label>
              <input 
                type="text"
                value={documentHash}
                onChange={(e) => setDocumentHash(e.target.value)}
                style={styles.input}
                placeholder="Dán hash document..."
              />
            </div>

            <button 
              onClick={verifyDocument}
              disabled={loading || !documentHash}
              style={styles.secondaryButton}
            >
              {loading ? '⏳ Đang xác minh...' : '🔎 Xác minh'}
            </button>

            {verificationResult && (
              <div style={{
                ...styles.result,
                ...(verificationResult.includes('HỢP LỆ') ? styles.validResult : styles.invalidResult)
              }}>
                <h3>{verificationResult}</h3>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Styles đơn giản
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
  },
  header: {
    textAlign: 'center',
    color: 'white',
    marginBottom: '30px'
  },
  title: {
    fontSize: '2rem',
    marginBottom: '10px'
  },
  subtitle: {
    fontSize: '1.1rem',
    opacity: 0.9
  },
  statusContainer: {
    marginTop: '10px'
  },
  status: {
    background: 'rgba(255,255,255,0.2)',
    padding: '8px 16px',
    borderRadius: '20px',
    display: 'inline-block'
  },
  connectSection: {
    textAlign: 'center',
    background: 'white',
    padding: '40px',
    borderRadius: '15px',
    maxWidth: '500px',
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
    marginBottom: '20px',
    width: '100%'
  },
  info: {
    background: '#f8f9fa',
    padding: '15px',
    borderRadius: '8px',
    fontSize: '0.9rem'
  },
  mainContent: {
    maxWidth: '600px',
    margin: '0 auto'
  },
  accountInfo: {
    background: 'white',
    padding: '20px',
    borderRadius: '10px',
    marginBottom: '20px',
    textAlign: 'center'
  },
  balanceDetails: {
    background: '#e8f5e8',
    padding: '10px',
    borderRadius: '5px',
    margin: '10px 0'
  },
  faucetButton: {
    background: '#3498db',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '5px',
    cursor: 'pointer',
    marginTop: '10px'
  },
  section: {
    background: 'white',
    padding: '25px',
    borderRadius: '10px',
    marginBottom: '20px'
  },
  formGroup: {
    marginBottom: '15px'
  },
  select: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    marginTop: '5px'
  },
  fileInput: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    marginTop: '5px'
  },
  input: {
    width: '100%',
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '5px',
    marginTop: '5px'
  },
  hashDisplay: {
    background: '#f8f9fa',
    padding: '10px',
    borderRadius: '5px',
    margin: '10px 0',
    wordBreak: 'break-all',
    fontSize: '0.9rem'
  },
  primaryButton: {
    width: '100%',
    padding: '15px',
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    cursor: 'pointer',
    marginTop: '10px'
  },
  secondaryButton: {
    width: '100%',
    padding: '15px',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1rem',
    cursor: 'pointer',
    marginTop: '10px'
  },
  disabledButton: {
    backgroundColor: '#95a5a6',
    cursor: 'not-allowed'
  },
  warning: {
    color: '#e74c3c',
    textAlign: 'center',
    marginTop: '10px',
    fontWeight: 'bold'
  },
  result: {
    padding: '15px',
    borderRadius: '5px',
    textAlign: 'center',
    marginTop: '15px',
    fontWeight: 'bold'
  },
  validResult: {
    backgroundColor: '#d4edda',
    color: '#155724'
  },
  invalidResult: {
    backgroundColor: '#f8d7da',
    color: '#721c24'
  }
}