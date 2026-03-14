import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import axios from 'axios';
import './Home.css';
import SocketContext from '../context/SocketContext';
import EmojiPicker from 'emoji-picker-react';
import MakeCall from './chat/MakeCall';
import CallPopup from './chat/Call';
import CallConnected from './chat/CallConnected';
import { useWebRTC } from '../hooks/useWebRTC';
import { useTheme } from '../context/ThemeContext';

const Home = () => {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const { theme, toggleTheme } = useTheme();
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef(null);
  const [sidebarUsers, setSidebarUsers] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth <= 768);
  // New Chat search
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatQuery, setNewChatQuery] = useState('');
  const [newChatResults, setNewChatResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const newChatInputRef = useRef(null);
  // Call state
  const [showMakeCall, setShowMakeCall] = useState(false);
  const [callComming, setCallComming] = useState(false);
  const [incomingCaller, setIncomingCaller] = useState(null);
  const[callConnected,setCallConnected] = useState(false);
  const [incomingOffer, setIncomingOffer] = useState(null);
  const [callFromId, setCallFromId] = useState(null);
  const remoteAudioRef = useRef(null);
  const imageInputRef = useRef(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const typingTimeoutRef = useRef(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [contactSearch, setContactSearch] = useState('');
  const [previewImage, setPreviewImage] = useState(null);
  // Selection / delete state (chats)
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedChats, setSelectedChats] = useState(new Set());
  // Selection / delete state (messages)
  const [msgSelectionMode, setMsgSelectionMode] = useState(false);
  const [selectedMsgs, setSelectedMsgs] = useState(new Set());
  // Refs so socket handlers always read the LATEST state without re-registering
  const selectedUserRef = useRef(null);
  const userRef = useRef(null);
  selectedUserRef.current = selectedUser;
  userRef.current = user;

 const socket = useContext(SocketContext);
 const { makeCall, answerCall, stopCall, cleanUp, addIceCandidate, flushIceCandidates, startCallTimeout, clearCallTimeout, peerRef, localStreamRef } = useWebRTC(socket, user?._id, selectedUser);

 useEffect(()=>{
  if(!socket) return;
  socket.on("call-accepted",()=>{
    console.log("call-accepted — caller starting WebRTC offer");
    clearCallTimeout(); // Stop the 45-second ringing timer
    setCallComming(false);  
    setShowMakeCall(false);
    setCallConnected(true);
    // Caller sends WebRTC offer now that receiver accepted
    makeCall(() => { setCallConnected(false); setIncomingCaller(null); });
  })
  return ()=> socket.off("call-accepted");
 },[socket])

 // Listen for WebRTC offer (receiver side) — answer it immediately when it arrives
 useEffect(()=>{
  if(!socket) return;
  socket.on("webrtc-offer", ({ from, offer }) => {
    console.log("webrtc-offer received from:", from, "— answering now");
    // Answer the call right here — the receiver already accepted via onAccept
    answerCall(from, offer);
  });
  return ()=> socket.off("webrtc-offer");
 },[socket])

 // Listen for WebRTC answer (caller side) — set remote description then flush queued ICE candidates
 useEffect(()=>{
  if(!socket) return;
  socket.on("webrtc-answer", async ({ answer }) => {
    console.log("webrtc-answer received");
    if(peerRef.current){
      await peerRef.current.setRemoteDescription(new RTCSessionDescription(answer));
      console.log("Remote description set ✅ — flushing queued ICE candidates");
      // Use the hook's flush helper (manages the internal queue correctly)
      await flushIceCandidates();
    }
  });
  return ()=> socket.off("webrtc-answer");
 },[socket])

 // Listen for ICE candidates — safely queued if remoteDescription not set yet
 useEffect(()=>{
  if(!socket) return;
  socket.on("ice-candidate", ({ candidate }) => {
    if(candidate){
      addIceCandidate(candidate);
    }
  });
  return ()=> socket.off("ice-candidate");
 },[socket])






 useEffect(()=>{
  if(!socket) return;
  socket.on("call-declined",({from,to})=>{
    console.log("call-declined",from,to);
    clearCallTimeout();
    setCallComming(false);  
    setShowMakeCall(false);
    setIncomingCaller(null);
    setCallConnected(false);
    cleanUp();
  })
  return ()=> socket.off("call-declined");
 },[socket])




 useEffect(()=>{
  if(!socket) return;
  socket.on("call-user",({user,signalData})=>{
    console.log("call-user",user,signalData);
    setIncomingCaller(user);
    setCallComming(true);
  })
  return ()=> socket.off("call-user");
 },[socket])



 useEffect(()=>{
  if(!socket) return;
  socket.on("end-call",({from,signalData})=>{
    console.log("end-call from:", from);
    setCallComming(false);  
    setCallConnected(false);
    setShowMakeCall(false);
    setIncomingCaller(null);
    cleanUp(); // Stop mic tracks and close peer connection
  })
  return ()=>socket.off("end-call");
 },[socket])

 // Remote caller timed out / cancelled before we picked up
 useEffect(()=>{
  if(!socket) return;
  socket.on("call-timeout",({from})=>{
    console.log("call-timeout from:", from);
    setCallComming(false);
    setIncomingCaller(null);
  })
  return ()=>socket.off("call-timeout");
 },[socket])




  useEffect(()=>{
  if(selectedUser && user && socket){
    // BUG-13: Added socket guard (was only checking selectedUser && user)
    socket.emit("all-read",{currentUserId:user._id,selectedUserId:selectedUser._id});
    
    // Clear unread count in sidebar immediately (optimistic update)
    setSidebarUsers(prev => prev.map(u => 
      u._id === selectedUser._id 
        ? {...u, noofUnreadMessages: 0}
        : u
    ));
    
    // Mark all messages from selected user as read (optimistic update)
    setMessages(prev => prev.map(msg => 
      msg.sender === 'them' ? {...msg, isRead: true} : msg
    ));
  }
  },[socket,selectedUser,user])

  useEffect(()=>{
    if(!socket) return;
    socket.on("messages-marked-read",({readBy, messagesFrom})=>{
      // Use ref so this fires correctly regardless of which chat is currently open
      const currSelected = selectedUserRef.current;
      if(currSelected && currSelected._id === readBy){
        setMessages(prev => prev.map(msg => 
          msg.sender === 'me' ? {...msg, isRead: true} : msg
        ));
      }
    })
    return ()=>socket.off("messages-marked-read");
  },[socket])

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Load sidebar contacts (only users with existing conversations) ──────────
  const loadContacts = () => {
    if (!user) return;
    axios.get(`${import.meta.env.VITE_API_URL}/user/users`, {
      params: { userId: user._id },
      withCredentials: true
    }).then((res) => {
      // Server already returns users enriched with lastMessage + unreadCount
      setSidebarUsers(res.data.users || []);
    }).catch(err => console.error('loadContacts error:', err));
  };

  useEffect(() => {
    if (socket && user) loadContacts();
  }, [socket, user]); // eslint-disable-line react-hooks/exhaustive-deps


  // ── Fetch messages when a chat is opened ─────────────────────────────────
  useEffect(()=>{
    if(!socket || !selectedUser || !user) return;
    // Exit message selection when switching chats
    setMsgSelectionMode(false);
    setSelectedMsgs(new Set());
    axios.get(`${import.meta.env.VITE_API_URL}/message/messages/${selectedUser._id}`,{
      params: { userId: user._id },
      withCredentials:true
    }).then((res)=>{
      const formattedMessages = res.data.map(msg => ({
        _id: msg._id,
        text: msg.message,
        type: msg.messageType || 'text',
        imageUrl: msg.imageUrl || null,
        sender: msg.sender === user._id ? 'me' : 'them',
        timestamp: new Date(msg.createdAt),
        isRead: msg.isRead || false
      }));
      setMessages(formattedMessages);
    }).catch((err)=>{
      console.log(err);
      setMessages([]);
    })
  },[selectedUser, socket, user])

  // ── New Chat: search users by username ───────────────────────────────────
  useEffect(() => {
    if (!showNewChat) { setNewChatResults([]); return; }
    // Focus the input when panel opens
    setTimeout(() => newChatInputRef.current?.focus(), 50);
  }, [showNewChat]);

  useEffect(() => {
    if (!newChatQuery.trim() || !user) { setNewChatResults([]); return; }
    const timer = setTimeout(() => {
      setIsSearching(true);
      axios.get(`${import.meta.env.VITE_API_URL}/user/search`, {
        params: { q: newChatQuery.trim(), userId: user._id },
        withCredentials: true
      }).then(res => {
        setNewChatResults(res.data.users || []);
      }).catch(() => setNewChatResults([]))
        .finally(() => setIsSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [newChatQuery, user]);

  useEffect(()=>{
    if(!socket) return;
    socket.on("user-online",({userId,isOnline})=>{
      setSidebarUsers(prev => prev.map(u => u._id === userId ? {...u, isOnline} : u));
    })
    return ()=>socket.off("user-online");
  }, [socket])

  useEffect(()=>{
    if(!socket) return;
    socket.on("user-offline",({userId,isOnline})=>{
      setSidebarUsers(prev => prev.map(u => u._id === userId ? {...u, isOnline} : u));
    })
    return ()=>socket.off("user-offline");
  }, [socket])

  useEffect(()=>{
    if(!socket) return;
    socket.on("receive",({sender, msg, _id, timestamp})=>{
      const currSelected = selectedUserRef.current;
      const currUser = userRef.current;

      // Helper: ensure sender is in sidebar (add them if first-ever message)
      const ensureInSidebar = (lastMessage, unreadDelta) => {
        setSidebarUsers(prev => {
          const idx = prev.findIndex(u => u._id === sender);
          if (idx !== -1) {
            // Already exists — update
            return prev.map(u => u._id === sender
              ? { ...u, lastMessage, noofUnreadMessages: (u.noofUnreadMessages || 0) + unreadDelta }
              : u
            );
          }
          // Not found — fetch user info then prepend
          if (currUser) {
            axios.get(`${import.meta.env.VITE_API_URL}/user/search`, {
              params: { q: sender, userId: currUser._id },
              withCredentials: true
            }).catch(() => {});
            // Optimistic: use id only; loadContacts will fill it properly
            // We trigger a reload instead
            setTimeout(() => {
              if (currUser) {
                axios.get(`${import.meta.env.VITE_API_URL}/user/users`, {
                  params: { userId: currUser._id },
                  withCredentials: true
                }).then(res => {
                  const newContact = res.data.users.find(u => u._id === sender);
                  if (newContact) {
                    setSidebarUsers(p => {
                      if (p.some(u => u._id === sender)) return p;
                      return [{ ...newContact, lastMessage, noofUnreadMessages: 1 }, ...p];
                    });
                  }
                }).catch(() => {});
              }
            }, 400);
          }
          return prev;
        });
      };

      if(currSelected && sender === currSelected._id){
        const newMessage = {
          _id: _id || null,  // real DB id from server (enables instant selection)
          text: msg, type: 'text', imageUrl: null,
          sender: 'them',
          timestamp: timestamp ? new Date(timestamp) : new Date(),
          isRead: false
        };
        setMessages(prev=>[...prev,newMessage]);
        if(currUser && socket){
          socket.emit("all-read", { currentUserId: currUser._id, selectedUserId: sender });
        }
        ensureInSidebar(msg, 0);
      } else {
        ensureInSidebar(msg, 1);
      }
    })
    return ()=>socket.off("receive");
  },[socket])  

  useEffect(()=>{
    if(!socket) return;
    socket.on("receive-image",({sender, imageUrl})=>{
      const currSelected = selectedUserRef.current;
      const currUser = userRef.current;

      const ensureInSidebarImg = (lastMessage, unreadDelta) => {
        setSidebarUsers(prev => {
          const idx = prev.findIndex(u => u._id === sender);
          if (idx !== -1) {
            return prev.map(u => u._id === sender
              ? { ...u, lastMessage, noofUnreadMessages: (u.noofUnreadMessages || 0) + unreadDelta }
              : u
            );
          }
          if (currUser) {
            setTimeout(() => {
              axios.get(`${import.meta.env.VITE_API_URL}/user/users`, {
                params: { userId: currUser._id },
                withCredentials: true
              }).then(res => {
                const newContact = res.data.users.find(u => u._id === sender);
                if (newContact) {
                  setSidebarUsers(p => {
                    if (p.some(u => u._id === sender)) return p;
                    return [{ ...newContact, lastMessage, noofUnreadMessages: 1 }, ...p];
                  });
                }
              }).catch(() => {});
            }, 400);
          }
          return prev;
        });
      };

      if(currSelected && sender === currSelected._id){
        const newMessage = {
          _id: null,
          text: '', type: 'image', imageUrl,
          sender: 'them', timestamp: new Date(), isRead: false
        };
        setMessages(prev=>[...prev, newMessage]);
        if(currUser && socket){
          socket.emit("all-read", { currentUserId: currUser._id, selectedUserId: sender });
        }
        ensureInSidebarImg('📷 Photo', 0);
      } else {
        ensureInSidebarImg('📷 Photo', 1);
      }
    })
    return ()=>socket.off("receive-image");
  },[socket])

  // Typing indicator listeners
  useEffect(() => {
    if (!socket) return;
    socket.on('typing', ({ from }) => {
      setTypingUsers(prev => ({ ...prev, [from]: true }));
    });
    socket.on('stop-typing', ({ from }) => {
      setTypingUsers(prev => {
        const next = { ...prev };
        delete next[from];
        return next;
      });
    });
    return () => {
      socket.off('typing');
      socket.off('stop-typing');
    };
  }, [socket]);

  // Real-time message deletion listener (handles messages deleted by the other user)
  useEffect(() => {
    if (!socket) return;
    socket.on('messages-deleted', ({ messageIds }) => {
      // Convert both sides to string to avoid ObjectId vs string mismatch
      const ids = messageIds.map(id => String(id));
      setMessages(prev => prev.filter(m => m._id && !ids.includes(String(m._id))));
    });
    return () => socket.off('messages-deleted');
  }, [socket]);

  // Patch optimistic message with real DB _id once server confirms save
  useEffect(() => {
    if (!socket) return;
    socket.on('message-saved', ({ tempId, _id, timestamp }) => {
      setMessages(prev => prev.map(m =>
        m._tempId === tempId
          ? { ...m, _id, timestamp: timestamp ? new Date(timestamp) : m.timestamp, _tempId: undefined }
          : m
      ));
    });
    return () => socket.off('message-saved');
  }, [socket]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedUser || !socket) return;

    // Give each optimistic message a unique tempId so we can patch it
    // when the server confirms the DB save and returns the real _id
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const newMessage = {
      _tempId: tempId,  // used to match message-saved event
      _id: null,        // no DB id yet
      text: messageInput,
      type: 'text',
      imageUrl: null,
      sender: 'me',
      timestamp: new Date(),
      isRead: false
    };

    setMessages(prev => [...prev, newMessage]);

    // If this user isn't in the sidebar yet (first message), add them
    setSidebarUsers(prev => {
      const exists = prev.some(u => u._id === selectedUser._id);
      if (!exists) {
        return [{ ...selectedUser, lastMessage: messageInput, noofUnreadMessages: 0 }, ...prev];
      }
      return prev.map(u =>
        u._id === selectedUser._id ? { ...u, lastMessage: messageInput } : u
      );
    });

    // Send via socket — include tempId so server can echo real _id back
    socket.emit('message', { recId: selectedUser._id, msg: messageInput, tempId });
    socket.emit('stop-typing', { to: selectedUser._id });
    clearTimeout(typingTimeoutRef.current);

    setMessageInput('');

    // Fallback: if server hasn't emitted "message-saved" within 1.2s (e.g. old server not restarted),
    // do a fresh DB fetch and replace the message list — this gives all real _ids instantly.
    const savedUser = selectedUser;
    const savedUserId = user._id;
    setTimeout(() => {
      setMessages(current => {
        const stillPending = current.some(m => m._tempId && !m._id);
        if (!stillPending) return current; // message-saved already patched them, skip fetch
        // Fetch from DB and replace list completely (avoids duplicates, always correct)
        axios.get(`${import.meta.env.VITE_API_URL}/message/messages/${savedUser._id}`, {
          params: { userId: savedUserId },
          withCredentials: true
        }).then(res => {
          const formatted = res.data.map(msg => ({
            _id: msg._id,
            text: msg.message,
            type: msg.messageType || 'text',
            imageUrl: msg.imageUrl || null,
            sender: msg.sender === savedUserId ? 'me' : 'them',
            timestamp: new Date(msg.createdAt),
            isRead: msg.isRead || false
          }));
          setMessages(formatted);
        }).catch(() => {});
        return current;
      });
    }, 1200);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedUser || !user) return;

    // Show optimistic preview with blob URL
    const previewUrl = URL.createObjectURL(file);
    const tempId = `temp-${Date.now()}`;
    const optimisticMsg = {
      _tempId: tempId,
      text: '',
      type: 'image',
      imageUrl: previewUrl,
      sender: 'me',
      timestamp: new Date(),
      isRead: false,
      isUploading: true
    };
    setMessages(prev => [...prev, optimisticMsg]);
    setSidebarUsers(prev => prev.map(u => 
      u._id === selectedUser._id ? {...u, lastMessage: '📷 Photo'} : u
    ));

    // Reset file input so same file can be re-selected
    e.target.value = '';

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('senderId', user._id);
      formData.append('receiverId', selectedUser._id);

      const res = await axios.post(
        `${import.meta.env.VITE_API_URL}/message/upload-image`,
        formData,
        { withCredentials: true, headers: { 'Content-Type': 'multipart/form-data' } }
      );

      const { imageUrl } = res.data;

      // Replace optimistic blob URL with real Cloudinary URL
      setMessages(prev => prev.map(msg => 
        msg._tempId === tempId 
          ? { ...msg, imageUrl, isUploading: false, _tempId: undefined }
          : msg
      ));

      // Revoke blob URL to free memory
      URL.revokeObjectURL(previewUrl);
    } catch (err) {
      console.error('Image upload failed:', err);
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(msg => msg._tempId !== tempId));
      URL.revokeObjectURL(previewUrl);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/user/logout`, {}, {
        withCredentials: true
      });
      logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout failed:', error);
      logout();
      navigate('/login');
    }
  };

  const toggleSelectionMode = () => {
    setSelectionMode(v => !v);
    setSelectedChats(new Set());
  };

  const toggleChatSelection = (userId) => {
    setSelectedChats(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleDeleteChats = async () => {
    if (!user || selectedChats.size === 0) return;
    const ids = [...selectedChats];

    // Optimistic UI update — remove immediately so the user sees instant feedback
    setSidebarUsers(prev => prev.filter(u => !ids.includes(u._id)));
    if (selectedUser && ids.includes(selectedUser._id)) {
      setSelectedUser(null);
      setMessages([]);
    }
    setSelectedChats(new Set());
    setSelectionMode(false);

    // Fire API calls in background — if they fail the page data is stale but UX is snappy
    try {
      await Promise.allSettled(
        ids.map(otherId =>
          axios.delete(
            `${import.meta.env.VITE_API_URL}/conversation/by-participants`,
            { params: { userId: user._id, otherId }, withCredentials: true }
          )
        )
      );
    } catch (err) {
      console.error('Delete chats failed:', err);
    }
  };

  const exitMsgSelection = () => {
    setMsgSelectionMode(false);
    setSelectedMsgs(new Set());
  };

  const enterMsgSelectionWith = (msgId) => {
    setMsgSelectionMode(true);
    setSelectedMsgs(new Set([msgId]));
  };

  const toggleMsgSelection = (msgId) => {
    setSelectedMsgs(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      return next;
    });
  };

  // Delete for me — adds userId to message's deletedFor array; other user still sees it
  const handleDeleteForMe = async (explicitIds) => {
    const ids = explicitIds
      ? (Array.isArray(explicitIds) ? explicitIds : [explicitIds])
      : [...selectedMsgs].filter(id => id && id !== 'null');
    if (!user || ids.length === 0) { exitMsgSelection(); return; }

    // Optimistic: remove from local view + update sidebar last message
    const idsSet = new Set(ids.map(String));
    const remaining = messages.filter(m => !m._id || !idsSet.has(String(m._id)));
    const lastRemaining = remaining.filter(m => m._id).slice(-1)[0];
    setMessages(remaining);
    if (selectedUser) {
      setSidebarUsers(prev => prev.map(u =>
        u._id === selectedUser._id
          ? { ...u, lastMessage: lastRemaining ? (lastRemaining.type === 'image' ? '📷 Photo' : lastRemaining.text) : '' }
          : u
      ));
    }
    exitMsgSelection();

    // Persist to server in background
    try {
      await axios.patch(`${import.meta.env.VITE_API_URL}/message/delete-for-me`, {
        messageIds: ids, userId: user._id
      }, { withCredentials: true });
    } catch (err) {
      console.error('Delete for me failed:', err);
    }
  };

  const handleDeleteMessages = async () => {
    if (!user || !selectedUser || selectedMsgs.size === 0) return;
    // Only include messages that have a real DB _id (exclude pending optimistic ones)
    const messageIds = [...selectedMsgs].filter(id => id && id !== 'null');
    if (messageIds.length === 0) { exitMsgSelection(); return; }

    // Compute remaining messages directly from current state (messages is always fresh at call time)
    const idsSet = new Set(messageIds.map(String));
    const remaining = messages.filter(m => !m._id || !idsSet.has(String(m._id)));
    const lastRemaining = remaining.filter(m => m._id).slice(-1)[0];

    // Update messages and sidebar cleanly as two separate state calls (never nest setState)
    setMessages(remaining);
    setSidebarUsers(prev => prev.map(u =>
      u._id === selectedUser._id
        ? {
            ...u,
            lastMessage: lastRemaining
              ? (lastRemaining.type === 'image' ? '📷 Photo' : lastRemaining.text)
              : ''
          }
        : u
    ));
    exitMsgSelection();

    // Fire API in background
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/message/messages`, {
        data: { messageIds, deletedBy: user._id, otherId: selectedUser._id },
        withCredentials: true
      });
    } catch (err) {
      console.error('Delete messages failed:', err);
      // On failure, reload messages from server to restore correct state
      if (user && selectedUser) {
        axios.get(`${import.meta.env.VITE_API_URL}/message/messages/${selectedUser._id}`, {
          params: { userId: user._id },
          withCredentials: true
        }).then(res => {
          const formatted = res.data.map(msg => ({
            _id: msg._id,
            text: msg.message,
            type: msg.messageType || 'text',
            imageUrl: msg.imageUrl || null,
            sender: msg.sender === user._id ? 'me' : 'them',
            timestamp: new Date(msg.createdAt),
            isRead: msg.isRead || false
          }));
          setMessages(formatted);
        }).catch(() => {});
      }
    }
  };

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen);
  };

  const handleEmojiClick = (e) => {
    e.stopPropagation(); // Prevent event bubbling
    console.log("Emoji button clicked! Current state:", showEmojiPicker);
    setShowEmojiPicker(!showEmojiPicker);
  };

  const onEmojiClick = (emojiObject) => {
    setMessageInput(prev => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showEmojiPicker]);
  

     const onAccept = () => {
            if (!incomingCaller) return;
            setCallComming(false);
            setCallConnected(true);
            socket.emit("call-accepted", {
              from: user._id,
              to: incomingCaller._id
            });
            // answerCall is triggered when the webrtc-offer arrives (see listener above)
          }

     const onDecline = () => {
            if (!incomingCaller) return; // null-guard
            setCallComming(false);
            setIncomingCaller(null);
            socket.emit("call-declined", {
              from: user._id,
              to: incomingCaller._id
            });
          }

  // Format sidebar timestamp
  const formatTime = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="home-container">
      {/* Voice Call Overlay */}
      {showMakeCall && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
          <MakeCall
            onClose={() => {
              clearCallTimeout();
              setShowMakeCall(false);
            }}
            selectedUser={selectedUser}
          />
        </div>
      )}

      {/* Incoming Call Popup */}
      {callComming && (
        <CallPopup
          callerName={incomingCaller?.name || 'Unknown'}
          callerAvatar={incomingCaller?.avatar || null}
          onAccept={onAccept}   
          onDecline={onDecline} 
        />
      )}

      {/* Call Connected Screen */}
      {callConnected && (
        <CallConnected
          callerName={incomingCaller?.name || selectedUser?.name}
          callerAvatar={incomingCaller?.avatar || selectedUser?.avatar}
          onHangup={() => {
            const toId = incomingCaller?._id || selectedUser?._id;
            if (toId) socket.emit('end-call', { from: user._id, to: toId, signalData: {} });
            setCallConnected(false);
            setIncomingCaller(null);
            setIncomingOffer(null);
            setCallFromId(null);
            cleanUp();
          }}
          localStream={localStreamRef.current}
          peerRef={peerRef}
        />
      )}
      {/* Hidden audio element for remote peer's voice */}
      <audio id="remote-audio" ref={remoteAudioRef} autoPlay />

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="image-preview-modal" onClick={() => setPreviewImage(null)}>
          <div className="image-preview-content" onClick={e => e.stopPropagation()}>
            <button className="close-preview" onClick={() => setPreviewImage(null)}>✕</button>
            <img src={previewImage} alt="Preview" />
          </div>
        </div>
      )}

      {/* Mobile Overlay */}
      {isSidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}
      
      {/* Sidebar */}
      <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">💬</div>
            <span className="logo-text">ChatApp</span>
          </div>
        </div>

        {/* Current User Profile */}
        <div className="current-user">
          <div className="user-avatar">{user?.name?.charAt(0).toUpperCase() || '👤'}</div>
          <div className="user-info">
            <h3>{user?.name || 'User'}</h3>
            <p className="user-status">
              <span className="status-dot online"></span>
              {user?.username ? `@${user.username}` : 'Online'}
            </p>
          </div>
          <div className="sidebar-actions">
            {/* Theme Toggle */}
            <button
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                /* Sun icon */
                <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                /* Moon icon */
                <svg fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
                </svg>
              )}
            </button>
            {/* Logout */}
            <button className="logout-btn" onClick={handleLogout} title="Logout">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Contact filter */}
        <div className="search-container">
          <svg className="search-icon" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            placeholder="Filter chats..."
            className="search-input"
            value={contactSearch}
            onChange={(e) => setContactSearch(e.target.value)}
          />
        </div>

        {/* Users List */}
        <div className="users-list">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
            <h4 className="list-title" style={{ margin: 0 }}>Messages</h4>
            <div style={{ display: 'flex', gap: '6px' }}>
              {/* Select / Cancel button */}
              <button
                title={selectionMode ? 'Cancel selection' : 'Select chats'}
                onClick={toggleSelectionMode}
                className={`select-mode-btn${selectionMode ? ' active' : ''}`}
              >
                {selectionMode ? 'Cancel' : 'Select'}
              </button>
              {/* New Chat button — hidden while in selection mode */}
              {!selectionMode && (
                <button
                  title="Start new chat"
                  onClick={() => { setShowNewChat(v => !v); setNewChatQuery(''); }}
                  style={{
                    background: showNewChat ? 'var(--accent-subtle)' : 'transparent',
                    border: '1px solid ' + (showNewChat ? 'var(--border-accent)' : 'transparent'),
                    borderRadius: '8px', padding: '5px 9px',
                    cursor: 'pointer', color: showNewChat ? 'var(--accent-primary)' : 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', gap: '4px',
                    fontSize: '12px', fontWeight: 600, transition: 'all 0.15s ease', fontFamily: 'inherit'
                  }}
                >
                  <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  New Chat
                </button>
              )}
            </div>
          </div>

          {/* ── New Chat Search Panel ── */}
          {showNewChat && (
            <div className="new-chat-panel">
              <div className="new-chat-search-wrapper">
                <span className="new-chat-at">@</span>
                <input
                  ref={newChatInputRef}
                  type="text"
                  placeholder="Search by username…"
                  className="new-chat-input"
                  value={newChatQuery}
                  onChange={e => setNewChatQuery(e.target.value)}
                  spellCheck="false"
                  autoComplete="off"
                />
                {newChatQuery && (
                  <button className="new-chat-clear" onClick={() => setNewChatQuery('')}>✕</button>
                )}
              </div>

              <div className="new-chat-results">
                {isSearching && (
                  <div className="new-chat-status">Searching…</div>
                )}
                {!isSearching && newChatQuery && newChatResults.length === 0 && (
                  <div className="new-chat-status">No users found</div>
                )}
                {!isSearching && newChatResults.map(u => (
                  <div
                    key={u._id}
                    className="new-chat-result-item"
                    onClick={() => {
                      setSelectedUser(u);
                      setMessages([]);
                      setShowNewChat(false);
                      setNewChatQuery('');
                      setIsSidebarOpen(false);
                    }}
                  >
                    <div className="user-avatar-container">
                      <div className="user-avatar">{u.avatar || u.name?.charAt(0).toUpperCase() || '?'}</div>
                      {u.isOnline && <span className="online-indicator"></span>}
                    </div>
                    <div className="user-details">
                      <h5>{u.name}</h5>
                      <p className="last-message">@{u.username}</p>
                    </div>
                    <svg width="14" height="14" fill="none" stroke="#818cf8" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Existing contacts ── */}
          {sidebarUsers.filter(su => su.name?.toLowerCase().includes(contactSearch.toLowerCase()) || su.username?.toLowerCase().includes(contactSearch.toLowerCase())).map(u => (
            <div
              key={u._id}
              className={`user-item${selectedUser?._id === u._id && !selectionMode ? ' active' : ''}${selectionMode ? ' selectable' : ''}${selectedChats.has(u._id) ? ' selected-chat' : ''}`}
              onClick={() => {
                if (selectionMode) {
                  toggleChatSelection(u._id);
                } else {
                  setSelectedUser(u);
                  setMessages([]);
                  setIsSidebarOpen(false);
                }
              }}
            >
              {/* Checkbox shown only in selection mode */}
              {selectionMode && (
                <div className={`chat-checkbox${selectedChats.has(u._id) ? ' checked' : ''}`}>
                  {selectedChats.has(u._id) && (
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2,6 5,9 10,3"/>
                    </svg>
                  )}
                </div>
              )}
              <div className="user-avatar-container">
                <div className="user-avatar">{u.avatar || u.name?.charAt(0).toUpperCase() || '?'}</div>
                {u.isOnline && !selectionMode && <span className="online-indicator"></span>}
              </div>
              <div className="user-details">
                <h5>{u.name}</h5>
                <p className="last-message">
                  {u.lastMessage ? u.lastMessage : (u.isOnline ? '🟢 Online' : `@${u.username || ''}`)}
                </p>
              </div>
              {!selectionMode && (
                <div className="message-meta">
                  <span className="message-time">{u.lastMessageTime ? formatTime(u.lastMessageTime) : ''}</span>
                  {u.noofUnreadMessages > 0 && (
                    <span className="unread-badge">{u.noofUnreadMessages}</span>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* ── Delete action bar ── */}
          {selectionMode && selectedChats.size > 0 && (
            <div className="delete-action-bar">
              <span className="delete-count">{selectedChats.size} selected</span>
              <button className="delete-chats-btn" onClick={handleDeleteChats}>
                <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14H6L5 6"/>
                  <path d="M10 11v6M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
                Delete
              </button>
            </div>
          )}

          {sidebarUsers.length === 0 && !showNewChat && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: '#4b5563' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>💬</div>
              <p style={{ fontSize: '14px', marginBottom: '6px', color: '#6b7280' }}>No chats yet</p>
              <p style={{ fontSize: '12px', color: '#4b5563' }}>Click <strong>New Chat</strong> to find someone</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-area">
        {selectedUser ? (
          <>
            {/* Chat Header — shows selection toolbar when in msgSelectionMode */}
            <div className="chat-header">
              {msgSelectionMode ? (
                <div className="msg-selection-toolbar">
                  <button className="msg-sel-cancel" onClick={exitMsgSelection} title="Cancel">
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    Cancel
                  </button>
                  <span className="msg-sel-count">
                    {selectedMsgs.size} selected
                  </span>
                  <div className="msg-sel-actions">
                    {/* Delete for me — always available */}
                    <button
                      className="msg-sel-delete for-me"
                      onClick={() => handleDeleteForMe()}
                      disabled={selectedMsgs.size === 0}
                      title="Delete for me"
                    >
                      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                      </svg>
                      For Me
                    </button>
                    {/* Delete for everyone — only when at least one OWN message is selected */}
                    {[...selectedMsgs].some(id => messages.find(m => String(m._id) === String(id) && m.sender === 'me')) && (
                      <button
                        className="msg-sel-delete for-everyone"
                        onClick={() => handleDeleteMessages()}
                        disabled={selectedMsgs.size === 0}
                        title="Delete for everyone"
                      >
                        <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                        </svg>
                        Everyone
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* ── Normal header ── */
                <>
                  <button className="mobile-menu-btn" onClick={toggleSidebar}>
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  <div className="chat-user-info">
                    <div className="user-avatar-container">
                      <div className="user-avatar large">{selectedUser.avatar || selectedUser.name?.charAt(0).toUpperCase() || '?'}</div>
                      {selectedUser.isOnline && <span className="online-indicator"></span>}
                    </div>
                    <div>
                      <h3>{selectedUser.name}</h3>
                      <p className="user-status-text">
                        {selectedUser.isOnline ? 'Active now' : 'Offline'}
                      </p>
                    </div>
                  </div>
                  <div className="chat-actions">
                    <button className="action-btn" title="Voice Call" onClick={() => { setShowMakeCall(true); startCallTimeout(() => setShowMakeCall(false)); }}>
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                      </svg>
                    </button>
                    <button className="action-btn" title="Video Call">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                      </svg>
                    </button>
                    <button className="action-btn" title="More Options">
                      <svg fill="currentColor" viewBox="0 0 20 20">
                        <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Messages */}
            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="no-messages">
                  <div className="no-messages-icon">💬</div>
                  <h3>No messages yet</h3>
                  <p>Send a message to start the conversation</p>
                </div>
              ) : (
              messages.map((msg, idx) => (
                  <div
                    key={msg._id || msg._tempId || idx}
                    className={`message ${msg.sender}${msgSelectionMode ? ' msg-selectable' : ''}${selectedMsgs.has(msg._id) ? ' msg-selected' : ''}`}
                    onClick={() => {
                      if (msgSelectionMode && msg._id) toggleMsgSelection(msg._id);
                    }}
                  >
                    {/* Checkbox in selection mode (only left side = 'them' msgs shown on left; we show on correct side) */}
                    {msgSelectionMode && msg._id && (
                      <div className={`msg-checkbox${selectedMsgs.has(msg._id) ? ' checked' : ''}`}>
                        {selectedMsgs.has(msg._id) && (
                          <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="2,6 5,9 10,3"/>
                          </svg>
                        )}
                      </div>
                    )}
                    <div className="message-bubble-wrapper">
                      {/* ⋮ context button — shown on hover for ALL messages with a real _id */}
                      {!msgSelectionMode && msg._id && (
                        <button
                          className="msg-context-btn"
                          title={msg.sender === 'me' ? 'Message options' : 'Delete for me'}
                          onClick={e => {
                            e.stopPropagation();
                            if (msg.sender === 'me') {
                              // Own message: enter selection mode so user picks delete type in toolbar
                              enterMsgSelectionWith(msg._id);
                            } else {
                              // Received message: enter selection mode (toolbar shows only "For Me")
                              enterMsgSelectionWith(msg._id);
                            }
                          }}
                        >
                          ⋮
                        </button>
                      )}
                      <div className="message-bubble">
                        {msg.type === 'image' ? (
                          <div className="message-image-wrapper">
                            <img
                              src={msg.imageUrl}
                              alt="Sent image"
                              className={`message-image ${msg.isUploading ? 'uploading' : ''}`}
                              onClick={() => !msgSelectionMode && setPreviewImage(msg.imageUrl)}
                            />
                            {msg.isUploading && <div className="image-upload-overlay"><span className="uploading-spinner large" /></div>}
                          </div>
                        ) : (
                          <p>{msg.text}</p>
                        )}
                        <span className="message-time">
                          {msg.sender === 'me' && (
                            <span className={`read-receipt ${msg.isRead ? 'read' : 'unread'}`}>
                              {msg.isRead ? '✓✓' : '✓'}
                            </span>
                          )}
                          {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
              {/* Typing indicator */}
              {selectedUser && typingUsers[selectedUser._id] && (
                <div className="typing-indicator">
                  <span>{selectedUser.name} is typing</span>
                  <div className="typing-dots">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="message-input-wrapper">
              {showEmojiPicker && (
                <div ref={emojiPickerRef} className="emoji-picker-container">
                  <EmojiPicker onEmojiClick={onEmojiClick} />
                </div>
              )}
              <form className="message-input-container" onSubmit={handleSendMessage}>
                <button 
                  type="button" 
                  className="attachment-btn" 
                  title="Attach Image"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={isUploadingImage}
                >
                  {isUploadingImage ? (
                    <span className="uploading-spinner" />
                  ) : (
                    <svg fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageUpload}
                />
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => {
                    setMessageInput(e.target.value);
                    if (socket && selectedUser) {
                      socket.emit('typing', { to: selectedUser._id });
                      clearTimeout(typingTimeoutRef.current);
                      typingTimeoutRef.current = setTimeout(() => {
                        socket.emit('stop-typing', { to: selectedUser._id });
                      }, 1500);
                    }
                  }}
                  className="message-input"
                />
                <button type="button" className="emoji-btn" title="Add Emoji" onClick={handleEmojiClick}>
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a1 1 0 10-1.415-1.414 3 3 0 01-4.242 0 1 1 0 00-1.415 1.414 5 5 0 007.072 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <button type="submit" className="send-btn" disabled={!messageInput.trim()}>
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            <button className="mobile-menu-btn" onClick={toggleSidebar} style={{ position: 'absolute', top: '20px', left: '20px' }}>
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="no-chat-icon">💬</div>
            <h2>Welcome to ChatApp</h2>
            <p>Select a user from the sidebar to start chatting</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;