import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import axios from 'axios';
import './Home.css';
import SocketContext from '../context/SocketContext';
import EmojiPicker from 'emoji-picker-react';

const Home = () => {
  const navigate = useNavigate();
  const { user, logout } = useContext(AuthContext);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState('');
  const messagesEndRef = useRef(null);
  const [conversations, setConversations] = useState([]);
  const [sidebarUsers, setSidebarUsers] = useState([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);


  

 const socket = useContext(SocketContext)

 useEffect(()=>{
  if(selectedUser && user){
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
      // Only update if you're currently viewing the chat with the person who read your messages
      if(selectedUser && selectedUser._id === readBy){
        // Update YOUR sent messages to show double tick
        setMessages(prev => prev.map(msg => 
          msg.sender === 'me' ? {...msg, isRead: true} : msg
        ));
      }
    })
    return ()=>socket.off("messages-marked-read");
  },[socket, selectedUser])

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(()=>{
    if(!socket || !user || users.length === 0) return; // ✅ Wait for users to load
    
    // Fetch conversations for current user
    axios.get(`${import.meta.env.VITE_API_URL}/conversation/conversations/${user._id}`,{
      withCredentials:true
    }).then((res)=>{
      console.log(res.data);
     
      let sidebarUsers = users.map(u => {
          const conv = res.data.find(conversation => conversation.participants.includes(u._id));
          if(conv){
            // Extract the current user's unread count from the Map
            const unreadCount = conv.unreadCount?.[user._id] || 0;
            return {
              ...u,
              lastMessage: conv.lastMessage,
              noofUnreadMessages: unreadCount
            }
          }
          else{
            return u
          }
      })
      setSidebarUsers(sidebarUsers);
    }).catch((err)=>{
      console.log(err);
      setConversations([]); // Set empty array on error
    })
  }, [socket, user, users]) // ✅ Added users to dependencies

  useEffect(()=>{
    if(!socket || !selectedUser || !user) return;
    
    // Fetch messages between current user and selected user
    axios.get(`${import.meta.env.VITE_API_URL}/message/messages/${selectedUser._id}`,{
      params: { userId: user._id },
      withCredentials:true
    }).then((res)=>{
      // Transform messages to match UI format
      const formattedMessages = res.data.map(msg => ({
        text: msg.message,
        sender: msg.sender === user._id ? 'me' : 'them',
        timestamp: new Date(msg.createdAt),
        isRead: msg.isRead || false
      }));
      console.log(formattedMessages);
      setMessages(formattedMessages);
    }).catch((err)=>{
      console.log(err);
      setMessages([]); // Set empty array on error
    })  
   
  },[selectedUser, socket, user])

  // Mock users data - Replace with actual API call
  useEffect(() => {
    axios.get(`${import.meta.env.VITE_API_URL}/user/users`,{
      withCredentials:true
    }).then((res)=>{
      setUsers(res.data.users.filter(u => u._id !== user._id));
    }).catch((err)=>{
      console.log(err);
    })
  }, []);

  useEffect(()=>{
    if(!socket) return;
    socket.on("user-joined",(newUser)=>{
      console.log("User joined:",newUser);
      setUsers(prev=>[...prev,newUser]);
    })
    return ()=>socket.off("user-joined");
  }, [socket])

  useEffect(()=>{
    if(!socket) return;
    socket.on("user-online",({userId,isOnline})=>{
      console.log("User online:",userId,isOnline);
      // Update the users array to reflect online status
      setUsers(prev => prev.map(u => 
        u._id === userId ? {...u, isOnline} : u
      ));
    })
    return ()=>socket.off("user-online");
  }, [socket])

  useEffect(()=>{
    if(!socket) return;
    socket.on("user-offline",({userId,isOnline})=>{
      console.log("User offline:",userId,isOnline);
      // Update the users array to reflect offline status
      setUsers(prev => prev.map(u => 
        u._id === userId ? {...u, isOnline} : u
      ));
    })
    return ()=>socket.off("user-offline");
  }, [socket])

  useEffect(()=>{
    if(!socket) return;
    socket.on("receive",({sender,msg})=>{
      console.log("Received message from:",sender,"Message:",msg);
      if(selectedUser && sender === selectedUser._id){
        const newMessage = {
          text:msg,
          sender:'them',
          timestamp:new Date(),
          isRead: false
        };
        setMessages(prev=>[...prev,newMessage]);
        
        // INSTANT READ: Since chat is already open, mark as read immediately
        if(user && socket){
          socket.emit("all-read", {
            currentUserId: user._id,
            selectedUserId: sender
          });
        }
        
        // Update last message in sidebar
        setSidebarUsers(prev => prev.map(u => 
          u._id === sender 
            ? {...u, lastMessage: msg}
            : u
        ));
      } else {
        // Update unread count AND last message in sidebar for the sender
        setSidebarUsers(prev => prev.map(u => 
          u._id === sender 
            ? {...u, noofUnreadMessages: (u.noofUnreadMessages || 0) + 1, lastMessage: msg}
            : u
        ));
      }
    })
    return ()=>socket.off("receive");
  },[socket,selectedUser,user])  

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!messageInput.trim() || !selectedUser || !socket) return;

    const newMessage = {
      text: messageInput,
      sender: 'me',
      timestamp: new Date(),
      isRead: false
    };

    // Add to local messages
    setMessages(prev => [...prev, newMessage]);

    // Update last message in sidebar for selected user
    setSidebarUsers(prev => prev.map(u => 
      u._id === selectedUser._id 
        ? {...u, lastMessage: messageInput}
        : u
    ));

    // Send via socket
    socket.emit('message', { recId: selectedUser._id, msg: messageInput });

    setMessageInput('');
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

  return (
    <div className="home-container">
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
              Online
            </p>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Logout">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>

        {/* Search Bar */}
        <div className="search-container">
          <svg className="search-icon" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input type="text" placeholder="Search users..." className="search-input" />
        </div>

        {/* Users List */}
        <div className="users-list">
          <h4 className="list-title">Messages</h4>
          {sidebarUsers.map(user => (
            <div
              key={user._id}
              className={`user-item ${selectedUser?._id === user._id ? 'active' : ''}`}
              onClick={() => {
                setSelectedUser(user);
                setMessages([]);
                setIsSidebarOpen(false); // Close sidebar on mobile after selecting user
              }}
            >
              <div className="user-avatar-container">
                <div className="user-avatar">{user.avatar}</div>
                {user.isOnline && <span className="online-indicator"></span>}
              </div>
              <div className="user-details">
                <h5>{user.name}</h5>
                <p className="last-message">
                  {user.lastMessage ? user.lastMessage : (user.isOnline ? 'Online' : 'Offline')}
                </p>
              </div>
              <div className="message-meta">
                <span className="message-time">12:45</span>
                {user.noofUnreadMessages > 0 && (
                  <span className="unread-badge">{user.noofUnreadMessages}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="chat-area">
        {selectedUser ? (
          <>
            {/* Chat Header */}
            <div className="chat-header">
              <button className="mobile-menu-btn" onClick={toggleSidebar}>
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="chat-user-info">
                <div className="user-avatar-container">
                  <div className="user-avatar large">{selectedUser.avatar}</div>
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
                <button className="action-btn" title="Voice Call">
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
                  <div key={idx} className={`message ${msg.sender}`}>
                    <div className="message-bubble">
                      <p>{msg.text}</p>
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
                ))
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
                <button type="button" className="attachment-btn" title="Attach File">
                  <svg fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                  </svg>
                </button>
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
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