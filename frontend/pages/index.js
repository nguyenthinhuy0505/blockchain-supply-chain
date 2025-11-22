import { useState, useEffect } from 'react'

export default function DocumentVerification() {
  const [account, setAccount] = useState('')
  const [hasMetaMask, setHasMetaMask] = useState(false)

  useEffect(() => {
    // Kiểm tra MetaMask khi component mount
    if (typeof window.ethereum !== 'undefined') {
      setHasMetaMask(true)
    }
  }, [])

  const connectWallet = async () => {
    if (hasMetaMask) {
      try {
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        })
        setAccount(accounts[0])
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

  return (
    <div style={{ 
      padding: '50px', 
      textAlign: 'center',
      fontFamily: 'Arial',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white'
    }}>
      <h1>🆔 XÁC THỰC GIẤY TỜ BLOCKCHAIN</h1>
      
      {!account ? (
        <div>
          {hasMetaMask ? (
            <button 
              onClick={connectWallet}
              style={{
                padding: '15px 30px',
                fontSize: '18px',
                backgroundColor: '#f6851b',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                margin: '20px'
              }}
            >
              🔗 Kết nối MetaMask
            </button>
          ) : (
            <div>
              <p>⚠️ MetaMask không được tìm thấy</p>
              <a 
                href="https://metamask.io/download.html"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#f6851b',
                  textDecoration: 'underline'
                }}
              >
                Tải MetaMask tại đây
              </a>
            </div>
          )}
        </div>
      ) : (
        <div style={{
          background: 'white',
          color: 'black',
          padding: '20px',
          borderRadius: '10px',
          margin: '20px auto',
          maxWidth: '500px'
        }}>
          <p>✅ <strong>Đã kết nối:</strong> {account}</p>
          <p>🚀 Sẵn sàng xác thực giấy tờ!</p>
        </div>
      )}
    </div>
  )
}