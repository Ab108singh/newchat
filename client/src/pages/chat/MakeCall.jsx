import React, { useContext, useState, useEffect, useRef } from 'react';
import SocketContext from '../../context/SocketContext';
import AuthContext from '../../context/AuthContext';

const CALL_TIMEOUT_MS = 45_000;

const MakeCall = ({ onClose, selectedUser, onCallTimeout }) => {
  const [isCalling, setIsCalling] = useState(false);
  const [countdown, setCountdown] = useState(Math.floor(CALL_TIMEOUT_MS / 1000));
  const socket = useContext(SocketContext);
  const { user } = useContext(AuthContext);
  const timerRef = useRef(null);
  const countdownRef = useRef(null);

  // Start a countdown display while ringing
  useEffect(() => {
    if (isCalling) {
      setCountdown(Math.floor(CALL_TIMEOUT_MS / 1000));
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(countdownRef.current);
  }, [isCalling]);

  const startCall = () => {
    if (!socket || !user || !selectedUser) return;
    socket.emit("call-user", { from: user._id, to: selectedUser._id, signalData: {} });
    setIsCalling(true);
  };

  const endCall = () => {
    if (socket && user && selectedUser) {
      socket.emit("end-call", { from: user._id, to: selectedUser._id, signalData: {} });
    }
    setIsCalling(false);
    clearInterval(countdownRef.current);
    onClose?.();
  };

  const initials = selectedUser?.name?.charAt(0)?.toUpperCase() || '?';
  const avatarSrc = selectedUser?.profilePic || null;

  return (
    <div style={styles.overlay}>
      <style>{`
        @keyframes ringPulse {
          0%   { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes breathe {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
          50%       { box-shadow: 0 0 0 16px rgba(16,185,129,0); }
        }
        .makecall-cancel-btn:hover { background: #374151 !important; }
        .makecall-end-btn:hover    { background: #dc2626 !important; transform: scale(1.05); }
      `}</style>

      <div style={styles.card}>
        {/* Avatar with pulse rings */}
        <div style={styles.avatarWrapper}>
          {isCalling && (
            <>
              <div style={{ ...styles.ring, animationDelay: '0s' }} />
              <div style={{ ...styles.ring, animationDelay: '0.6s' }} />
              <div style={{ ...styles.ring, animationDelay: '1.2s' }} />
            </>
          )}
          {avatarSrc
            ? <img src={avatarSrc} alt={selectedUser?.name} style={styles.avatar} />
            : (
              <div style={{
                ...styles.avatar,
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '42px', fontWeight: 700, color: 'white'
              }}>
                {initials}
              </div>
            )
          }
        </div>

        <h2 style={styles.name}>{selectedUser?.name || 'Unknown'}</h2>

        {isCalling ? (
          <>
            <p style={styles.callingText}>🔔 Calling…</p>
            <p style={styles.countdown}>{countdown}s</p>
            <button className="makecall-end-btn" onClick={endCall} style={styles.endBtn}>
              📵 &nbsp;Cancel Call
            </button>
          </>
        ) : (
          <>
            <p style={styles.subtitle}>Voice Call</p>
            <button onClick={startCall} style={styles.callBtn}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.04)'}
              onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              📞 &nbsp;Call
            </button>
            <button className="makecall-cancel-btn" onClick={onClose} style={styles.cancelBtn}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '100vh',
    background: 'rgba(0,0,0,0.88)',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    animation: 'fadeSlideUp 0.3s ease'
  },
  card: {
    background: 'linear-gradient(160deg, #1e1e2e 0%, #252535 100%)',
    padding: '44px 36px',
    borderRadius: '28px',
    width: '100%', maxWidth: '340px',
    textAlign: 'center',
    color: 'white',
    boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
    border: '1px solid rgba(255,255,255,0.08)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: '16px'
  },
  avatarWrapper: {
    position: 'relative',
    width: '110px', height: '110px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: '8px'
  },
  ring: {
    position: 'absolute',
    width: '110px', height: '110px',
    borderRadius: '50%',
    background: 'rgba(16,185,129,0.25)',
    animation: 'ringPulse 2s ease-out infinite'
  },
  avatar: {
    width: '110px', height: '110px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid #10b981',
    boxShadow: '0 0 20px rgba(16,185,129,0.4)',
    position: 'relative', zIndex: 1
  },
  name: {
    margin: 0, fontSize: '22px', fontWeight: 700, letterSpacing: '0.3px'
  },
  subtitle: {
    margin: 0, color: '#9ca3af', fontSize: '14px', letterSpacing: '0.5px'
  },
  callingText: {
    margin: 0, color: '#10b981', fontSize: '15px', fontWeight: 500, letterSpacing: '0.5px'
  },
  countdown: {
    margin: 0, color: '#6b7280', fontSize: '13px'
  },
  callBtn: {
    width: '100%', padding: '14px',
    background: 'linear-gradient(135deg, #10b981, #059669)',
    color: 'white', border: 'none', borderRadius: '14px',
    fontSize: '16px', fontWeight: 600, cursor: 'pointer',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
    marginTop: '4px'
  },
  endBtn: {
    width: '100%', padding: '14px',
    background: '#ef4444',
    color: 'white', border: 'none', borderRadius: '14px',
    fontSize: '16px', fontWeight: 600, cursor: 'pointer',
    transition: 'transform 0.2s ease, background 0.2s ease',
    boxShadow: '0 4px 16px rgba(239,68,68,0.35)',
    marginTop: '4px'
  },
  cancelBtn: {
    width: '100%', padding: '11px',
    background: 'transparent', color: '#6b7280',
    border: '1px solid #374151', borderRadius: '14px',
    fontSize: '14px', cursor: 'pointer',
    transition: 'background 0.2s ease'
  }
};

export default MakeCall;
