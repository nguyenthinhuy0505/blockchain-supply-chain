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
  const [userBalance, setUserBalance] = useState(0)
  const [hasSufficientBalance, setHasSufficientBalance] = useState(false)
  const [activeTab, setActiveTab] = useState('register') // 'register' or 'verify'

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
      <div style={styles.card}>
        <header style={styles.header}>
          <div style={styles.headerContent}>
            <h1 style={styles.title}>Xác thực giấy tờ điện tử</h1>
            <p style={styles.subtitle}>Hệ thống xác thực và quản lý tài liệu trên blockchain Rootstock</p>
          </div>
          
          <div style={styles.networkInfo}>
            <div style={styles.networkBadge}>
              <span style={styles.networkDot}></span>
              Rootstock Testnet
            </div>
            <div style={styles.contractInfo}>
              Contract: {CONTRACT_ADDRESS.substring(0, 6)}...{CONTRACT_ADDRESS.substring(CONTRACT_ADDRESS.length - 4)}
            </div>
          </div>
        </header>

        {!account ? (
          <div style={styles.connectSection}>
            <div style={styles.walletIcon}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M19 7H5C3.89543 7 3 7.89543 3 9V19C3 20.1046 3.89543 21 5 21H19C20.1046 21 21 20.1046 21 19V9C21 7.89543 20.1046 7 19 7Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 7V5C16 3.89543 15.1046 3 14 3H8C6.89543 3 6 3.89543 6 5V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 12H16.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 style={styles.connectTitle}>Kết nối ví MetaMask</h2>
            <p style={styles.connectDescription}>Kết nối ví của bạn để bắt đầu sử dụng dịch vụ xác thực tài liệu</p>
            <button onClick={connectWallet} style={styles.connectButton}>
              Kết nối MetaMask
            </button>
            <div style={styles.statusContainer}>
              <p style={styles.status}>{status}</p>
            </div>
          </div>
        ) : (
          <div style={styles.mainContent}>
            {/* Thông tin tài khoản */}
            <div style={styles.accountSection}>
              <div style={styles.accountInfo}>
                <div style={styles.avatar}>
                  {account.substring(2, 4).toUpperCase()}
                </div>
                <div style={styles.accountDetails}>
                  <h3 style={styles.accountAddress}>
                    {account.substring(0, 6)}...{account.substring(account.length - 4)}
                  </h3>
                  <div style={styles.balanceInfo}>
                    <span style={styles.balanceAmount}>{userBalance.toFixed(6)} tRBTC</span>
                    <span style={hasSufficientBalance ? styles.balanceStatusGood : styles.balanceStatusLow}>
                      {hasSufficientBalance ? '✓ Đủ số dư' : 'Số dư thấp'}
                    </span>
                  </div>
                </div>
              </div>
              
              <div style={styles.balanceActions}>
                <button onClick={getTestRBTC} style={styles.faucetButton}>
                  Nhận Test Token
                </button>
              </div>
            </div>

            {/* Thống kê số dư */}
            {userBalance > 0 && (
              <div style={styles.balanceStats}>
                <div style={styles.statItem}>
                  <div style={styles.statValue}>{canRegister}</div>
                  <div style={styles.statLabel}>Có thể đăng ký</div>
                </div>
                <div style={styles.statItem}>
                  <div style={styles.statValue}>{canVerify}</div>
                  <div style={styles.statLabel}>Có thể xác minh</div>
                </div>
              </div>
            )}

            {/* Navigation Tabs */}
            <div style={styles.tabContainer}>
              <button 
                style={activeTab === 'register' ? styles.activeTab : styles.tab}
                onClick={() => setActiveTab('register')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={styles.tabIcon}>
                  <path d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M14 2V8H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 13H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16 17H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 9H9H8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Đăng ký tài liệu
              </button>
              <button 
                style={activeTab === 'verify' ? styles.activeTab : styles.tab}
                onClick={() => setActiveTab('verify')}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={styles.tabIcon}>
                  <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M21 12C21 13.1819 20.7672 14.3522 20.3149 15.4442C19.8626 16.5361 19.1997 17.5282 18.364 18.364C17.5282 19.1997 16.5361 19.8626 15.4442 20.3149C14.3522 20.7672 13.1819 21 12 21C10.8181 21 9.64778 20.7672 8.55585 20.3149C7.46392 19.8626 6.47177 19.1997 5.63604 18.364C4.80031 17.5282 4.13738 16.5361 3.68508 15.4442C3.23279 14.3522 3 13.1819 3 12C3 9.61305 3.94821 7.32387 5.63604 5.63604C7.32387 3.94821 9.61305 3 12 3C14.3869 3 16.6761 3.94821 18.364 5.63604C20.0518 7.32387 21 9.61305 21 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Xác minh tài liệu
              </button>
            </div>

            {/* Form đăng ký tài liệu */}
            {activeTab === 'register' && (
              <div style={styles.formSection}>
                <h3 style={styles.formTitle}>Đăng ký tài liệu mới</h3>
                
                <div style={styles.formGroup}>
                  <label style={styles.label}>Loại tài liệu</label>
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
                  <label style={styles.label}>Tải lên tài liệu</label>
                  <div style={styles.fileUploadArea}>
                    <input 
                      type="file" 
                      onChange={handleFileUpload}
                      style={styles.fileInput}
                      id="file-upload"
                      disabled={loading}
                    />
                    <label htmlFor="file-upload" style={styles.fileUploadLabel}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={styles.uploadIcon}>
                        <path d="M21 15V19C21 19.5304 20.7893 20.0391 20.4142 20.4142C20.0391 20.7893 19.5304 21 19 21H5C4.46957 21 3.96086 20.7893 3.58579 20.4142C3.21071 20.0391 3 19.5304 3 19V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M17 8L12 3L7 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M12 3V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span>Chọn tệp để tải lên</span>
                      <p style={styles.fileUploadHint}>Hỗ trợ: PDF, DOC, DOCX, JPG, PNG (Tối đa 10MB)</p>
                    </label>
                  </div>
                  {fileName && (
                    <div style={styles.fileNameDisplay}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V9L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        <path d="M13 2V9H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      {fileName}
                    </div>
                  )}
                </div>

                {documentHash && (
                  <div style={styles.hashSection}>
                    <label style={styles.label}>Mã hash của tài liệu</label>
                    <div style={styles.hashDisplay}>
                      {documentHash}
                    </div>
                  </div>
                )}

                <button 
                  onClick={registerDocument}
                  disabled={loading || !documentHash || userBalance < MINIMUM_BALANCE}
                  style={{
                    ...styles.primaryButton,
                    ...((loading || !documentHash || userBalance < MINIMUM_BALANCE) && styles.disabledButton)
                  }}
                >
                  {loading ? (
                    <>
                      <div style={styles.spinner}></div>
                      Đang xử lý...
                    </>
                  ) : (
                    'Đăng ký tài liệu'
                  )}
                </button>

                {userBalance < MINIMUM_BALANCE && (
                  <div style={styles.warningBox}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 9V11M12 15H12.01M5.07183 19H18.9282C20.4678 19 21.4301 17.3333 20.6603 16L13.7321 4C12.9623 2.66667 11.0377 2.66667 10.2679 4L3.33975 16C2.56995 17.3333 3.53223 19 5.07183 19Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <div>
                      <strong>Cần ít nhất {MINIMUM_BALANCE} tRBTC</strong>
                      <p>Số dư hiện tại: {userBalance.toFixed(6)} tRBTC</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Form xác minh tài liệu */}
            {activeTab === 'verify' && (
              <div style={styles.formSection}>
                <h3 style={styles.formTitle}>Xác minh tài liệu</h3>
                
                <div style={styles.formGroup}>
                  <label style={styles.label}>Mã hash tài liệu</label>
                  <input 
                    type="text"
                    value={documentHash}
                    onChange={(e) => setDocumentHash(e.target.value)}
                    style={styles.input}
                    placeholder="Dán mã hash của tài liệu cần xác minh..."
                  />
                </div>

                <button 
                  onClick={verifyDocument}
                  disabled={loading || !documentHash}
                  style={{
                    ...styles.secondaryButton,
                    ...((loading || !documentHash) && styles.disabledButton)
                  }}
                >
                  {loading ? (
                    <>
                      <div style={styles.spinner}></div>
                      Đang xác minh...
                    </>
                  ) : (
                    'Xác minh tài liệu'
                  )}
                </button>

                {verificationResult && (
                  <div style={{
                    ...styles.resultBox,
                    ...(verificationResult.includes('HỢP LỆ') ? styles.validResult : styles.invalidResult)
                  }}>
                    <div style={styles.resultHeader}>
                      {verificationResult.includes('HỢP LỆ') ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M22 11.08V12C21.9988 14.1564 21.3005 16.2547 20.0093 17.9818C18.7182 19.709 16.9033 20.9725 14.8354 21.5839C12.7674 22.1953 10.5573 22.1219 8.53447 21.3746C6.51168 20.6273 4.78465 19.2461 3.61096 17.4371C2.43727 15.628 1.87979 13.4881 2.02168 11.3363C2.16356 9.18455 2.99721 7.13631 4.39828 5.49706C5.79935 3.85781 7.69279 2.71537 9.79619 2.24013C11.8996 1.7649 14.1003 1.98232 16.07 2.85999" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          <path d="M22 4L12 14.01L9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M12 8V12M12 16H12.01M22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                      <h4>{verificationResult}</h4>
                    </div>
                    <p style={styles.resultDescription}>
                      {verificationResult.includes('HỢP LỆ') 
                        ? 'Tài liệu này đã được đăng ký trên blockchain và có giá trị pháp lý.' 
                        : 'Tài liệu này không tồn tại trong hệ thống hoặc không hợp lệ.'}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Trạng thái hệ thống */}
            <div style={styles.statusSection}>
              <div style={styles.statusIndicator}>
                <div style={styles.statusDot}></div>
                {status}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Styles mới - thiết kế hiện đại
const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
    padding: '20px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  card: {
    width: '100%',
    maxWidth: '800px',
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.08)',
    overflow: 'hidden'
  },
  header: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    padding: '30px'
  },
  headerContent: {
    marginBottom: '15px'
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    margin: '0 0 8px 0'
  },
  subtitle: {
    fontSize: '16px',
    opacity: '0.9',
    margin: '0'
  },
  networkInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    flexWrap: 'wrap'
  },
  networkBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'rgba(255, 255, 255, 0.2)',
    padding: '6px 12px',
    borderRadius: '20px',
    fontSize: '14px'
  },
  networkDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#4ade80'
  },
  contractInfo: {
    fontSize: '14px',
    opacity: '0.8'
  },
  connectSection: {
    padding: '60px 40px',
    textAlign: 'center'
  },
  walletIcon: {
    color: '#667eea',
    marginBottom: '20px'
  },
  connectTitle: {
    fontSize: '24px',
    fontWeight: '600',
    margin: '0 0 10px 0',
    color: '#2d3748'
  },
  connectDescription: {
    fontSize: '16px',
    color: '#718096',
    margin: '0 0 30px 0',
    lineHeight: '1.5'
  },
  connectButton: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    padding: '14px 28px',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
  },
  statusContainer: {
    marginTop: '20px'
  },
  status: {
    background: 'rgba(102, 126, 234, 0.1)',
    color: '#667eea',
    padding: '10px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    display: 'inline-block'
  },
  mainContent: {
    padding: '30px'
  },
  accountSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '25px',
    paddingBottom: '25px',
    borderBottom: '1px solid #e2e8f0'
  },
  accountInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px'
  },
  avatar: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: '600',
    fontSize: '16px'
  },
  accountDetails: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px'
  },
  accountAddress: {
    margin: '0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#2d3748'
  },
  balanceInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  balanceAmount: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#2d3748'
  },
  balanceStatusGood: {
    background: '#c6f6d5',
    color: '#22543d',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500'
  },
  balanceStatusLow: {
    background: '#fed7d7',
    color: '#742a2a',
    padding: '2px 8px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '500'
  },
  balanceActions: {
    display: 'flex',
    gap: '10px'
  },
  faucetButton: {
    background: '#edf2f7',
    color: '#4a5568',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  balanceStats: {
    display: 'flex',
    gap: '20px',
    marginBottom: '25px'
  },
  statItem: {
    flex: '1',
    background: '#f7fafc',
    padding: '15px',
    borderRadius: '10px',
    textAlign: 'center'
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#667eea',
    marginBottom: '5px'
  },
  statLabel: {
    fontSize: '14px',
    color: '#718096'
  },
  tabContainer: {
    display: 'flex',
    background: '#f7fafc',
    borderRadius: '10px',
    padding: '5px',
    marginBottom: '25px'
  },
  tab: {
    flex: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 16px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#718096',
    cursor: 'pointer',
    transition: 'all 0.2s ease'
  },
  activeTab: {
    flex: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '12px 16px',
    background: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    color: '#667eea',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
    transition: 'all 0.2s ease'
  },
  tabIcon: {
    // Icon styles are defined inline
  },
  formSection: {
    marginBottom: '25px'
  },
  formTitle: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#2d3748',
    margin: '0 0 20px 0'
  },
  formGroup: {
    marginBottom: '20px'
  },
  label: {
    display: 'block',
    fontSize: '14px',
    fontWeight: '500',
    color: '#4a5568',
    marginBottom: '8px'
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '16px',
    backgroundColor: 'white',
    transition: 'all 0.2s ease',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,<svg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%204%205'><path%20fill='%23666'%20d='M2%200L0%202h4zm0%205L0%203h4z'/></svg>")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    backgroundSize: '10px'
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '16px',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box'
  },
  fileUploadArea: {
    position: 'relative'
  },
  fileInput: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: '0',
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0, 0, 0, 0)',
    border: '0'
  },
  fileUploadLabel: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
    border: '2px dashed #e2e8f0',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center',
    color: '#718096'
  },
  uploadIcon: {
    marginBottom: '12px',
    color: '#a0aec0'
  },
  fileUploadHint: {
    fontSize: '14px',
    margin: '8px 0 0 0',
    color: '#a0aec0'
  },
  fileNameDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '10px 12px',
    background: '#f7fafc',
    borderRadius: '6px',
    marginTop: '10px',
    fontSize: '14px',
    color: '#4a5568'
  },
  hashSection: {
    marginBottom: '20px'
  },
  hashDisplay: {
    padding: '12px 16px',
    background: '#f7fafc',
    borderRadius: '8px',
    fontSize: '14px',
    fontFamily: 'monospace',
    wordBreak: 'break-all',
    color: '#4a5568'
  },
  primaryButton: {
    width: '100%',
    padding: '14px 20px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
  },
  secondaryButton: {
    width: '100%',
    padding: '14px 20px',
    background: '#edf2f7',
    color: '#4a5568',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px'
  },
  disabledButton: {
    opacity: '0.6',
    cursor: 'not-allowed'
  },
  spinner: {
    width: '18px',
    height: '18px',
    border: '2px solid transparent',
    borderTop: '2px solid currentColor',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  warningBox: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
    padding: '16px',
    background: '#fff5f5',
    border: '1px solid #fed7d7',
    borderRadius: '8px',
    marginTop: '20px',
    color: '#c53030'
  },
  resultBox: {
    padding: '20px',
    borderRadius: '8px',
    marginTop: '20px'
  },
  validResult: {
    background: '#f0fff4',
    border: '1px solid #9ae6b4',
    color: '#22543d'
  },
  invalidResult: {
    background: '#fff5f5',
    border: '1px solid #fc8181',
    color: '#c53030'
  },
  resultHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '8px'
  },
  resultDescription: {
    margin: '0',
    fontSize: '14px',
    opacity: '0.9'
  },
  statusSection: {
    paddingTop: '20px',
    borderTop: '1px solid #e2e8f0'
  },
  statusIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
    color: '#718096'
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#48bb78',
    animation: 'pulse 2s infinite'
  }
}