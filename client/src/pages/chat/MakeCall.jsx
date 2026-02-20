import React, { useContext, useState } from 'react';
import SocketContext  from '../../context/SocketContext';
import AuthContext from '../../context/AuthContext';

const MakeCall = ({ onClose, selectedUser }) => {
  const [targetId, setTargetId] = useState(selectedUser?.name || '');
  const [isCalling, setIsCalling] = useState(false);
  const socket = useContext(SocketContext);
  const { user } = useContext(AuthContext);

  const startCall = () => {
    if (targetId.trim() && socket && user) {
      // Only emit the ring signal — WebRTC offer starts after call-accepted in Home.jsx
      socket.emit("call-user", { from: user._id, to: selectedUser._id, signalData: {} });
      setIsCalling(true);
    }
  };

  const endCall = () => {
    if (socket && user) {
      socket.emit("end-call", { from: user._id, to: selectedUser._id, signalData: {} });
    }
    setIsCalling(false);
    onClose?.();
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', minHeight: '100vh',
      background: 'rgba(0,0,0,0.85)', padding: '16px'
    }}>
      <div style={{
        background: '#1f1f1f', padding: '40px 32px', borderRadius: '24px',
        width: '100%', maxWidth: '360px', textAlign: 'center',
        color: 'white', boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        border: '1px solid #333', display: 'flex', flexDirection: 'column', gap: '20px'
      }}>
        <h2 style={{ margin: 0, fontSize: '22px', fontWeight: 600 }}>
          {isCalling ? 'On a Call' : 'Voice Call'}
        </h2>

        {isCalling ? (
          <>
            <div style={{
              width: '90px', height: '90px', background: '#667eea',
              borderRadius: '50%', margin: '0 auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '32px', fontWeight: 700,
              animation: 'pulse 2s infinite',
              boxShadow: '0 0 0 0 rgba(102,126,234,0.7)'
            }}>
              {targetId[0]?.toUpperCase()}
            </div>
            <p style={{ margin: 0, fontSize: '18px', color: '#ccc' }}>{targetId}</p>
            <p style={{ margin: 0, fontSize: '14px', color: '#10b981' }}>🔔 Calling...</p>
            <button onClick={endCall} style={{
              padding: '14px', background: '#ef4444', color: 'white',
              border: 'none', borderRadius: '12px', fontSize: '16px',
              fontWeight: 600, cursor: 'pointer'
            }}>
              🔴 End Call
            </button>
          </>
        ) : (
          <>
            <div style={{
              width: '90px', height: '90px', background: '#374151',
              borderRadius: '50%', margin: '0 auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '36px'
            }}>
              {selectedUser?.avatar || targetId[0]?.toUpperCase() || '👤'}
            </div>
            <input
              type="text"
              placeholder="Enter user name or ID"
              style={{
                padding: '12px 16px', border: '1px solid #444',
                borderRadius: '12px', fontSize: '15px',
                background: '#2d2d2d', color: 'white', outline: 'none'
              }}
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            />
            <button
              onClick={startCall}
              disabled={!targetId.trim()}
              style={{
                padding: '14px', background: targetId.trim() ? '#10b981' : '#374151',
                color: 'white', border: 'none', borderRadius: '12px',
                fontSize: '16px', fontWeight: 600,
                cursor: targetId.trim() ? 'pointer' : 'not-allowed'
              }}
            >
              📞 Call
            </button>
            <button onClick={onClose} style={{
              padding: '10px', background: 'transparent', color: '#9ca3af',
              border: '1px solid #444', borderRadius: '12px',
              fontSize: '14px', cursor: 'pointer'
            }}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default MakeCall;
