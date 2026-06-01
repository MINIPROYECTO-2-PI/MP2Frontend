import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { io, Socket } from "socket.io-client";
import {
  LuUsers,
  LuMessageSquare,
  LuSend,
  LuLogOut,
  LuLoaderCircle,
  LuVideo,
  LuVideoOff,
  LuMic,
  LuMicOff,
  LuCopy,
  LuCheck,
  LuUser,
  LuSparkles,
} from "react-icons/lu";

interface ChatMessage {
  id: string;
  senderUid: string;
  senderUsername: string;
  text: string;
  createdAt: string | Date;
}

interface ActiveUser {
  username: string;
  uid: string;
}

const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [roomName, setRoomName] = useState("");
  const [hostUid, setHostUid] = useState("");
  
  // Real-time states
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  
  // UI Controls (Simulated Video/Audio states for premium feel)
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [copied, setCopied] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!roomId || !user) {
      navigate("/dashboard");
      return;
    }

    // Connect to WebSocket server running on port 3001
    const socket = io("http://localhost:3001");
    socketRef.current = socket;

    // Join room event
    socket.emit("join-room", {
      roomId,
      username: user.username || user.displayName || "Estudiante",
      uid: user.uid,
    });

    // 1. Connection successful
    socket.on("room-joined-success", (data: {
      roomId: string;
      roomName: string;
      hostUid: string;
      activeUsers: ActiveUser[];
    }) => {
      setRoomName(data.roomName);
      setHostUid(data.hostUid);
      setActiveUsers(data.activeUsers);
      setIsValidating(false);
      setLoading(false);
    });

    // 2. Room is invalid
    socket.on("room-invalid", (msg: string) => {
      setErrorMsg(msg);
      setIsValidating(false);
      setLoading(false);
    });

    // 3. General error
    socket.on("error-msg", (msg: string) => {
      setErrorMsg(msg);
    });

    // 4. Receives whole room history of messages
    socket.on("room-history", (history: ChatMessage[]) => {
      setMessages(history);
    });

    // 5. Another user joins
    socket.on("user-joined", (data: {
      username: string;
      uid: string;
      activeUsers: ActiveUser[];
    }) => {
      setActiveUsers(data.activeUsers);
      // Append a system message
      const systemMsg: ChatMessage = {
        id: `sys-${Date.now()}`,
        senderUid: "system",
        senderUsername: "MeetClone",
        text: `@${data.username} se ha unido a la sala de estudio`,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, systemMsg]);
    });

    // 6. User leaves
    socket.on("user-left", (data: {
      username: string;
      uid: string;
      activeUsers: ActiveUser[];
    }) => {
      setActiveUsers(data.activeUsers);
      // Append a system message
      const systemMsg: ChatMessage = {
        id: `sys-${Date.now()}`,
        senderUid: "system",
        senderUsername: "MeetClone",
        text: `@${data.username} ha salido de la sala`,
        createdAt: new Date(),
      };
      setMessages((prev) => [...prev, systemMsg]);
    });

    // 7. Receives new text message
    socket.on("receive-message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    // Cleanup on unmount
    return () => {
      socket.disconnect();
    };
  }, [roomId, user, navigate]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !socketRef.current || !roomId || !user) return;

    socketRef.current.emit("send-message", {
      roomId,
      senderUid: user.uid,
      senderUsername: user.username || user.displayName || "Estudiante",
      text: newMessage.trim(),
    });

    setNewMessage("");
  };

  const copyRoomId = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeave = () => {
    navigate("/dashboard");
  };

  if (loading || isValidating) {
    return (
      <div className="room-status-page">
        <div className="auth-bg">
          <div className="auth-blob auth-blob--1" />
          <div className="auth-blob auth-blob--2" />
        </div>
        <div className="room-status-card">
          <LuLoaderCircle className="room-spinner" size={48} />
          <h2>Validando Sala de Estudio...</h2>
          <p>Conectándose al servidor de tiempo real...</p>
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="room-status-page">
        <div className="auth-bg">
          <div className="auth-blob auth-blob--1" />
          <div className="auth-blob auth-blob--2" />
        </div>
        <div className="room-status-card room-status-card--error">
          <LuVideoOff size={48} className="room-error-icon" />
          <h2>Acceso Denegado</h2>
          <p>{errorMsg}</p>
          <button onClick={() => navigate("/dashboard")} className="room-error-btn">
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="room-page">
      <div className="auth-bg">
        <div className="auth-blob auth-blob--1" />
        <div className="auth-blob auth-blob--2" />
      </div>

      {/* Room Header */}
      <header className="room-header">
        <div className="room-header-left">
          <div className="room-logo">
            <LuVideo size={20} />
          </div>
          <div className="room-title-wrap">
            <h1 className="room-name-text">{roomName}</h1>
            <div className="room-badge-row">
              <span className="room-id-badge">ID: {roomId}</span>
              <button onClick={copyRoomId} className="room-copy-btn" title="Copiar ID de Sala">
                {copied ? <LuCheck size={14} /> : <LuCopy size={14} />}
              </button>
            </div>
          </div>
        </div>

        <div className="room-header-right">
          <button onClick={handleLeave} className="room-leave-btn">
            <LuLogOut size={16} />
            <span>Salir de la Sala</span>
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="room-grid">
        {/* Left Side: Video/Collaborative Stage */}
        <div className="room-stage">
          <div className="room-video-container">
            {/* Main Participant (You or simulated speaker) */}
            <div className="room-video-card">
              {isVideoOn ? (
                <div className="room-video-active-feed">
                  {/* Simulated interactive active stream */}
                  <div className="room-avatar-glowing">
                    <LuSparkles size={40} className="glowing-sparkle" />
                  </div>
                  <span className="room-stream-placeholder">Cámara activa (Transmitiendo en tiempo real)</span>
                </div>
              ) : (
                <div className="room-video-placeholder">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Tú" className="room-video-avatar" />
                  ) : (
                    <div className="room-video-avatar-fallback">
                      {user?.displayName ? user.displayName.charAt(0).toUpperCase() : <LuUser size={40} />}
                    </div>
                  )}
                  <span className="room-video-name">@{user?.username || "tú"} (Tú)</span>
                  <span className="room-status-sub">Cámara Apagada</span>
                </div>
              )}

              {/* Status Pills */}
              <div className="room-participant-labels">
                <span className="participant-badge-name">Tú</span>
                {!isMicOn && <span className="participant-badge-muted">Silenciado</span>}
              </div>
            </div>
          </div>

          {/* Interactive Stage Controls */}
          <div className="room-controls-bar">
            <button
              onClick={() => setIsMicOn(!isMicOn)}
              className={`room-control-btn ${isMicOn ? "room-control-btn--active" : "room-control-btn--muted"}`}
              title={isMicOn ? "Silenciar Micrófono" : "Activar Micrófono"}
            >
              {isMicOn ? <LuMic size={20} /> : <LuMicOff size={20} />}
              <span>{isMicOn ? "Mic Activo" : "Silenciado"}</span>
            </button>

            <button
              onClick={() => setIsVideoOn(!isVideoOn)}
              className={`room-control-btn ${isVideoOn ? "room-control-btn--active" : "room-control-btn--muted"}`}
              title={isVideoOn ? "Apagar Cámara" : "Encender Cámara"}
            >
              {isVideoOn ? <LuVideo size={20} /> : <LuVideoOff size={20} />}
              <span>{isVideoOn ? "Cámara Activa" : "Cámara Off"}</span>
            </button>
          </div>
        </div>

        {/* Right Side: Sidebar containing Active Users List & Real-time Chat */}
        <aside className="room-sidebar">
          {/* Active Users Section */}
          <div className="room-sidebar-section room-users-section">
            <div className="section-header">
              <LuUsers size={16} />
              <h3>Participantes ({activeUsers.length})</h3>
            </div>
            <div className="users-list">
              {activeUsers.map((u, i) => (
                <div key={i} className="user-item">
                  <div className="user-item-avatar-wrapper">
                    <div className="user-item-avatar">
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="online-indicator-dot" />
                  </div>
                  <div className="user-item-details">
                    <span className="user-item-name">@{u.username}</span>
                    {u.uid === hostUid && <span className="user-item-badge">Anfitrión</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Real-time Chat Section */}
          <div className="room-sidebar-section room-chat-section">
            <div className="section-header">
              <LuMessageSquare size={16} />
              <h3>Chat de Grupo</h3>
            </div>

            <div className="chat-messages-container">
              {messages.length === 0 ? (
                <div className="chat-empty-state">
                  <LuMessageSquare size={32} />
                  <p>No hay mensajes en este chat. ¡Comienza el debate!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isSystem = msg.senderUid === "system";
                  const isMe = msg.senderUid === user.uid;

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="chat-msg chat-msg--system">
                        <span>{msg.text}</span>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id} className={`chat-msg ${isMe ? "chat-msg--me" : "chat-msg--other"}`}>
                      {!isMe && <span className="chat-msg-username">@{msg.senderUsername}</span>}
                      <div className="chat-msg-bubble">
                        <p>{msg.text}</p>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="chat-input-form">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Escribe un mensaje..."
                className="chat-input-field"
                maxLength={400}
              />
              <button type="submit" disabled={!newMessage.trim()} className="chat-submit-btn">
                <LuSend size={16} />
              </button>
            </form>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default Room;
