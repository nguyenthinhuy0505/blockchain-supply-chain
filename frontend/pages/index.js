import { useState } from 'react';

export default function Home() {
  const [message, setMessage] = useState('Frontend đang chạy!');

  return (
    <div style={{ 
      padding: '50px', 
      textAlign: 'center',
      fontFamily: 'Arial, sans-serif' 
    }}>
      <h1>🆔 XÁC THỰC GIẤY TỜ</h1>
      <p>{message}</p>
      <button 
        onClick={() => setMessage('Kết nối MetaMask...')}
        style={{
          padding: '10px 20px',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: 'pointer'
        }}
      >
        Kết nối Ví
      </button>
    </div>
  );
}