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
  const [networkStatus, setNetworkStatus] = useState('Đang kết nối...')
  const [rpcStatus, setRpcStatus] = useState('')

  // CONTRACT ADDRESS THẬT
  const contractAddress = "0xF561493424f457938C078a304e5B6F96765cec1d"
  
  const contractABI = [
    "function registerDocument(string _documentHash, string _documentType) public",
    "function verifyDocument(string _documentHash) public view returns (bool)",
    "function getUserDocuments(address _user) public view returns (string[] memory)",
    "function documents(string) public view returns (string documentHash, address owner, uint256 timestamp, string documentType, bool verified)",
    "event DocumentRegistered(string indexed documentHash, address indexed owner)"
  ]

  // DANH SÁCH RPC BACKUP
  const rpcEndpoints = [
    {
      url: 'https://public-node.testnet.rsk.co',
      name: 'Public Node'
    },
    {
      url: 'https://mycrypto.testnet.rsk.co', 
      name: 'MyCrypto'
    },
    {
      url: 'https://rootstock-testnet.rsk.co',
      name: 'Rootstock Backup'
    }
  ]

  useEffect(() => {
    if (typeof window.ethereum !== 'undefined') {
      checkNetworkStatus()
    }
  }, [])

  const checkNetworkStatus = async () => {
    for (let rpc of rpcEndpoints) {
      try {
        const customProvider = new ethers.JsonRpcProvider(rpc.url)
        const network = await customProvider.getNetwork()
        const block = await customProvider.getBlockNumber()
        setRpcStatus(`✅ ${rpc.name} - Block: ${block}`)
        break
      } catch (error) {
        setRpcStatus(`❌ ${rpc.name} - Đang thử RPC khác...`)
        continue
      }
    }
  }

  const initContract = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contractInstance = new ethers.Contract(contractAddress, contractABI, signer)
      setContract(contractInstance)
    } catch (error) {
      console.log('Contract chưa khởi tạo')
    }
  }

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        setNetworkStatus('🔄 Đang kết nối Rootstock Testnet...')

        let connected = false
        
        // THỬ TỪNG RPC ENDPOINT
        for (let rpc of rpcEndpoints) {
          try {
            setRpcStatus(`🔄 Đang thử: ${rpc.name}`)
            
            // THÊM NETWORK VÀO METAMASK
            await window.ethereum.request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: '0x1F',
                chainName: 'Rootstock Testnet',
                rpcUrls: [rpc.url],
                blockExplorerUrls: ['https://explorer.testnet.rsk.co'],
                nativeCurrency: {
                  name: 'tRBTC',
                  symbol: 'tRBTC',
                  decimals: 18
                },
              }],
            })

            // CHUYỂN SANG NETWORK
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x1F' }],
            })

            setRpcStatus(`✅ Đã kết nối: ${rpc.name}`)
            connected = true
            break

          } catch (error) {
            console.log(`RPC ${rpc.name} failed:`, error)
            setRpcStatus(`❌ Thất bại: ${rpc.name}`)
            continue
          }
        }

        if (!connected) {
          setNetworkStatus('❌ Tất cả RPC đều thất bại')
          alert('❌ Không thể kết nối đến Rootstock. Vui lòng thử lại sau.')
          return
        }

        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        })
        setAccount(accounts[0])
        
        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const contractInstance = new ethers.Contract(contractAddress, contractABI, signer)
        setContract(contractInstance)

        const network = await provider.getNetwork()
        const block = await provider.getBlockNumber()
        setNetworkStatus(`✅ Đã kết nối - Block: ${block}`)
        
        alert(`✅ Đã kết nối Rootstock: ${accounts[0]}`)
      } catch (error) {
        if (error.code === 4001) {
          setNetworkStatus('❌ Người dùng từ chối kết nối')
          alert('❌ Người dùng từ chối kết nối')
        } else {
          setNetworkStatus('❌ Lỗi kết nối')
          alert('❌ Lỗi kết nối: ' + error.message)
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
        const hash = await calculateFileHash(file)
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
      setNetworkStatus('🔄 Đang gửi transaction...')

      // KIỂM TRA DOCUMENT ĐÃ TỒN TẠI
      const exists = await checkDocumentExists(documentHash)
      if (exists) {
        alert('❌ Document đã được đăng ký trước đó!')
        setLoading(false)
        return
      }

      // THỬ NHIỀU LẦN NẾU CẦN
      let retries = 3
      let success = false
      let lastError = ''

      for (let i = 0; i < retries; i++) {
        try {
          const tx = await contract.registerDocument(documentHash, documentType, {
            gasLimit: 200000,
          })
          
          setNetworkStatus(`🔄 Đang xác nhận... (Thử ${i + 1}/${retries})`)
          alert(`⏳ Đang xác nhận giao dịch...\n💸 Gas fee: ~0.00002 tRBTC\n\nThử: ${i + 1}/${retries}`)
          
          const receipt = await tx.wait()
          console.log('Transaction receipt:', receipt)
          
          success = true
          break
        } catch (error) {
          lastError = error
          console.log(`Transaction attempt ${i + 1} failed:`, error)
          if (i < retries - 1) {
            await new Promise(resolve => setTimeout(resolve, 2000)) // Chờ 2 giây
          }
        }
      }

      if (success) {
        setNetworkStatus('✅ Transaction thành công')
        alert('✅ Đăng ký giấy tờ thành công!\n📄 Giấy tờ đã được lưu trên blockchain')
      } else {
        setNetworkStatus('❌ Transaction thất bại')
        throw lastError
      }

    } catch (error) {
      console.error('Lỗi đăng ký:', error)
      setNetworkStatus('❌ Lỗi transaction')
      
      if (error.reason) {
        alert('❌ Lỗi từ contract: ' + error.reason)
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        alert('❌ Không đủ tRBTC! Vào faucet nhận thêm:\nhttps://faucet.testnet.rsk.co')
      } else if (error.message.includes('RPC endpoint')) {
        alert('❌ Lỗi kết nối RPC. Vui lòng thử lại sau hoặc refresh trang.')
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
      alert('❌ Lỗi xác minh: ' + error.message)
    }
    setLoading(false)
  }

  const clearResults = () => {
    setDocumentHash('')
    setFileName('')
    setVerificationResult('')
  }

  const refreshConnection = async () => {
    setNetworkStatus('🔄 Đang làm mới kết nối...')
    await checkNetworkStatus()
    if (account) {
      await initContract()
    }
    setNetworkStatus('✅ Đã làm mới kết nối')
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🆔 HỆ THỐNG XÁC THỰC GIẤY TỜ</h1>
        <p style={styles.subtitle}>Rootstock Blockchain - Document Verification</p>
        <div style={styles.statusBar}>
          <p style={styles.networkStatus}>🌐 {networkStatus}</p>
          <p style={styles.rpcStatus}>🔗 {rpcStatus}</p>
          <button onClick={refreshConnection} style={styles.refreshButton}>
            🔄 Làm mới
          </button>
        </div>
      </header>

      {!account ? (
        <div style={styles.connectSection}>
          <button onClick={connectWallet} style={styles.connectButton}>
            🔗 Kết nối Rootstock Testnet
          </button>
          <p style={styles.note}>Kết nối ví để sử dụng hệ thống</p>
          
          <div style={styles.gasInfo}>
            <p>💡 <strong>Thông tin:</strong></p>
            <p>• Đang sử dụng <strong>Rootstock Testnet</strong></p>
            <p>• Đăng ký giấy tờ: ~0.00002 tRBTC</p>
            <p>• Xác minh: Miễn phí</p>
            <p>• Tự động thử nhiều RPC endpoints</p>
            <p>🆓 <strong>Nhận tRBTC miễn phí:</strong> <a href="https://faucet.testnet.rsk.co" target="_blank" style={styles.link}>Rootstock Faucet</a></p>
          </div>
        </div>
      ) : (
        <div style={styles.mainContent}>
          <div style={styles.accountInfo}>
            <p>👤 <strong>Địa chỉ ví:</strong> {account}</p>
            <p>🌐 <strong>Trạng thái:</strong> {networkStatus}</p>
            <p>🔗 <strong>RPC:</strong> {rpcStatus}</p>
          </div>

          {/* GAS FEE INFO */}
          <div style={styles.gasInfo}>
            <p>💰 <strong>Thông tin phí:</strong> Đăng ký giấy tờ tốn ~0.00002 tRBTC | Xác minh miễn phí</p>
            <p>🔄 <strong>Tự động retry 3 lần</strong> nếu có lỗi RPC</p>
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
              {loading ? '⏳ Đang xử lý...' : '✅ Đăng ký giấy tờ (0.00002 tRBTC)'}
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
        <p>© 2024 Hệ thống xác thực giấy tờ - Rootstock Testnet</p>
        <p>Auto-retry RPC endpoints | Multiple backup connections</p>
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
  statusBar: {
    background: 'rgba(255,255,255,0.1)',
    padding: '15px',
    borderRadius: '10px',
    marginTop: '20px'
  },
  networkStatus: {
    fontSize: '1rem',
    margin: '5px 0',
    fontWeight: 'bold'
  },
  rpcStatus: {
    fontSize: '0.9rem',
    margin: '5px 0',
    opacity: 0.9
  },
  refreshButton: {
    padding: '8px 16px',
    backgroundColor: 'rgba(255,255,255,0.2)',
    color: 'white',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    marginTop: '10px'
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