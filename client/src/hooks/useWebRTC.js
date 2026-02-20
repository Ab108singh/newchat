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

  // Keep socket and selectedUser in refs so callbacks always have latest values
  const socketRef = useRef(socket);
  const selectedUserRef = useRef(selectedUser);
  socketRef.current = socket;
  selectedUserRef.current = selectedUser;

  const playRemoteStream = (stream) => {
    const audio = document.getElementById('remote-audio');
    if (audio) {
      audio.srcObject = stream;
      audio.play().catch(e => console.error("Audio play error:", e));
    }
  };

  const createPeer = useCallback((toId) => {
    const peer = new RTCPeerConnection(ICE_SERVERS);

    peer.onicecandidate = (e) => {
      if (e.candidate && socketRef.current) {
        socketRef.current.emit("ice-candidate", { to: toId, candidate: e.candidate });
      }
    };

    peer.ontrack = (e) => {
      console.log("Remote track received:", e.streams[0]);
      playRemoteStream(e.streams[0]);
    };

    peer.onconnectionstatechange = () => {
      console.log("Peer connection state:", peer.connectionState);
    };

    return peer;
  }, []);

  // Called by CALLER after call-accepted — sends SDP offer
  const makeCall = useCallback(async () => {
    const sel = selectedUserRef.current;
    const sock = socketRef.current;
    if (!sock || !sel) return;

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

  // Called by RECEIVER when webrtc-offer arrives (after they already accepted)
  const answerCall = useCallback(async (fromId, offer) => {
    const sock = socketRef.current;
    if (!sock) return;

    console.log("answerCall() — getting mic, creating answer");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;

      const peer = createPeer(fromId);
      peerRef.current = peer;

      stream.getTracks().forEach(track => peer.addTrack(track, stream));

      await peer.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      sock.emit("webrtc-answer", { to: fromId, answer });
      console.log("webrtc-answer sent to:", fromId);
    } catch (err) {
      console.error("answerCall error:", err);
    }
  }, [createPeer]);

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
    const audio = document.getElementById('remote-audio');
    if (audio) { audio.srcObject = null; }
    console.log("WebRTC cleaned up");
  }, []);

  return { makeCall, answerCall, stopCall, cleanUp, peerRef, localStreamRef };
};