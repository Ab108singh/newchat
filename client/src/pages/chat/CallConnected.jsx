
import React, { useState, useEffect } from 'react';

const CallConnected = ({ callerName, callerAvatar, onHangup }) => {
  const [muted, setMuted] = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (s) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const styles = {
    overlay: {
      position: 'fixed', inset: 0,
      background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      zIndex: 9999, fontFamily: 'Inter, system-ui, sans-serif',
      color: 'white', gap: '28px',
    },
    pulseWrapper: {
      position: 'relative', width: '130px', height: '130px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    pulse: {
      position: 'absolute', width: '130px', height: '130px',
      borderRadius: '50%', background: 'rgba(99,102,241,0.3)',
      animation: 'voicePulse 1.8s ease-out infinite',
    },
    pulse2: {
      position: 'absolute', width: '130px', height: '130px',
      borderRadius: '50%', background: 'rgba(99,102,241,0.15)',
      animation: 'voicePulse 1.8s ease-out 0.6s infinite',
    },
    avatar: {
      width: '110px', height: '110px', borderRadius: '50%',
      objectFit: 'cover', border: '4px solid #6366f1',
      boxShadow: '0 0 24px rgba(99,102,241,0.5)',
      zIndex: 1,
    },
    avatarPlaceholder: {
      width: '110px', height: '110px', borderRadius: '50%',
      background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '40px', fontWeight: 700, zIndex: 1,
      border: '4px solid #6366f1',
      boxShadow: '0 0 24px rgba(99,102,241,0.5)',
    },
    name: { fontSize: '26px', fontWeight: 700, margin: 0, letterSpacing: '0.5px' },
    status: { fontSize: '14px', color: '#10b981', fontWeight: 500, letterSpacing: '1px', textTransform: 'uppercase' },
    timer: { fontSize: '32px', fontWeight: 300, letterSpacing: '2px', color: '#e2e8f0' },
    controls: {
      display: 'flex', gap: '24px', alignItems: 'center', marginTop: '12px',
    },
    iconBtn: (active, color) => ({
      width: '60px', height: '60px', borderRadius: '50%',
      background: active ? (color || '#374151') : '#1e293b',
      border: `2px solid ${active ? (color || '#6b7280') : '#334155'}`,
      color: 'white', fontSize: '22px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.2s ease',
      boxShadow: active ? `0 0 12px ${color || '#374151'}60` : 'none',
    }),
    hangupBtn: {
      width: '70px', height: '70px', borderRadius: '50%',
      background: '#ef4444', border: 'none',
      color: 'white', fontSize: '26px', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 20px rgba(239,68,68,0.5)',
      transition: 'transform 0.2s ease',
    },
  };

  return (
    <div style={styles.overlay}>
      <style>{`
        @keyframes voicePulse {
          0% { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(1.7); opacity: 0; }
        }
      `}</style>

      {/* Animated avatar */}
      <div style={styles.pulseWrapper}>
        <div style={styles.pulse} />
        <div style={styles.pulse2} />
        {callerAvatar
          ? <img src={callerAvatar} alt={callerName} style={styles.avatar} />
          : <div style={styles.avatarPlaceholder}>{callerName?.charAt(0).toUpperCase() || '👤'}</div>
        }
      </div>

      {/* Name & status */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <h2 style={styles.name}>{callerName || 'Unknown'}</h2>
        <p style={styles.status}>● Connected</p>
      </div>

      {/* Timer */}
      <div style={styles.timer}>{formatTime(seconds)}</div>

      {/* Control buttons */}
      <div style={styles.controls}>
        {/* Mute */}
        <button
          style={styles.iconBtn(muted, '#f59e0b')}
          onClick={() => setMuted(m => !m)}
          title={muted ? 'Unmute' : 'Mute'}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {muted ? '🔇' : '🎙️'}
        </button>

        {/* Hang up */}
        <button
          style={styles.hangupBtn}
          onClick={onHangup}
          title="End Call"
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          📵
        </button>

        {/* Speaker */}
        <button
          style={styles.iconBtn(speakerOff, '#f59e0b')}
          onClick={() => setSpeakerOff(s => !s)}
          title={speakerOff ? 'Speaker On' : 'Speaker Off'}
          onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
        >
          {speakerOff ? '🔕' : '🔊'}
        </button>
      </div>
    </div>
  );
};

export default CallConnected;
