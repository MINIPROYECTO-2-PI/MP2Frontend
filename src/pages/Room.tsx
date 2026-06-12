import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  connectSocket,
  disconnectSocket,
  type Socket,
} from "../services/socket";
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
} from "react-icons/lu";

const RTC_CONFIG = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

interface ChatMessage {
  id: string;
  senderUid: string;
  senderUsername: string;
  text: string;
  createdAt: string | Date;
}

interface ActiveUser {
  socketId: string;
  username: string;
  uid: string;
}

// ─── Video remoto ─────────────────────────────────────────────────────────────
const RemoteVideo: React.FC<{
  peerId: string;
  stream: MediaStream;
  username: string;
}> = ({ peerId, stream, username }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasVideo, setHasVideo] = useState(false);

  useEffect(() => {
    if (!videoRef.current) return;
    videoRef.current.srcObject = stream;

    const checkVideo = () => {
      const hasTracks = stream
        .getVideoTracks()
        .some((t) => t.enabled && t.readyState === "live");
      setHasVideo(hasTracks);
    };

    checkVideo();
    stream.onaddtrack = checkVideo;
    stream.onremovetrack = checkVideo;

    return () => {
      stream.onaddtrack = null;
      stream.onremovetrack = null;
    };
  }, [stream]);

  return (
    <div className="room-video-card">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`room-video-feed ${hasVideo ? "" : "room-video-feed--hidden"}`}
      />
      {!hasVideo && (
        <div className="room-video-placeholder">
          <div className="room-video-avatar-fallback">
            {username ? username.charAt(0).toUpperCase() : <LuUser size={40} />}
          </div>
          <span className="room-video-name">@{username}</span>
          <span className="room-status-sub">Cámara Apagada</span>
        </div>
      )}
      <div className="room-participant-labels">
        <span className="participant-badge-name">
          @{username} ({peerId.substring(0, 5)})
        </span>
      </div>
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
const Room: React.FC = () => {
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [roomName, setRoomName] = useState("");
  const [hostUid, setHostUid] = useState("");
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isVideoOn, setIsVideoOn] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [copied, setCopied] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(
    new Map(),
  );
  // ✅ useState en lugar de useRef para poder leerlo en el render
  const [remoteUsernames, setRemoteUsernames] = useState<Map<string, string>>(
    new Map(),
  );

  // ── 1. Permisos de media con fallback ─────────────────────────────────────
  useEffect(() => {
    const initMedia = async () => {
      let stream: MediaStream | null = null;
      const constraints = [
        { video: true, audio: true },
        { video: false, audio: true },
        { video: true, audio: false },
      ];

      for (const c of constraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(c);
          break;
        } catch (e) {
          console.warn("Intento fallido con", c, e);
        }
      }

      if (stream) {
        localStreamRef.current = stream;
        setLocalStream(stream);
        stream.getVideoTracks().forEach((t) => (t.enabled = false));
        stream.getAudioTracks().forEach((t) => (t.enabled = false));
      } else {
        console.error("No se pudo obtener ningún dispositivo de media");
      }
    };

    initMedia();
  }, []);

  // ── 2. Asignar stream local al <video> ────────────────────────────────────
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, loading, isValidating]);

  // ── 3. Crear RTCPeerConnection ─────────────────────────────────────────────
  const createPeerConnection = (remotePeerId: string): RTCPeerConnection => {
    if (peerConnectionsRef.current.has(remotePeerId)) {
      peerConnectionsRef.current.get(remotePeerId)!.close();
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("signal", remotePeerId, socketRef.current.id, {
          type: "candidate",
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (!remoteStream) return;
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.set(remotePeerId, remoteStream);
        return next;
      });
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log(`[ICE ${remotePeerId.substring(0, 5)}]:`, state);
      if (
        state === "disconnected" ||
        state === "closed" ||
        state === "failed"
      ) {
        pc.close();
        peerConnectionsRef.current.delete(remotePeerId);
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(remotePeerId);
          return next;
        });
      }
    };

    peerConnectionsRef.current.set(remotePeerId, pc);
    return pc;
  };

  // ── 4. Conexión socket + lógica WebRTC ────────────────────────────────────
  useEffect(() => {
    if (!roomId || !user) {
      navigate("/dashboard");
      return;
    }

    const socket = connectSocket();
    socketRef.current = socket;

    const handleSignal = async (
      _to: string,
      from: string,
      data: RTCSessionDescriptionInit & { candidate?: RTCIceCandidateInit },
    ) => {
      if (from === socket.id) return;

      let pc = peerConnectionsRef.current.get(from);
      if (!pc) pc = createPeerConnection(from);

      try {
        if (data.type === "offer") {
          if (
            pc.signalingState === "stable" ||
            pc.signalingState === "have-remote-offer"
          ) {
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("signal", from, socket.id, answer);
          } else {
            console.warn(`[offer] Estado inesperado: ${pc.signalingState}`);
          }
        } else if (data.type === "answer") {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(data));
          } else {
            console.warn(`[answer] Estado inesperado: ${pc.signalingState}`);
          }
        } else if (data.candidate) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
        }
      } catch (err) {
        console.error(`[handleSignal] Error con peer ${from}:`, err);
      }
    };

    const handleNewPeer = (data: {
      peerId: string;
      username: string;
      uid: string;
      activeUsers: ActiveUser[];
    }) => {
      const { peerId, username } = data;
      if (peerId === socket.id) return;

      // Guardar username y actualizar lista
      setRemoteUsernames((prev) => new Map(prev).set(peerId, username));
      setActiveUsers(data.activeUsers);

      // Solo crear el PC — NO enviar offer.
      // El nuevo peer (room-joined-success) es quien envía el offer,
      // y nosotros lo recibiremos en handleSignal en estado "stable".
      createPeerConnection(peerId);
    };

    const handleUserDisconnected = (peerId: string) => {
      const pc = peerConnectionsRef.current.get(peerId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(peerId);
      }
      // ✅ useState para usernames remotos
      setRemoteUsernames((prev) => {
        const next = new Map(prev);
        next.delete(peerId);
        return next;
      });
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.delete(peerId);
        return next;
      });
    };

    socket.on("signal", handleSignal);
    socket.on("new-peer-joined", handleNewPeer);
    socket.on("userDisconnected", handleUserDisconnected);

    socket.emit("join-room", {
      roomId,
      username: user.username || user.displayName || "Estudiante",
      uid: user.uid,
    });

    socket.on("delete-room", (data: { roomId: string; message: string }) => {
      alert(data.message);
      navigate("/dashboard");
    });

    socket.on(
      "room-joined-success",
      async (data: {
        roomId: string;
        roomName: string;
        hostUid: string;
        activeUsers: ActiveUser[];
        mySocketId: string;
      }) => {
        setRoomName(data.roomName);
        setHostUid(data.hostUid);
        setActiveUsers(data.activeUsers);
        setIsValidating(false);
        setLoading(false);

        const peersAlreadyInRoom = data.activeUsers.filter(
          (u) => u.socketId && u.socketId !== data.mySocketId,
        );

        for (const existingUser of peersAlreadyInRoom) {
          // ✅ useState para usernames remotos
          setRemoteUsernames((prev) =>
            new Map(prev).set(existingUser.socketId, existingUser.username),
          );
          try {
            const pc = createPeerConnection(existingUser.socketId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("signal", existingUser.socketId, socket.id, offer);
          } catch (err) {
            console.error(
              `[room-joined] Error creando offer para ${existingUser.socketId}:`,
              err,
            );
          }
        }
      },
    );

    socket.on("room-invalid", (msg: string) => {
      setErrorMsg(msg);
      setIsValidating(false);
      setLoading(false);
    });

    socket.on("error-msg", (msg: string) => setErrorMsg(msg));
    socket.on("room-history", (history: ChatMessage[]) => setMessages(history));

    socket.on(
      "user-joined",
      (data: { username: string; uid: string; activeUsers: ActiveUser[] }) => {
        setActiveUsers(data.activeUsers);
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            senderUid: "system",
            senderUsername: "Sistema",
            text: `@${data.username} se ha unido a la sala`,
            createdAt: new Date(),
          },
        ]);
      },
    );

    socket.on(
      "user-left",
      (data: { username: string; uid: string; activeUsers: ActiveUser[] }) => {
        setActiveUsers(data.activeUsers);
        setMessages((prev) => [
          ...prev,
          {
            id: `sys-${Date.now()}`,
            senderUid: "system",
            senderUsername: "Sistema",
            text: `@${data.username} ha salido de la sala`,
            createdAt: new Date(),
          },
        ]);
      },
    );

    socket.on("receive-message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      setRemoteStreams(new Map());
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;

      socket.off("signal", handleSignal);
      socket.off("new-peer-joined", handleNewPeer);
      socket.off("userDisconnected", handleUserDisconnected);
      socket.off("delete-room");
      socket.off("room-joined-success");
      socket.off("room-invalid");
      socket.off("error-msg");
      socket.off("room-history");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("receive-message");
      disconnectSocket();
    };
  }, [roomId, user, navigate]);

  // ── 5. Auto scroll chat ────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── 6. Controles media ─────────────────────────────────────────────────────
  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsMicOn((prev) => !prev);
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach((t) => {
      t.enabled = !t.enabled;
    });
    setIsVideoOn((prev) => !prev);
  };

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

  // ── Renders de estado ──────────────────────────────────────────────────────
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
          <button
            onClick={() => navigate("/dashboard")}
            className="room-error-btn"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  // ── Render principal ───────────────────────────────────────────────────────
  return (
    <div className="room-page">
      <div className="auth-bg">
        <div className="auth-blob auth-blob--1" />
        <div className="auth-blob auth-blob--2" />
      </div>

      <header className="room-header">
        <div className="room-header-left">
          <div className="room-logo">
            <LuVideo size={20} />
          </div>
          <div className="room-title-wrap">
            <h1 className="room-name-text">{roomName}</h1>
            <div className="room-badge-row">
              <span className="room-id-badge">ID: {roomId}</span>
              <button
                onClick={copyRoomId}
                className="room-copy-btn"
                title="Copiar ID de Sala"
              >
                {copied ? <LuCheck size={14} /> : <LuCopy size={14} />}
              </button>
            </div>
          </div>
        </div>
        <div className="room-header-right">
          <button
            onClick={() => navigate("/dashboard")}
            className="room-leave-btn"
          >
            <LuLogOut size={16} />
            <span>Salir de la Sala</span>
          </button>
        </div>
      </header>

      <div className="room-grid">
        <div className="room-stage">
          <div className="room-video-container">
            {/* ── Video local ──────────────────────────────────────────────── */}
            <div className="room-video-card">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`room-video-feed ${isVideoOn ? "" : "room-video-feed--hidden"}`}
              />
              {!isVideoOn && (
                <div className="room-video-placeholder">
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Tú"
                      className="room-video-avatar"
                    />
                  ) : (
                    <div className="room-video-avatar-fallback">
                      {user?.displayName ? (
                        user.displayName.charAt(0).toUpperCase()
                      ) : (
                        <LuUser size={40} />
                      )}
                    </div>
                  )}
                  <span className="room-video-name">
                    @{user?.username || "tú"} (Tú)
                  </span>
                  <span className="room-status-sub">Cámara Apagada</span>
                </div>
              )}
              <div className="room-participant-labels">
                <span className="participant-badge-name">Tú</span>
                {!isMicOn && (
                  <span className="participant-badge-muted">Silenciado</span>
                )}
              </div>
            </div>

            {/* ── Videos remotos ───────────────────────────────────────────── */}
            {Array.from(remoteUsernames.entries()).map(([peerId, username]) => {
              const stream = remoteStreams.get(peerId);
              if (stream) {
                return (
                  <RemoteVideo
                    key={peerId}
                    peerId={peerId}
                    stream={stream}
                    username={username}
                  />
                );
              }
              return (
                <div key={peerId} className="room-video-card">
                  <div className="room-video-placeholder">
                    <div className="room-video-avatar-fallback">
                      {username.charAt(0).toUpperCase()}
                    </div>
                    <span className="room-video-name">@{username}</span>
                    <span className="room-status-sub">Conectando...</span>
                  </div>
                  <div className="room-participant-labels">
                    <span className="participant-badge-name">
                      @{username} ({peerId.substring(0, 5)})
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Controles ──────────────────────────────────────────────────── */}
          <div className="room-controls-bar">
            <button
              onClick={toggleMic}
              disabled={
                !localStream || localStream.getAudioTracks().length === 0
              }
              className={`room-control-btn ${isMicOn ? "room-control-btn--active" : "room-control-btn--muted"}`}
              title={isMicOn ? "Silenciar Micrófono" : "Activar Micrófono"}
            >
              {isMicOn ? <LuMic size={20} /> : <LuMicOff size={20} />}
              <span>{isMicOn ? "Mic Activo" : "Silenciado"}</span>
            </button>

            <button
              onClick={toggleVideo}
              disabled={
                !localStream || localStream.getVideoTracks().length === 0
              }
              className={`room-control-btn ${isVideoOn ? "room-control-btn--active" : "room-control-btn--muted"}`}
              title={isVideoOn ? "Apagar Cámara" : "Encender Cámara"}
            >
              {isVideoOn ? <LuVideo size={20} /> : <LuVideoOff size={20} />}
              <span>{isVideoOn ? "Cámara Activa" : "Cámara Off"}</span>
            </button>
          </div>
        </div>

        {/* ── Sidebar ────────────────────────────────────────────────────────── */}
        <aside className="room-sidebar">
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
                    {u.uid === hostUid && (
                      <span className="user-item-badge">Anfitrión</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="room-sidebar-section room-chat-section">
            <div className="section-header">
              <LuMessageSquare size={16} />
              <h3>Chat de Grupo</h3>
            </div>
            <div className="chat-messages-container">
              {messages.length === 0 ? (
                <div className="chat-empty-state">
                  <LuMessageSquare size={32} />
                  <p>No hay mensajes. ¡Comienza el debate!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isSystem = msg.senderUid === "system";
                  const isMe = msg.senderUid === user?.uid;

                  if (isSystem) {
                    return (
                      <div key={msg.id} className="chat-msg chat-msg--system">
                        <span>{msg.text}</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`chat-msg ${isMe ? "chat-msg--me" : "chat-msg--other"}`}
                    >
                      {!isMe && (
                        <span className="chat-msg-username">
                          @{msg.senderUsername}
                        </span>
                      )}
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
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="chat-submit-btn"
              >
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
