import React, { useState, useEffect } from 'react';

const CallConnected = ({ callerName, callerAvatar, onHangup, localStream, peerRef }) => {
  const [muted, setMuted] = useState(false);
  const [speakerOff, setSpeakerOff] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [connState, setConnState] = useState('connected');

  // Live call timer
  useEffect(() => {
    const timer = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Watch peer connection quality
  useEffect(() => {
    const peer = peerRef?.current;
    if (!peer) return;
    const handleChange = () => setConnState(peer.connectionState || 'connected');
    peer.addEventListener('connectionstatechange', handleChange);
    return () => peer.removeEventListener('connectionstatechange', handleChange);
  }, [peerRef]);

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`;
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => { track.enabled = !track.enabled; });
    }
    setMuted(m => !m);
  };

  const toggleSpeaker = () => {
    const audio = document.getElementById('remote-audio');
    if (audio) audio.muted = !audio.muted;
    setSpeakerOff(s => !s);
  };

  const qualityColor = {
    connected: '#10b981',
    connecting: '#f59e0b',
    reconnecting: '#f59e0b',
    failed: '#ef4444',
    disconnected: '#6b7280',
  }[connState] || '#10b981';

  const qualityLabel = {
    connected: 'Connected',
    connecting: 'Connecting…',
    reconnecting: 'Reconnecting…',
    failed: 'Connection failed',
    disconnected: 'Disconnected',
  }[connState] || 'Connected';

  return (
    <div style={styles.overlay}>
      <style>{`
        @keyframes voicePulse {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
        @keyframes waveBar {
          0%,100% { transform: scaleY(0.4); }
          50%      { transform: scaleY(1); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .ctrl-btn:hover { filter: brightness(1.2) !important; transform: scale(1.1) !important; }
        .hangup-btn:hover { transform: scale(1.12) !important; }
      `}</style>

      {/* Subtle background particles */}
      <div style={styles.bgGlow} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', animation: 'fadeIn 0.4s ease' }}>

        {/* Avatar with pulse */}
        <div style={styles.pulseWrapper}>
          <div style={{ ...styles.pulse, animationDelay: '0s' }} />
          <div style={{ ...styles.pulse, animationDelay: '0.9s' }} />
          {callerAvatar
            ? <img src={callerAvatar} alt={callerName} style={styles.avatar} />
            : <div style={styles.avatarPlaceholder}>{callerName?.charAt(0)?.toUpperCase() || '👤'}</div>
          }
        </div>

        {/* Name & status */}
        <div style={{ textAlign: 'center' }}>
          <h2 style={styles.name}>{callerName || 'Unknown'}</h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginTop: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: qualityColor, display: 'inline-block', boxShadow: `0 0 8px ${qualityColor}` }} />
            <span style={{ color: qualityColor, fontSize: '13px', fontWeight: 500, letterSpacing: '0.5px' }}>
              {qualityLabel}
            </span>
          </div>
        </div>

        {/* Timer */}
        <div style={styles.timer}>{formatTime(seconds)}</div>

        {/* Audio waveform animation */}
        <div style={styles.waveform}>
          {[0, 0.2, 0.1, 0.3, 0.15, 0.25, 0.05].map((delay, i) => (
            <div key={i} style={{
              width: '4px',
              borderRadius: '2px',
              background: muted ? '#374151' : '#6366f1',
              animation: muted ? 'none' : `waveBar 0.9s ease-in-out ${delay}s infinite`,
              transform: muted ? 'scaleY(0.3)' : undefined,
              height: '28px',
              transition: 'background 0.3s ease'
            }} />
          ))}
        </div>

        {/* Control buttons */}
        <div style={styles.controls}>
          {/* Mute mic */}
          <div style={styles.ctrlGroup}>
            <button
              className="ctrl-btn"
              style={styles.ctrlBtn(muted, '#f59e0b')}
              onClick={toggleMute}
              title={muted ? 'Unmute' : 'Mute'}
            >
              {muted
                ? <MicOffIcon />
                : <MicIcon />
              }
            </button>
            <span style={styles.ctrlLabel}>{muted ? 'Unmute' : 'Mute'}</span>
          </div>

          {/* Hang up */}
          <div style={styles.ctrlGroup}>
            <button className="hangup-btn" style={styles.hangupBtn} onClick={onHangup} title="End Call">
              <PhoneOffIcon />
            </button>
            <span style={styles.ctrlLabel}>End Call</span>
          </div>

          {/* Speaker */}
          <div style={styles.ctrlGroup}>
            <button
              className="ctrl-btn"
              style={styles.ctrlBtn(speakerOff, '#f59e0b')}
              onClick={toggleSpeaker}
              title={speakerOff ? 'Speaker On' : 'Speaker Off'}
            >
              {speakerOff
                ? <VolumeOffIcon />
                : <VolumeOnIcon />
              }
            </button>
            <span style={styles.ctrlLabel}>{speakerOff ? 'Speaker Off' : 'Speaker'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── SVG Icons ──────────────────────────────────────────────────────────────

const MicIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
  </svg>
);

const MicOffIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="1" y1="1" x2="23" y2="23"/>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
    <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
    <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
  </svg>
);

const VolumeOnIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
);

const VolumeOffIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
  </svg>
);

const PhoneOffIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07"/>
    <path d="M14.5 2.5C8.5 2.5 3.5 7 1 10.5"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'linear-gradient(160deg, #0f0f1a 0%, #1a1a2e 50%, #0d1b3e 100%)',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 9999,
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    color: 'white',
    overflow: 'hidden'
  },
  bgGlow: {
    position: 'absolute',
    width: '400px', height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
    top: '50%', left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none'
  },
  pulseWrapper: {
    position: 'relative',
    width: '130px', height: '130px',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  pulse: {
    position: 'absolute',
    width: '130px', height: '130px',
    borderRadius: '50%',
    background: 'rgba(99,102,241,0.25)',
    animation: 'voicePulse 2s ease-out infinite'
  },
  avatar: {
    width: '110px', height: '110px',
    borderRadius: '50%',
    objectFit: 'cover',
    border: '3px solid #6366f1',
    boxShadow: '0 0 28px rgba(99,102,241,0.55)',
    position: 'relative', zIndex: 1
  },
  avatarPlaceholder: {
    width: '110px', height: '110px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '40px', fontWeight: 700,
    border: '3px solid #6366f1',
    boxShadow: '0 0 28px rgba(99,102,241,0.55)',
    position: 'relative', zIndex: 1
  },
  name: {
    fontSize: '26px', fontWeight: 700,
    margin: 0, letterSpacing: '0.4px'
  },
  timer: {
    fontSize: '36px', fontWeight: 300,
    letterSpacing: '3px', color: '#e2e8f0',
    fontVariantNumeric: 'tabular-nums'
  },
  waveform: {
    display: 'flex', gap: '5px',
    alignItems: 'center', height: '32px'
  },
  controls: {
    display: 'flex', gap: '32px', alignItems: 'flex-start', marginTop: '8px'
  },
  ctrlGroup: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px'
  },
  ctrlLabel: {
    fontSize: '11px', color: '#6b7280', letterSpacing: '0.4px'
  },
  ctrlBtn: (active, color) => ({
    width: '62px', height: '62px',
    borderRadius: '50%',
    background: active ? `${color}22` : '#1e293b',
    border: `2px solid ${active ? color : '#334155'}`,
    color: 'white', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.2s ease',
    boxShadow: active ? `0 0 14px ${color}40` : 'none'
  }),
  hangupBtn: {
    width: '72px', height: '72px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    border: 'none',
    color: 'white', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 6px 24px rgba(239,68,68,0.5)',
    transition: 'transform 0.2s ease'
  }
};

export default CallConnected;
