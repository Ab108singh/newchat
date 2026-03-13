import { useRef, useCallback } from 'react';

// TURN server config — use env vars with safe fallbacks
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: import.meta.env.VITE_TURN_URL || 'turn:13.61.12.47:3478',
      username: import.meta.env.VITE_TURN_USERNAME || 'myuser',
      credential: import.meta.env.VITE_TURN_CREDENTIAL || 'mypassword'
    }
  ],
  iceCandidatePoolSize: 10
};

// How long (ms) to wait for callee to accept before auto-cancelling
const CALL_TIMEOUT_MS = 45_000;

export const useWebRTC = (socket, userId, selectedUser) => {
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  // Queue ICE candidates that arrive before remoteDescription is set
  const iceCandidateQueue = useRef([]);
  // Auto-cancel timer for unanswered outgoing calls
  const callTimeoutRef = useRef(null);

  const socketRef = useRef(socket);
  const selectedUserRef = useRef(selectedUser);
  socketRef.current = socket;
  selectedUserRef.current = selectedUser;

  // ── Audio playback ────────────────────────────────────────────────────────

  const playRemoteStream = (stream) => {
    const audio = document.getElementById('remote-audio');
    if (audio) {
      audio.srcObject = stream;
      audio.play().catch(e =>
        console.warn("Remote audio autoplay blocked (will resume on next interaction):", e)
      );
    }
  };

  // ── Peer creation ─────────────────────────────────────────────────────────

  const createPeer = useCallback((toId, onConnectionFailed) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);

    peer.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        socketRef.current.emit("ice-candidate", { to: toId, candidate: e.candidate });
      }
    };

    peer.ontrack = (e) => {
      console.log("✅ Remote track received:", e.streams);
      if (e.streams && e.streams[0]) {
        playRemoteStream(e.streams[0]);
      }
    };

    peer.onconnectionstatechange = () => {
      const state = peer.connectionState;
      console.log("🔗 Peer connection state:", state);
      if (state === 'failed' || state === 'disconnected') {
        console.warn("Peer connection", state, "— cleaning up");
        // Notify caller/callee that call ended unexpectedly
        const sel = selectedUserRef.current;
        const sock = socketRef.current;
        if (sock && sel && userId) {
          sock.emit("end-call", { from: userId, to: sel._id, signalData: {} });
        }
        onConnectionFailed?.();
        cleanUp();
      }
    };

    peer.onicegatheringstatechange = () => {
      console.log("ICE gathering state:", peer.iceGatheringState);
    };

    peer.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", peer.iceConnectionState);
    };

    return peer;
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ICE candidate queue ───────────────────────────────────────────────────

  /** Flush queued ICE candidates after remoteDescription is set */
  const flushIceCandidates = useCallback(async () => {
    const peer = peerRef.current;
    if (!peer) return;
    console.log(`Flushing ${iceCandidateQueue.current.length} queued ICE candidates`);
    for (const candidate of iceCandidateQueue.current) {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.error("Error adding queued ICE candidate:", e);
      }
    }
    iceCandidateQueue.current = [];
  }, []);

  /** Add ICE candidate — queue it if remote description not set yet */
  const addIceCandidate = useCallback(async (candidate) => {
    const peer = peerRef.current;
    if (!peer) return;

    if (!peer.remoteDescription) {
      console.log("Queuing ICE candidate (remoteDescription not set yet)");
      iceCandidateQueue.current.push(candidate);
    } else {
      try {
        await peer.addIceCandidate(new RTCIceCandidate(candidate));
        console.log("ICE candidate added ✅");
      } catch (e) {
        console.error("Error adding ICE candidate:", e);
      }
    }
  }, []);

  // ── Call timeout ──────────────────────────────────────────────────────────

  /** Start the 45-second auto-cancel timer for unanswered outgoing calls */
  const startCallTimeout = useCallback((onTimeout) => {
    clearCallTimeout();
    callTimeoutRef.current = setTimeout(() => {
      console.log("⏰ Call timed out — auto-cancelling");
      const sel = selectedUserRef.current;
      const sock = socketRef.current;
      if (sock && sel) {
        sock.emit("call-timeout", { from: userId, to: sel._id });
      }
      onTimeout?.();
    }, CALL_TIMEOUT_MS);
  }, [userId]);

  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  }, []);

  // ── WebRTC flows ──────────────────────────────────────────────────────────

  /** Called by CALLER after call-accepted */
  const makeCall = useCallback(async (onConnectionFailed) => {
    const sel = selectedUserRef.current;
    const sock = socketRef.current;
    if (!sock || !sel) return;

    iceCandidateQueue.current = [];
    console.log("makeCall() — getting mic, creating offer");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const peer = createPeer(sel._id, onConnectionFailed);
      peerRef.current = peer;

      stream.getTracks().forEach(track => peer.addTrack(track, stream));

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      sock.emit("webrtc-offer", { to: sel._id, offer });
      console.log("webrtc-offer sent to:", sel._id);
    } catch (err) {
      console.error("makeCall error:", err);
    }
  }, [createPeer]);

  /** Called by RECEIVER when webrtc-offer arrives */
  const answerCall = useCallback(async (fromId, offer, onConnectionFailed) => {
    const sock = socketRef.current;
    if (!sock) return;

    iceCandidateQueue.current = [];
    console.log("answerCall() — getting mic, creating answer");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const peer = createPeer(fromId, onConnectionFailed);
      peerRef.current = peer;

      stream.getTracks().forEach(track => peer.addTrack(track, stream));

      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      // Flush any ICE candidates that arrived before remoteDescription was set
      await flushIceCandidates();

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      sock.emit("webrtc-answer", { to: fromId, answer });
      console.log("webrtc-answer sent to:", fromId);
    } catch (err) {
      console.error("answerCall error:", err);
    }
  }, [createPeer, flushIceCandidates]);

  const stopCall = useCallback(() => {
    const sel = selectedUserRef.current;
    const sock = socketRef.current;
    if (sock && sel) {
      sock.emit("end-call", { from: userId, to: sel._id, signalData: {} });
    }
    clearCallTimeout();
    cleanUp();
  }, [userId, clearCallTimeout]); // eslint-disable-line react-hooks/exhaustive-deps

  const cleanUp = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    iceCandidateQueue.current = [];
    clearCallTimeout();
    const audio = document.getElementById('remote-audio');
    if (audio) { audio.srcObject = null; }
    console.log("WebRTC cleaned up ✅");
  }, [clearCallTimeout]);

  return {
    makeCall,
    answerCall,
    stopCall,
    cleanUp,
    addIceCandidate,
    flushIceCandidates,
    startCallTimeout,
    clearCallTimeout,
    peerRef,
    localStreamRef,
    CALL_TIMEOUT_MS
  };
};