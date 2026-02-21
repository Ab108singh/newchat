import { useRef, useCallback } from 'react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:13.61.12.47:3478',
      username: 'myuser',
      credential: 'mypassword'
    }
  ]
};

export const useWebRTC = (socket, userId, selectedUser) => {
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  // Queue ICE candidates that arrive before remoteDescription is set
  const iceCandidateQueue = useRef([]);

  const socketRef = useRef(socket);
  const selectedUserRef = useRef(selectedUser);
  socketRef.current = socket;
  selectedUserRef.current = selectedUser;

  const playRemoteStream = (stream) => {
    const audio = document.getElementById('remote-audio');
    if (audio) {
      audio.srcObject = stream;
      // Resume AudioContext if suspended (browser autoplay policy)
      audio.play().catch(e => console.warn("Audio autoplay blocked, will play on next interaction:", e));
    }
  };

  const createPeer = useCallback((toId) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);

    peer.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        console.log("Sending ICE candidate to:", toId);
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
      console.log("🔗 Peer connection state:", peer.connectionState);
    };

    peer.onicegatheringstatechange = () => {
      console.log("ICE gathering state:", peer.iceGatheringState);
    };

    peer.oniceconnectionstatechange = () => {
      console.log("ICE connection state:", peer.iceConnectionState);
    };

    return peer;
  }, []);

  // Flush queued ICE candidates after remoteDescription is set
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

  // Add ICE candidate — queue it if remote description not set yet
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

  // Called by CALLER after call-accepted
  const makeCall = useCallback(async () => {
    const sel = selectedUserRef.current;
    const sock = socketRef.current;
    if (!sock || !sel) return;

    iceCandidateQueue.current = []; // Reset queue
    console.log("makeCall() — getting mic, creating offer");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const peer = createPeer(sel._id);
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

  // Called by RECEIVER when webrtc-offer arrives
  const answerCall = useCallback(async (fromId, offer) => {
    const sock = socketRef.current;
    if (!sock) return;

    iceCandidateQueue.current = []; // Reset queue
    console.log("answerCall() — getting mic, creating answer");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const peer = createPeer(fromId);
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
    cleanUp();
  }, [userId]);

  const cleanUp = useCallback(() => {
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    iceCandidateQueue.current = [];
    const audio = document.getElementById('remote-audio');
    if (audio) { audio.srcObject = null; }
    console.log("WebRTC cleaned up");
  }, []);

  return { makeCall, answerCall, stopCall, cleanUp, addIceCandidate, peerRef, localStreamRef };
};