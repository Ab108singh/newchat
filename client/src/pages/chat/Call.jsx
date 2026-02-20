
import React from 'react';

const CallPopup = ({ callerName, callerAvatar, onAccept, onDecline }) => {
  const styles = {
    overlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    },
    card: {
      backgroundColor: '#1f1f1f',
      padding: '48px 32px',
      borderRadius: '28px',
      textAlign: 'center',
      color: 'white',
      width: '340px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
      border: '1px solid #333'
    },
    avatar: {
      width: '110px',
      height: '110px',
      borderRadius: '50%',
      objectFit: 'cover',
      border: '4px solid #3498db',
      marginBottom: '20px',
      boxShadow: '0 4px 12px rgba(52, 152, 219, 0.3)'
    },
    name: {
      margin: '0 0 8px 0',
      fontSize: '26px',
      fontWeight: '600'
    },
    subtext: {
      margin: '0 0 40px 0',
      color: '#a0a0a0',
      fontSize: '16px',
      letterSpacing: '0.5px'
    },
    buttonGroup: {
      display: 'flex',
      justifyContent: 'space-around',
      width: '100%'
    },
    btn: {
      border: 'none',
      borderRadius: '50%',
      width: '64px',
      height: '64px',
      cursor: 'pointer',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      transition: 'all 0.2s ease',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <img 
          src={callerAvatar || 'https://via.placeholder.com/110'} 
          alt={callerName} 
          style={styles.avatar}
        />
        <h2 style={styles.name}>{callerName || "Unknown User"}</h2>
        <p style={styles.subtext}>Incoming Video Call...</p>
        
        <div style={styles.buttonGroup}>
          <button 
            onClick={onDecline}
            style={{ ...styles.btn, backgroundColor: '#ff4757' }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <span style={{ fontSize: '28px', transform: 'rotate(135deg)', display: 'inline-block' }}>📞</span>
          </button>
          
          <button 
            onClick={onAccept}
            style={{ ...styles.btn, backgroundColor: '#2ed573' }}
            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            <span style={{ fontSize: '28px' }}>📞</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default CallPopup;

