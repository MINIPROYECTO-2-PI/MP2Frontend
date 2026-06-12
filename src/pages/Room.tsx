import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  connectSocket,
  disconnectSocket,
  type Socket,
} from "../services/socket";

const configuration = {
  iceServers: [
    {
      urls: ["stun:stun1.l.google.com:19302", "stun:stun2.l.google.com:19302"],
    },
  ],
  iceCandidatePoolSize: 10,
};

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

interface RemoteVideoProps {
  peerId: string;
  stream: MediaStream;
}

const RemoteVideo: React.FC<RemoteVideoProps> = ({ peerId, stream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="room-video-card">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="room-video-feed"
      />
      <div className="room-participant-labels">
        <span className="participant-badge-name">Participante ({peerId.substring(0, 5)})</span>
      </div>
    </div>
  );
};

const Room: React.FC = () => {
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);

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
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());

  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // 1. Pedir permisos y guardar stream local con fallback robusto
  useEffect(() => {
    const handlePermissions = async () => {
      let stream: MediaStream | null = null;
      try {
        // Intentar obtener ambos video y audio
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
      } catch (error) {
        console.warn("No se pudo obtener cámara y micrófono a la vez, probando solo micrófono...", error);
        try {
          // Intentar obtener solo audio
          stream = await navigator.mediaDevices.getUserMedia({
            video: false,
            audio: true,
          });
        } catch (audioError) {
          console.warn("No se pudo obtener micrófono, probando solo cámara...", audioError);
          try {
            // Intentar obtener solo video
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false,
            });
          } catch (videoError) {
            console.error("No se encontraron dispositivos de audio ni video o los permisos fueron denegados:", videoError);
          }
        }
      }

      if (stream) {
        localStreamRef.current = stream;
        setLocalStream(stream);
        // Empezar con tracks desactivados hasta que el usuario los encienda
        stream.getVideoTracks().forEach((t) => (t.enabled = false));
        stream.getAudioTracks().forEach((t) => (t.enabled = false));
      }
    };
    handlePermissions();
  }, []);

  // 2. Asignar el stream local al elemento de video cuando este se renderice
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, loading, isValidating]);

  // 3. Crear RTCPeerConnection para un peer remoto
  const createPeerConnection = (remotePeerId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection(configuration);

    // Añadir tracks locales al peer connection si están disponibles
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Enviar ICE candidates al peer remoto via socket
    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit("signal", remotePeerId, socketRef.current.id, {
          type: "candidate",
          candidate: event.candidate,
        });
      }
    };

    // Cuando llega el stream remoto, agregarlo a nuestro estado de remoteStreams
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.set(remotePeerId, remoteStream);
        return next;
      });
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`ICE state [${remotePeerId}]:`, pc.iceConnectionState);
      if (
        pc.iceConnectionState === "disconnected" ||
        pc.iceConnectionState === "closed" ||
        pc.iceConnectionState === "failed"
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

  // 4. Conexión principal al socket, sala y control de WebRTC
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
      if (from === socket.id) return; // Ignorar señales a uno mismo

      let pc = peerConnectionsRef.current.get(from);
      if (!pc) pc = createPeerConnection(from);

      try {
        if (data.type === "offer") {
          if (pc.signalingState === "stable" || pc.signalingState === "have-remote-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(data));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("signal", from, socket.id, answer);
          } else {
            console.warn(`Se recibió 'offer' de ${from} pero el estado actual es ${pc.signalingState}. Ignorando.`);
          }
        } else if (data.type === "answer") {
          if (pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(data));
          } else {
            console.warn(`Se recibió 'answer' de ${from} pero el estado actual es ${pc.signalingState}. Ignorando.`);
          }
        } else if (data.candidate) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
        }
      } catch (err) {
        console.error(`Error en handleSignal de ${from}:`, err);
      }
    };

    const handleNewUser = async (newPeerId: string) => {
      if (newPeerId === socket.id) return;
      if (peerConnectionsRef.current.has(newPeerId)) return;

      const pc = createPeerConnection(newPeerId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("signal", newPeerId, socket.id, offer);
      } catch (err) {
        console.error(`Error al crear oferta para ${newPeerId}:`, err);
      }
    };

    const handleUserDisconnected = (peerId: string) => {
      const pc = peerConnectionsRef.current.get(peerId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(peerId);
        setRemoteStreams((prev) => {
          const next = new Map(prev);
          next.delete(peerId);
          return next;
        });
      }
    };

    socket.on("signal", handleSignal);
    socket.on("newUserConnected", handleNewUser);
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
      (data: {
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

        const currentSocketId = socket.id;
        data.activeUsers
          .filter((u) => u.socketId && u.socketId !== currentSocketId)
          .forEach(async (user) => {
            try {
              const pc = createPeerConnection(user.socketId);
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              socket.emit("signal", user.socketId, socket.id, offer);
            } catch (err) {
              console.error(`Error creando oferta para ${user.socketId}:`, err);
            }
          });
      },
    );

    socket.on("room-invalid", (msg: string) => {
      setErrorMsg(msg);
      setIsValidating(false);
      setLoading(false);
    });

    socket.on("error-msg", (msg: string) => {
      setErrorMsg(msg);
    });

    socket.on("room-history", (history: ChatMessage[]) => {
      setMessages(history);
    });

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
      // Cerrar todos los peer connections al salir
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      setRemoteStreams(new Map());

      // Detener tracks locales
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;

      socket.off("signal", handleSignal);
      socket.off("newUserConnected", handleNewUser);
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

  // 5. Auto scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 6. Controles reales de mic y video
  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !track.enabled;
    });
    setIsMicOn((prev) => !prev);
  };

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach((track) => {
      track.enabled = !track.enabled;
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
          <button onClick={handleLeave} className="room-leave-btn">
            <LuLogOut size={16} />
            <span>Salir de la Sala</span>
          </button>
        </div>
      </header>

      <div className="room-grid">
        <div className="room-stage">
          <div className="room-video-container">
            {/* Video local */}
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

            {/* Videos remotos — uno por cada peer con stream */}
            {Array.from(remoteStreams.entries()).map(([peerId, stream]) => (
              <RemoteVideo key={peerId} peerId={peerId} stream={stream} />
            ))}
          </div>

          <div className="room-controls-bar">
            <button
              onClick={toggleMic}
              disabled={!localStream || localStream.getAudioTracks().length === 0}
              className={`room-control-btn ${isMicOn ? "room-control-btn--active" : "room-control-btn--muted"}`}
              title={isMicOn ? "Silenciar Micrófono" : "Activar Micrófono"}
            >
              {isMicOn ? <LuMic size={20} /> : <LuMicOff size={20} />}
              <span>{isMicOn ? "Mic Activo" : "Silenciado"}</span>
            </button>

            <button
              onClick={toggleVideo}
              disabled={!localStream || localStream.getVideoTracks().length === 0}
              className={`room-control-btn ${isVideoOn ? "room-control-btn--active" : "room-control-btn--muted"}`}
              title={isVideoOn ? "Apagar Cámara" : "Encender Cámara"}
            >
              {isVideoOn ? <LuVideo size={20} /> : <LuVideoOff size={20} />}
              <span>{isVideoOn ? "Cámara Activa" : "Cámara Off"}</span>
            </button>
          </div>
        </div>

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
                  <p>No hay mensajes en este chat. ¡Comienza el debate!</p>
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
