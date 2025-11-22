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

  // GIỮ NGUYÊN CONTRACT ROOTSTOCK
  const contractAddress = "0xF561493424f457938C078a304e5B6F96765cec1d"
  
  const contractABI = [
    "function registerDocument(string _documentHash, string _documentType) public",
    "function verifyDocument(string _documentHash) public view returns (bool)",
    "function getUserDocuments(address _user) public view returns (string[] memory)",
    "event DocumentRegistered(string indexed documentHash, address indexed owner)"
  ]

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        setStatus('🔄 Đang kết nối Rootstock...')

        // ĐƠN GIẢN - CHỈ KẾT NỐI VÍ, KHÔNG THÊM NETWORK
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        })
        setAccount(accounts[0])
        
        // DÙNG PROVIDER TRỰC TIẾP
        const provider = new ethers.BrowserProvider(window.ethereum)
        const signer = await provider.getSigner()
        const contractInstance = new ethers.Contract(contractAddress, contractABI, signer)
        setContract(contractInstance)
        
        setStatus('✅ Đã kết nối ví')
        alert(`✅ Đã kết nối: ${accounts[0]}\n\n🔧 Vui lòng đảm bảo MetaMask đang ở Rootstock Testnet`)

      } catch (error) {
        if (error.code === 4001) {
          setStatus('❌ Từ chối kết nối')
          alert('❌ Bạn đã từ chối kết nối ví')
        } else {
          setStatus('❌ Lỗi kết nối')
          alert('❌ Lỗi: ' + error.message + '\n\n💡 Mẹo: Kiểm tra xem MetaMask có ở Rootstock Testnet không?')
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
        alert(`📄 Đã tạo hash: ${file.name}\n\n🔐 ${hash}`)
      } catch (error) {
        alert('❌ Lỗi file: ' + error.message)
      }
      setLoading(false)
    }
  }

  const registerDocument = async () => {
    if (!contract) {
      alert('⚠️ Kết nối ví trước')
      return
    }
    
    if (!documentHash) {
      alert('⚠️ Upload file trước')
      return
    }

    try {
      setLoading(true)
      setStatus('🔄 Đang gửi transaction...')

      const tx = await contract.registerDocument(documentHash, documentType, {
        gasLimit: 200000,
      })
      
      alert('⏳ Đang xác nhận...\n💸 Phí: ~0.00002 tRBTC')
      
      await tx.wait()
      setStatus('✅ Đăng ký thành công')
      alert('✅ Thành công! Giấy tờ đã lưu trên blockchain')

    } catch (error) {
      console.error('Lỗi:', error)
      setStatus('❌ Lỗi transaction')
      
      if (error.reason) {
        alert('❌ Lỗi contract: ' + error.reason)
      } else if (error.code === 'INSUFFICIENT_FUNDS') {
        alert('❌ Hết tRBTC! Vào faucet:\nhttps://faucet.testnet.rsk.co')
      } else if (error.message.includes('RPC')) {
        alert('❌ Lỗi kết nối RPC\n\n💡 Thử:\n1. Refresh trang\n2. Đổi RPC trong MetaMask\n3. Thử lại sau')
      } else {
        alert('❌ Lỗi: ' + error.message)
      }
    }
    setLoading(false)
  }

  const verifyDocument = async () => {
    if (!documentHash) {
      alert('⚠️ Nhập hash trước')
      return
    }

    try {
      setLoading(true)
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contractInstance = new ethers.Contract(contractAddress, contractABI, provider)
      
      const isVerified = await contractInstance.verifyDocument(documentHash)
      setVerificationResult(isVerified ? '✅ GIẤY TỜ HỢP LỆ' : '❌ GIẤY TỜ KHÔNG HỢP LỆ')
    } catch (error) {
      alert('❌ Lỗi xác minh: ' + error.message)
    }
    setLoading(false)
  }

  const clearResults = () => {
    setDocumentHash('')
    setFileName('')
    setVerificationResult('')
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🆔 XÁC THỰC GIẤY TỜ</h1>
        <p style={styles.subtitle}>Rootstock Blockchain</p>
        <p style={styles.status}>{status}</p>
      </header>

      {!account ? (
        <div style={styles.connectSection}>
          <button onClick={connectWallet} style={styles.connectButton}>
            🔗 Kết nối Rootstock
          </button>
          <p style={styles.note}>Đảm bảo MetaMask đang ở Rootstock Testnet</p>
          
          <div style={styles.info}>
            <p>💡 <strong>Cài đặt Rootstock trong MetaMask:</strong></p>
            <p>Network Name: <strong>Rootstock Testnet</strong></p>
            <p>RPC URL: <strong>https://public-node.testnet.rsk.co</strong></p>
            <p>Chain ID: <strong>31</strong></p>
            <p>Symbol: <strong>tRBTC</strong></p>
            <p>Block Explorer: <strong>https://explorer.testnet.rsk.co</strong></p>
          </div>

          <div style={styles.gasInfo}>
            <p>📦 Đăng ký: ~0.00002 tRBTC</p>
            <p>🔍 Xác minh: Miễn phí</p>
            <p>🆓 <a href="https://faucet.testnet.rsk.co" target="_blank" style={styles.link}>Nhận tRBTC miễn phí</a></p>
          </div>
        </div>
      ) : (
        <div style={styles.mainContent}>
          <div style={styles.accountInfo}>
            <p>👤 Ví: {account}</p>
            <p>🌐 Rootstock Testnet</p>
            <p>📊 {status}</p>
          </div>

          <div style={styles.gasInfo}>
            <p>💰 Phí: ~0.00002 tRBTC | Xác minh miễn phí</p>
            <p>🆓 <a href="https://faucet.testnet.rsk.co" target="_blank" style={styles.link}>Nhận tRBTC tại đây</a></p>
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
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                disabled={loading}
              />
              {fileName && <p style={styles.fileName}>📄 {fileName}</p>}
            </div>

            {documentHash && (
              <div style={styles.hashDisplay}>
                <p><strong>🔐 Hash:</strong></p>
                <p style={styles.hashText}>{documentHash}</p>
                <p style={styles.noteText}><small>Lưu hash để xác minh sau</small></p>
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
              {loading ? '⏳ Đang xử lý...' : '✅ Đăng ký (0.00002 tRBTC)'}
            </button>
          </div>

          <div style={styles.section}>
            <h2>🔍 XÁC MINH GIẤY TỜ</h2>
            
            <div style={styles.formGroup}>
              <label>Hash giấy tờ:</label>
              <input 
                type="text"
                placeholder="Dán hash tại đây..."
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
              
              <button onClick={clearResults} style={styles.clearButton}>
                🗑️ Xóa
              </button>
            </div>

            {verificationResult && (
              <div style={{
                ...styles.result,
                ...(verificationResult.includes('HỢP LỆ') ? styles.validResult : styles.invalidResult)
              }}>
                <h3>KẾT QUẢ</h3>
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
  status: {
    fontSize: '1rem',
    margin: '10px 0 0 0',
    fontWeight: 'bold'
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