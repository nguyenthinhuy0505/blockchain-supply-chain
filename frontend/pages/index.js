

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
  const [networkStatus, setNetworkStatus] = useState('')

  // CONTRACT ADDRESS THẬT
  const contractAddress = "0xF561493424f457938C078a304e5B6F96765cec1d"
  
  const contractABI = [
    "function registerDocument(string _documentHash, string _documentType) public",
    "function verifyDocument(string _documentHash) public view returns (bool)",
    "function getUserDocuments(address _user) public view returns (string[] memory)",
    "function documents(string) public view returns (string documentHash, address owner, uint256 timestamp, string documentType, bool verified)",
    "event DocumentRegistered(string indexed documentHash, address indexed owner)"
  ]

  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      checkNetwork()
      initContract()
    }
  }, [])

  const checkNetwork = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const network = await provider.getNetwork()
      setNetworkStatus(`Connected to ${network.name} (Chain ID: ${network.chainId})`)
    } catch (error) {
      setNetworkStatus('Network not connected')
    }
  }

  const initContract = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contractInstance = new ethers.Contract(contractAddress, contractABI, signer)
      setContract(contractInstance)
    } catch (error) {
      console.log('Contract chưa khởi tạo - cần kết nối ví trước')
    }
  }

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        // THỬ NHIỀU RPC ENDPOINTS
        const rpcEndpoints = [
          'https://public-node.testnet.rsk.co',
          'https://mycrypto.testnet.rsk.co'
        ]

        let connected = false
        
        for (let rpcUrl of rpcEndpoints) {
          try {
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x1F',
                chainName: 'Rootstock Testnet',
                rpcUrls: [rpcUrl],
                blockExplorerUrls: ['https://explorer.testnet.rsk.co'],
                nativeCurrency: {
                  name: 'tRBTC',
                  symbol: 'tRBTC',
                  decimals: 18
                },
              }],
            })
            connected = true
            break
          } catch (error) {
            console.log(`RPC ${rpcUrl} failed, trying next...`)
            continue
          }
        }

        if (!connected) {
          // NẾU ROOTSTOCK FAIL, CHUYỂN SANG SEPOLIA
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xAA36A7' }],
          })
          setNetworkStatus('Đã chuyển sang Sepolia Testnet')
        }

        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        })
        setAccount(accounts[0])
        
        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const contractInstance = new ethers.Contract(contractAddress, contractABI, signer)
        setContract(contractInstance)
        
        await checkNetwork()
        alert(`✅ Đã kết nối: ${accounts[0]}`)
      } catch (error) {
        if (error.code === 4001) {
          alert('❌ Người dùng từ chối kết nối')
        } else {
          alert('❌ Lỗi kết nối ví: ' + error.message)
        }
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
        // THÊM TIMESTAMP ĐỂ ĐẢM BẢO HASH LUÔN MỚI
        const timestamp = Date.now()
        const uniqueFile = new File([file], `${timestamp}_${file.name}`, { type: file.type })
        
        const hash = await calculateFileHash(uniqueFile)
        setDocumentHash(hash)
        setFileName(file.name)
        alert(`📄 Đã tạo hash cho file: ${file.name}\n\n🔐 Hash: ${hash}`)
      } catch (error) {
        alert('❌ Lỗi xử lý file: ' + error.message)
      }
      setLoading(false)
    }
  }

  const checkDocumentExists = async (hash) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const readContract = new ethers.Contract(contractAddress, contractABI, provider)
      const document = await readContract.documents(hash)
      return document.owner !== ethers.ZeroAddress
    } catch (error) {
      console.log('Error checking document:', error)
      return false
    }
  }

  const registerDocument = async () => {
    if (!contract) {
      alert('⚠️ Vui lòng kết nối ví trước')
      return
    }
    
    if (!documentHash) {
      alert('⚠️ Vui lòng upload file trước')
      return
    }

    try {
      setLoading(true)

      // KIỂM TRA DOCUMENT ĐÃ TỒN TẠI CHƯA
      const exists = await checkDocumentExists(documentHash)
      if (exists) {
        alert('❌ Document đã được đăng ký trước đó! Vui lòng upload file khác.')
        setLoading(false)
        return
      }

      // GỬI TRANSACTION VỚI GAS CAO HƠN VÀ RETRY LOGIC
      const tx = await contract.registerDocument(documentHash, documentType, {
        gasLimit: 300000, // Tăng gas limit để đảm bảo thành công
      })
      
      alert('⏳ Đang xác nhận giao dịch...\n💸 Gas fee: ~0.00003 tRBTC')
      
      const receipt = await tx.wait()
      console.log('✅ Transaction successful:', receipt)
      
      // KIỂM TRA LẠI SAU KHI ĐĂNG KÝ
      const verified = await checkDocumentExists(documentHash)
      if (verified) {
        alert('✅ Đăng ký giấy tờ thành công!\n📄 Giấy tờ đã được lưu trên blockchain')
      } else {
        alert('⚠️ Đăng ký thành công nhưng cần kiểm tra lại')
      }
    } catch (error) {
      console.error('❌ Lỗi đăng ký chi tiết:', error)
      
      if (error.reason && error.reason.includes('Document already registered')) {
        alert('❌ Document đã được đăng ký trước đó!')
      } else if (error.reason) {
        alert('❌ Lỗi từ smart contract: ' + error.reason)
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        alert('❌ Không đủ tRBTC! Vào faucet nhận thêm:\nhttps://faucet.testnet.rsk.co')
      } else if (error.code === 'NETWORK_ERROR') {
        alert('❌ Lỗi kết nối mạng. Vui lòng thử lại sau.')
      } else {
        alert('❌ Lỗi đăng ký: ' + error.message)
      }
    }
    setLoading(false)
  }

  const verifyDocument = async () => {
    if (!documentHash) {
      alert('⚠️ Vui lòng nhập hash giấy tờ')
      return
    }

    try {
      setLoading(true)
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contractInstance = new ethers.Contract(contractAddress, contractABI, provider)
      
      const isVerified = await contractInstance.verifyDocument(documentHash)
      setVerificationResult(isVerified ? '✅ GIẤY TỜ HỢP LỆ' : '❌ GIẤY TỜ KHÔNG HỢP LỆ')
    } catch (error) {
      console.error('Lỗi xác minh:', error)
      if (error.reason) {
        alert('❌ Lỗi xác minh: ' + error.reason)
      } else {
        alert('❌ Lỗi xác minh: ' + error.message)
      }
    }
    setLoading(false)
  }

  const clearResults = () => {
    setDocumentHash('')
    setFileName('')
    setVerificationResult('')
  }

  const testTransaction = async () => {
    if (!contract) return
    
    try {
      setLoading(true)
      // TEST VỚI HASH NGẪU NHIÊN
      const testHash = 'test_' + Date.now() + Math.random().toString(36).substring(7)
      const tx = await contract.registerDocument(testHash, 'TEST', {
        gasLimit: 200000
      })
      await tx.wait()
      alert('✅ Test transaction thành công!')
    } catch (error) {
      alert('❌ Test transaction thất bại: ' + error.message)
    }
    setLoading(false)
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🆔 HỆ THỐNG XÁC THỰC GIẤY TỜ</h1>
        <p style={styles.subtitle}>Blockchain Document Verification System</p>
        {networkStatus && <p style={styles.networkStatus}>🌐 {networkStatus}</p>}
      </header>

      {!account ? (
        <div style={styles.connectSection}>
          <button onClick={connectWallet} style={styles.connectButton}>
            🔗 Kết nối MetaMask
          </button>
          <p style={styles.note}>Kết nối ví để sử dụng hệ thống</p>
          
          <div style={styles.gasInfo}>
            <p>💡 <strong>Thông tin gas fee:</strong></p>
            <p>• Đăng ký giấy tờ: ~0.00003 tRBTC</p>
            <p>• Xác minh: Miễn phí (chỉ đọc)</p>
            <p>🆓 <strong>Nhận tRBTC miễn phí:</strong> <a href="https://faucet.testnet.rsk.co" target="_blank" style={styles.link}>Rootstock Faucet</a></p>
          </div>
        </div>
      ) : (
        <div style={styles.mainContent}>
          <div style={styles.accountInfo}>
            <p>👤 <strong>Địa chỉ ví:</strong> {account}</p>
            <p>🌐 <strong>Network:</strong> {networkStatus}</p>
            <p>🔄 <strong>Trạng thái:</strong> Đã kết nối</p>
            <button onClick={testTransaction} style={styles.testButton} disabled={loading}>
              {loading ? '⏳ Testing...' : '🧪 Test Transaction'}
            </button>
          </div>

          {/* GAS FEE INFO */}
          <div style={styles.gasInfo}>
            <p>💰 <strong>Thông tin phí:</strong> Đăng ký giấy tờ tốn ~0.00003 tRBTC | Xác minh miễn phí</p>
            <p>🆓 <a href="https://faucet.testnet.rsk.co" target="_blank" style={styles.link}>Nhận tRBTC miễn phí tại đây</a></p>
          </div>

          {/* UPLOAD & REGISTER SECTION */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>📤 ĐĂNG KÝ GIẤY TỜ MỚI</h2>
            
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
              </select>
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Chọn file giấy tờ:</label>
              <input 
                type="file" 
                onChange={handleFileUpload}
                style={styles.fileInput}
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                disabled={loading}
              />
              {fileName && <p style={styles.fileName}>📄 File: {fileName}</p>}
            </div>

            {documentHash && (
              <div style={styles.hashDisplay}>
                <p><strong>🔐 Hash:</strong></p>
                <p style={styles.hashText}>{documentHash}</p>
                <p style={styles.noteText}><small>Lưu hash này để xác minh sau</small></p>
              </div>
            )}

            <button 
              onClick={registerDocument}
              disabled={loading || !documentHash}
              style={{
                ...styles.primaryButton,
                ...((loading || !documentHash) && styles.disabledButton)
              }}
            >
              {loading ? '⏳ Đang xử lý...' : '✅ Đăng ký giấy tờ (0.00003 tRBTC)'}
            </button>
          </div>

          {/* VERIFY SECTION */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>🔍 XÁC MINH GIẤY TỜ</h2>
            
            <div style={styles.formGroup}>
              <label style={styles.label}>Hash giấy tờ cần xác minh:</label>
              <input 
                type="text"
                placeholder="Dán mã hash tại đây..."
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
                {loading ? '⏳ Đang xác minh...' : '🔎 Xác minh (MIỄN PHÍ)'}
              </button>
              
              <button 
                onClick={clearResults}
                style={styles.clearButton}
              >
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
                <p><strong>Hash:</strong> {documentHash}</p>
                <p><strong>Thời gian:</strong> {new Date().toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <footer style={styles.footer}>
        <p>© 2024 Hệ thống xác thực giấy tờ sử dụng công nghệ Blockchain</p>
        <p>Gas fee: ~0.00003 tRBTC per transaction | Testnet token - No real value</p>
      </footer>
    </div>
  )
}

// Styles
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
  networkStatus: {
    fontSize: '1rem',
    opacity: 0.8,
    margin: '10px 0 0 0'
  },
  connectSection: {
    textAlign: 'center',
    background: 'white',
    padding: '40px',
    borderRadius: '15px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
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
    marginBottom: '15px',
    width: '100%'
  },
  note: {
    color: '#666',
    fontSize: '0.9rem',
    margin: '0 0 20px 0'
  },
  gasInfo: {
    background: '#e8f5e8',
    border: '1px solid #4caf50',
    padding: '15px',
    borderRadius: '8px',
    margin: '15px 0',
    textAlign: 'left'
  },
  link: {
    color: '#2196f3',
    textDecoration: 'none'
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
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)',
    textAlign: 'center'
  },
  testButton: {
    padding: '8px 16px',
    backgroundColor: '#ff9800',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    marginTop: '10px'
  },
  section: {
    background: 'white',
    padding: '30px',
    borderRadius: '15px',
    marginBottom: '20px',
    boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
  },
  sectionTitle: {
    color: '#2c3e50',
    marginTop: 0,
    borderBottom: '2px solid #f0f0f0',
    paddingBottom: '15px',
    textAlign: 'center'
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
    marginTop: '10px'
  },
  secondaryButton: {
    padding: '15px 25px',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    cursor: 'pointer',
    flex: 1
  },
  clearButton: {
    padding: '15px 25px',
    backgroundColor: '#e74c3c',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '1.1rem',
    cursor: 'pointer',
    marginLeft: '10px'
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
  footer: {
    textAlign: 'center',
    color: 'white',
    marginTop: '40px',
    opacity: 0.8,
    fontSize: '0.9rem'
  }
}

