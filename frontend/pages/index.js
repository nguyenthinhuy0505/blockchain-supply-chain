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
  const [balance, setBalance] = useState('0')
  const [gasPrice, setGasPrice] = useState('1.2')

  const contractAddress = "0xF561493424f457938C078a304e5B6F96765cec1d"
  
  const contractABI = [
    "function registerDocument(string _documentHash, string _documentType) external",
    "function verifyDocument(string _documentHash) external view returns (bool)",
    "event DocumentRegistered(string indexed documentHash, address indexed owner, uint256 timestamp)"
  ]

  // Cập nhật số dư khi tài khoản thay đổi
  useEffect(() => {
    if (account && typeof window.ethereum !== 'undefined') {
      checkBalance(account)
    }
  }, [account])

  // Kiểm tra số dư
  const checkBalance = async (address) => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const balance = await provider.getBalance(address)
      const balanceInRBTC = ethers.formatUnits(balance, 18)
      setBalance(parseFloat(balanceInRBTC).toFixed(6))
      return parseFloat(balanceInRBTC)
    } catch (error) {
      console.error('Lỗi kiểm tra số dư:', error)
      return 0
    }
  }

  // Kết nối và chuyển mạng
  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        setStatus('🔄 Đang kết nối...')

        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        })
        setAccount(accounts[0])
        
        const provider = new ethers.BrowserProvider(window.ethereum)
        let network = await provider.getNetwork()
        
        // Kiểm tra chainId (31)
        if (network.chainId !== BigInt(31)) {
          setStatus('🔄 Đang chuyển sang Rootstock Testnet...')
          try {
            await window.ethereum.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: '0x1F' }]
            })
            // Đợi một chút để network chuyển đổi
            await new Promise(resolve => setTimeout(resolve, 2000))
            network = await provider.getNetwork()
          } catch(switchError) {
            // Nếu lỗi 4902 (Chưa thêm network), thêm nó vào
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
            } else {
              throw switchError
            }
          }
        }

        const currentBalance = await checkBalance(accounts[0])
        
        const signer = await provider.getSigner()
        const contractInstance = new ethers.Contract(contractAddress, contractABI, signer)
        setContract(contractInstance)
        
        setStatus(`✅ Đã kết nối | Số dư: ${currentBalance.toFixed(6)} tRBTC`)

      } catch (error) {
        console.error('Connection error:', error)
        setStatus('❌ Lỗi kết nối')
      }
    } else {
      alert('⚠️ Vui lòng cài đặt MetaMask!')
    }
  }

  // Tính Hash SHA-256 của file
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
      } catch (error) {
        alert('❌ Lỗi file: ' + error.message)
      }
      setLoading(false)
    }
  }

  // Đăng ký Document lên Blockchain
  const registerDocument = async () => {
    if (!contract) {
      alert('⚠️ Vui lòng kết nối ví trước')
      return
    }
    
    if (!documentHash) {
      alert('⚠️ Vui lòng upload file trước')
      return
    }

    const currentBalance = await checkBalance(account)
    const minBalance = 0.00015
    
    if (currentBalance < minBalance) {
      alert(`❌ SỐ DƯ THẤP!\n\nSố dư hiện tại: ${currentBalance} tRBTC\nCần ít nhất: ${minBalance} tRBTC`)
      return
    }

    try {
      setLoading(true)
      setStatus('🔄 Đang gửi transaction...')

      const balanceBefore = currentBalance
      
      const gasPriceWei = ethers.parseUnits(gasPrice, 'gwei')
      const gasLimit = 100000
      
      const tx = await contract.registerDocument(documentHash, documentType, {
        gasLimit: gasLimit,
        gasPrice: gasPriceWei
      })
      
      // Tính phí ước tính
      const estimatedCost = BigInt(gasLimit) * gasPriceWei
      const estimatedCostInRBTC = ethers.formatUnits(estimatedCost, 18)
      
      alert(`⏳ Đang xác nhận...\n💰 Số dư: ${balanceBefore} tRBTC\n💸 Phí ước tính: ${estimatedCostInRBTC} tRBTC\n⚡ Gas: ${gasPrice} gwei`)
      
      const receipt = await tx.wait()
      
      // Tính phí thực tế
      const actualCost = receipt.gasUsed * receipt.gasPrice
      const actualCostInRBTC = ethers.formatUnits(actualCost, 18)
      
      const balanceAfter = await checkBalance(account)
      
      setStatus('✅ Đăng ký thành công!')
      alert(`🎉 THÀNH CÔNG!\n\n💸 Phí thực tế: ${actualCostInRBTC} tRBTC\n💰 Số dư trước: ${balanceBefore} tRBTC\n💰 Số dư sau: ${balanceAfter} tRBTC\n📉 Giảm: ${(balanceBefore - balanceAfter).toFixed(6)} tRBTC\n\n🔍 Xem: https://explorer.testnet.rootstock.io/tx/${receipt.hash}`)

    } catch (error) {
      console.error('Lỗi transaction:', error)
      setStatus('❌ Lỗi transaction')
      
      if (error.code === 'INSUFFICIENT_FUNDS') {
        const currentBalance = await checkBalance(account)
        alert(`❌ KHÔNG ĐỦ tRBTC!\n\nSố dư hiện tại: ${currentBalance} tRBTC\nCần thêm: ${(0.00015 - currentBalance).toFixed(6)} tRBTC\n\n🆓 Vui lòng nhận thêm test token!`)
      } else if (error.code === 'ACTION_REJECTED') {
        alert('❌ Bạn đã từ chối transaction')
      } else if (error.message.includes('gas')) {
        // Tăng gas price ít hơn nếu lỗi
        const suggestedGas = (parseFloat(gasPrice) * 1.5).toFixed(1)
        alert(`❌ Lỗi gas! Tự động tăng gas price lên ${suggestedGas} gwei.`)
        setGasPrice(suggestedGas)
      } else if (error.message.includes('execution reverted')) {
        alert('❌ Document đã được đăng ký trước đó!')
      } else {
        alert('❌ Lỗi: ' + error.message)
      }
    }
    setLoading(false)
  }

  // Xác minh Document (Miễn phí)
  const verifyDocument = async () => {
    if (!documentHash) {
      alert('⚠️ Vui lòng nhập hash document')
      return
    }

    try {
      setLoading(true)
      setStatus('🔍 Đang xác minh...')
      
      const provider = new ethers.BrowserProvider(window.ethereum)
      const contractInstance = new ethers.Contract(contractAddress, contractABI, provider)
      
      const isVerified = await contractInstance.verifyDocument(documentHash)
      setVerificationResult(isVerified ? '✅ GIẤY TỜ HỢP LỆ' : '❌ GIẤY TỜ KHÔNG HỢP LỆ')
      setStatus('✅ Xác minh hoàn tất')
      
    } catch (error) {
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

  const viewOnExplorer = () => {
    window.open(`https://explorer.testnet.rootstock.io/address/${contractAddress}`, '_blank')
  }

  // Gas price options
  const gasPriceOptions = [
    { value: '0.5', label: '0.5 gwei (Rẻ nhất)' },
    { value: '0.8', label: '0.8 gwei (Tiết kiệm)' },
    { value: '1.2', label: '1.2 gwei (Ổn định - Khuyến nghị)' },
    { value: '2', label: '2 gwei (Trung bình)' },
    { value: '3', label: '3 gwei (Cao)' }
  ]

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>🆔 XÁC THỰC GIẤY TỜ</h1>
        <p style={styles.subtitle}>Rootstock Testnet | Phí phù hợp: ~0.0001 tRBTC</p>
        <p style={styles.status}>{status}</p>
        
        <div style={styles.contractInfo}>
          <p>📝 <strong>Contract:</strong> {contractAddress.substring(0, 10)}...{contractAddress.substring(contractAddress.length - 8)}</p>
          <button onClick={viewOnExplorer} style={styles.explorerButton}>
            🔍 Explorer
          </button>
        </div>
      </header>

      {!account ? (
        <div style={styles.connectSection}>
          <button onClick={connectWallet} style={styles.connectButton}>
            🔗 Kết nối Ví
          </button>
          
          <div style={styles.info}>
            <p>💡 <strong>Thông tin Phí:</strong></p>
            <p>• Đăng ký: <strong>~0.00012 tRBTC</strong> (với 1.2 gwei)</p>
            <p>• Xác minh: <strong>MIỄN PHÍ</strong></p>
          </div>

          <div style={styles.gasInfo}>
            <p>🆓 <strong>NHẬN THÊM TEST TOKEN:</strong></p>
            <button onClick={getTestRBTC} style={styles.faucetButton}>
              🚰 Nhận thêm tRBTC tại Rootstock Faucet
            </button>
          </div>
        </div>
      ) : (
        <div style={styles.mainContent}>
          <div style={styles.accountInfo}>
            <p>👤 Ví: {account.substring(0, 6)}...{account.substring(account.length - 4)}</p>
            <p>💰 Số dư: <strong>{balance} tRBTC</strong></p>
            <p>🌐 Network: Rootstock Testnet</p>
            <p>📊 {status}</p>
            
            {parseFloat(balance) < 0.001 && (
              <div style={styles.warning}>
                <p>⚠️ Số dư: {balance} tRBTC - Đủ cho ~{Math.floor(parseFloat(balance) / 0.00015)} lần đăng ký</p>
                <button onClick={getTestRBTC} style={styles.smallButton}>
                  🚰 Nhận thêm tRBTC
                </button>
              </div>
            )}
          </div>

          <div style={styles.gasSettings}>
            <label style={styles.label}>⚡ Gas Price:</label>
            <select 
              value={gasPrice}
              onChange={(e) => setGasPrice(e.target.value)}
              style={styles.select}
            >
              {gasPriceOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p style={styles.noteText}>💡 Chọn 1.2 gwei để ổn định với số dư {balance} tRBTC</p>
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
                <p><strong>🔐 Hash:</strong></p>
                <p style={styles.hashText}>{documentHash}</p>
              </div>
            )}

            <button 
              onClick={registerDocument}
              disabled={loading || !documentHash || parseFloat(balance) < 0.00015}
              style={{
                ...styles.primaryButton,
                ...((loading || !documentHash || parseFloat(balance) < 0.00015) && styles.disabledButton)
              }}
            >
              {loading ? '⏳ Đang xử lý...' : `✅ Đăng ký Document (Phí ~0.0001 tRBTC)`}
            </button>

            {parseFloat(balance) < 0.00015 && (
              <p style={styles.errorText}>❌ Cần ít nhất 0.00015 tRBTC</p>
            )}
          </div>

          <div style={styles.section}>
            <h2>🔍 XÁC MINH GIẤY TỜ (MIỄN PHÍ)</h2>
            
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
              </div>
            )}
          </div>
        </div>
      )}

      <footer style={styles.footer}>
        <p>© 2024 Hệ thống xác thực giấy tờ - Rootstock Testnet</p>
        <p>💰 Phí phù hợp: ~0.0001 tRBTC | 🆓 Xác minh: Miễn phí | Số dư: {balance} tRBTC</p>
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
  status: {
    fontSize: '1rem',
    margin: '10px 0 0 0',
    fontWeight: 'bold',
    background: 'rgba(255,255,255,0.2)',
    display: 'inline-block',
    padding: '5px 15px',
    borderRadius: '20px'
  },
  contractInfo: {
    background: 'rgba(255,255,255,0.1)',
    padding: '10px',
    borderRadius: '10px',
    marginTop: '15px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '15px'
  },
  explorerButton: {
    padding: '8px 16px',
    backgroundColor: '#3498db',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '0.9rem'
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
  info: {
    background: '#e3f2fd',
    border: '1px solid #2196f3',
    padding: '15px',
    borderRadius: '8px',
    margin: '15px 0',
    textAlign: 'left'
  },
  gasInfo: {
    background: '#e8f5e8',
    border: '1px solid #4caf50',
    padding: '15px',
    borderRadius: '8px',
    margin: '15px 0',
    textAlign: 'left'
  },
  faucetButton: {
    padding: '12px 20px',
    backgroundColor: '#27ae60',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    width: '100%',
    fontWeight: 'bold'
  },
  gasSettings: {
    background: '#fff3cd',
    border: '1px solid #ffeaa7',
    padding: '15px',
    borderRadius: '8px',
    margin: '15px 0',
    textAlign: 'left'
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
  warning: {
    background: '#ffebee',
    border: '1px solid #f44336',
    padding: '10px',
    borderRadius: '8px',
    margin: '10px 0'
  },
  smallButton: {
    padding: '8px 16px',
    backgroundColor: '#f6851b',
    color: 'white',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '0.9rem',
    marginTop: '5px'
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
  errorText: {
    color: '#e74c3c',
    textAlign: 'center',
    margin: '10px 0 0 0',
    fontWeight: 'bold'
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
  footer: {
    textAlign: 'center',
    color: 'white',
    marginTop: '40px',
    opacity: 0.8,
    fontSize: '0.9rem'
  }
}