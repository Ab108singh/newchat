import React, { useEffect, useRef } from 'react';

// Short royalty-free ringtone via web audio API — no external file needed
const playRingtone = (audioCtxRef) => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtxRef.current = ctx;

    const ring = () => {
      if (!audioCtxRef.current) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.36);
    };

    ring();
    const interval = setInterval(ring, 1800);
    return () => {
      clearInterval(interval);
      ctx.close().catch(() => {});
      audioCtxRef.current = null;
    };
  } catch (e) {
    console.warn('Ringtone unavailable:', e);
    return () => {};
  }
};

const CallPopup = ({ callerName, callerAvatar, onAccept, onDecline, callType = 'voice' }) => {
  const audioCtxRef = useRef(null);

  useEffect(() => {
    const stop = playRingtone(audioCtxRef);
    return stop;
  }, []);

  const stopRingtone = () => {
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
  };

  const handleAccept = () => { stopRingtone(); onAccept?.(); };
  const handleDecline = () => { stopRingtone(); onDecline?.(); };

  const initials = callerName?.charAt(0)?.toUpperCase() || '?';

  return (
    <div style={styles.overlay}>
      <style>{`
        @keyframes callPulse {
          0%   { transform: scale(1);   opacity: 0.5; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: scale(0.88) translateY(20px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes acceptBounce {
          0%,100% { transform: scale(1); }
          50%      { transform: scale(1.12); }
        }
        .call-accept-btn:hover { transform: scale(1.12) !important; box-shadow: 0 6px 24px rgba(16,185,129,0.55) !important; }
        .call-decline-btn:hover { transform: scale(1.12) !important; box-shadow: 0 6px 24px rgba(239,68,68,0.55) !important; }
      `}</style>

      <div style={styles.card}>
        {/* Caller avatar with animated rings */}
        <div style={styles.avatarWrapper}>
          <div style={{ ...styles.ring, animationDelay: '0s' }} />
          <div style={{ ...styles.ring, animationDelay: '0.6s' }} />
          <div style={{ ...styles.ring, animationDelay: '1.2s' }} />
          {callerAvatar
            ? <img src={callerAvatar} alt={callerName} style={styles.avatar} />
            : (
              <div style={styles.avatarPlaceholder}>
                {initials}
              </div>
            )
          }
        </div>

        <h2 style={styles.name}>{callerName || 'Unknown'}</h2>
        <p style={styles.callTypeLabel}>
          {callType === 'video' ? '🎥 Incoming Video Call' : '📞 Incoming Voice Call'}
        </p>

        <div style={styles.buttonRow}>
          {/* Decline */}
          <div style={styles.btnGroup}>
            <button
              className="call-decline-btn"
              onClick={handleDecline}
              style={styles.declineBtn}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" transform="rotate(135 12 12)"/>
              </svg>
            </button>
            <span style={styles.btnLabel}>Decline</span>
          </div>

          {/* Accept */}
          <div style={styles.btnGroup}>
            <button
              className="call-accept-btn"
              onClick={handleAccept}
              style={styles.acceptBtn}
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
            </button>
            <span style={styles.btnLabel}>Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.88)',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    zIndex: 9999,
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    backdropFilter: 'blur(6px)'
  },
  card: {
    background: 'linear-gradient(160deg, #1e1e2e 0%, #252535 100%)',
    padding: '44px 36px 40px',
    borderRadius: '28px',
    textAlign: 'center',
    color: 'white',
    width: '320px',
    boxShadow: '0 28px 70px rgba(0,0,0,0.55)',
    border: '1px solid rgba(255,255,255,0.09)',
    animation: 'cardIn 0.35s cubic-bezier(0.34,1.56,0.64,1)',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px'
  },
  avatarWrapper: {
    position: 'relative',
    width: '120px', height: '120px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: '8px'
  },
  ring: {
    position: 'absolute',
    width: '120px', height: '120px',
    borderRadius: '50%',
    background: 'rgba(99,102,241,0.3)',
    animation: 'callPulse 2s ease-out infinite'
  },
  avatar: {
    width: '110px', height: '110px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid #6366f1',
    boxShadow: '0 0 22px rgba(99,102,241,0.5)',
    position: 'relative', zIndex: 1
  },
  avatarPlaceholder: {
    width: '110px', height: '110px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '42px', fontWeight: 700, color: 'white',
    border: '3px solid #6366f1',
    boxShadow: '0 0 22px rgba(99,102,241,0.5)',
    position: 'relative', zIndex: 1
  },
  name: {
    margin: 0, fontSize: '24px', fontWeight: 700, letterSpacing: '0.3px'
  },
  callTypeLabel: {
    margin: 0, color: '#a5b4fc', fontSize: '14px', letterSpacing: '0.5px'
  },
  buttonRow: {
    display: 'flex', justifyContent: 'space-around', width: '100%', marginTop: '12px'
  },
  btnGroup: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
  },
  btnLabel: {
    fontSize: '12px', color: '#6b7280', letterSpacing: '0.3px'
  },
  declineBtn: {
    border: 'none', borderRadius: '50%',
    width: '68px', height: '68px',
    background: '#ef4444',
    cursor: 'pointer',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    boxShadow: '0 4px 16px rgba(239,68,68,0.4)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease'
  },
  acceptBtn: {
    border: 'none', borderRadius: '50%',
    width: '68px', height: '68px',
    background: '#10b981',
    cursor: 'pointer',
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    boxShadow: '0 4px 16px rgba(16,185,129,0.4)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    animation: 'acceptBounce 1.4s ease-in-out infinite'
  }
};

export default CallPopup;
