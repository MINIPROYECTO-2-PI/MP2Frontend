import React, { useEffect, useState, useRef, useCallback } from "react";
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

// ─── Configuración WebRTC ─────────────────────────────────────────────────────
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
};

// ─── Interfaces ───────────────────────────────────────────────────────────────
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

interface RemoteState {
  stream: MediaStream | null;
  username: string;
  isVideoOn: boolean;
  isMicOn: boolean;
}

// ─── Hook: detector de voz ────────────────────────────────────────────────────
function useIsSpeaking(stream: MediaStream | null, muted: boolean): boolean {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!stream || muted) {
      setSpeaking(false);
      return;
    }
    const audioTracks = stream.getAudioTracks();
    if (!audioTracks.length) {
      setSpeaking(false);
      return;
    }

    let ctx: AudioContext | null = null;
    let rafId = 0;
    try {
      ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const buf = new Uint8Array(analyser.frequencyBinCount);
      let counter = 0;

      const tick = () => {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        counter =
          avg > 15 ? Math.min(counter + 1, 10) : Math.max(counter - 1, 0);
        setSpeaking(counter > 2);
        rafId = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* sin mic */
    }

    return () => {
      cancelAnimationFrame(rafId);
      ctx?.close();
    };
  }, [stream, muted]);

  return speaking;
}

// ─── Tarjeta de video remoto ──────────────────────────────────────────────────
const RemoteVideo: React.FC<{
  peerId: string;
  state: RemoteState;
}> = ({ peerId, state }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const speaking = useIsSpeaking(state.stream, !state.isMicOn);

  useEffect(() => {
    if (videoRef.current && state.stream) {
      videoRef.current.srcObject = state.stream;
    }
  }, [state.stream]);

  const showVideo = state.isVideoOn && !!state.stream;

  return (
    <div className={`room-video-card${speaking ? " speaking" : ""}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`room-video-feed${showVideo ? "" : " room-video-feed--hidden"}`}
      />
      {!showVideo && (
        <div className="room-video-placeholder">
          <div className="room-video-avatar-fallback">
            {state.username ? (
              state.username.charAt(0).toUpperCase()
            ) : (
              <LuUser size={40} />
            )}
          </div>
          <span className="room-video-name">
            @{state.username || "Participante"}
          </span>
          <span className="room-status-sub">
            {state.stream ? "Cámara Apagada" : "Conectando..."}
          </span>
        </div>
      )}
      <div className="room-video-card-top-badges">
        <span
          className={`media-status-badge ${state.isMicOn ? "active" : "muted"}`}
        >
          {state.isMicOn ? <LuMic size={14} /> : <LuMicOff size={14} />}
        </span>
        <span
          className={`media-status-badge ${state.isVideoOn ? "active" : "muted"}`}
        >
          {state.isVideoOn ? <LuVideo size={14} /> : <LuVideoOff size={14} />}
        </span>
      </div>
      <div className="room-participant-labels">
        <span
          className="participant-badge-name"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          {speaking && (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#22c55e",
                display: "inline-block",
              }}
            />
          )}
          @{state.username} ({peerId.substring(0, 5)})
        </span>
      </div>
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
const Room: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  // refs que no deben re-renderizar
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const mySocketIdRef = useRef<string>("");
  const isVideoOnRef = useRef(false);
  const isMicOnRef = useRef(false);

  // estado de UI
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

  // UN solo map que agrupa todo el estado remoto por peerId
  const [remotes, setRemotes] = useState<Map<string, RemoteState>>(new Map());

  const isLocalSpeaking = useIsSpeaking(localStream, !isMicOn);

  // ── Helpers de estado remoto ──────────────────────────────────────────────
  const upsertRemote = useCallback(
    (peerId: string, patch: Partial<RemoteState>) => {
      setRemotes((prev) => {
        const next = new Map(prev);
        const existing = next.get(peerId) ?? {
          stream: null,
          username: "Participante",
          isVideoOn: false,
          isMicOn: false,
        };
        next.set(peerId, { ...existing, ...patch });
        return next;
      });
    },
    [],
  );

  const removeRemote = useCallback((peerId: string) => {
    setRemotes((prev) => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }, []);

  // ── Broadcast estado de media a todos los peers conectados ────────────────
  const broadcastMediaState = useCallback(
    (videoOn: boolean, micOn: boolean) => {
      const socket = socketRef.current;
      if (!socket) return;
      peerConnectionsRef.current.forEach((_, peerId) => {
        socket.emit("signal", peerId, socket.id, {
          type: "media-state",
          isVideoOn: videoOn,
          isMicOn: micOn,
        });
      });
    },
    [],
  );

  // ── 1. Obtener media ──────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const tryGetMedia = async () => {
      const attempts = [
        { video: true, audio: true },
        { video: false, audio: true },
        { video: true, audio: false },
      ];
      let stream: MediaStream | null = null;
      for (const c of attempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(c);
          break;
        } catch {
          /* siguiente intento */
        }
      }
      if (!mounted) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }
      if (stream) {
        stream.getTracks().forEach((t) => (t.enabled = false));
        localStreamRef.current = stream;
        setLocalStream(stream);
      }
    };
    tryGetMedia();
    return () => {
      mounted = false;
    };
  }, []);

  // ── 2. Vincular stream local al <video> ───────────────────────────────────
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // ── 3. Crear peer connection ──────────────────────────────────────────────
  const createPeerConnection = useCallback(
    (remotePeerId: string): RTCPeerConnection => {
      // Cerrar la anterior si existe
      const old = peerConnectionsRef.current.get(remotePeerId);
      if (old) {
        old.close();
        peerConnectionsRef.current.delete(remotePeerId);
      }

      const pc = new RTCPeerConnection(RTC_CONFIG);

      // Añadir tracks locales
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => {
          pc.addTrack(track, localStreamRef.current!);
        });
      }

      // ICE candidates
      pc.onicecandidate = ({ candidate }) => {
        if (candidate && socketRef.current) {
          socketRef.current.emit("signal", remotePeerId, socketRef.current.id, {
            type: "candidate",
            candidate,
          });
        }
      };

      // Tracks remotos entrantes
      pc.ontrack = ({ streams }) => {
        const stream = streams[0];
        if (!stream) return;
        upsertRemote(remotePeerId, { stream });
      };

      // Cambios de estado ICE
      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        console.log(`[ICE:${remotePeerId.slice(0, 5)}] ${s}`);
        if (s === "failed" || s === "disconnected" || s === "closed") {
          pc.close();
          peerConnectionsRef.current.delete(remotePeerId);
          // No borrar de remotes aquí — esperar a userDisconnected del servidor
        }
      };

      peerConnectionsRef.current.set(remotePeerId, pc);
      return pc;
    },
    [upsertRemote],
  );

  // ── 4. Lógica principal de socket ─────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !user) {
      navigate("/dashboard");
      return;
    }

    const socket = connectSocket();
    socketRef.current = socket;

    // ── Señalización ──────────────────────────────────────────────────────
    const onSignal = async (_to: string, from: string, data: any) => {
      if (from === socket.id) return;

      // Mensaje de estado de media (no es WebRTC estándar)
      if (data.type === "media-state") {
        upsertRemote(from, {
          isVideoOn: !!data.isVideoOn,
          isMicOn: !!data.isMicOn,
        });
        return;
      }

      // Obtener o crear peer connection
      let pc = peerConnectionsRef.current.get(from);
      if (!pc) pc = createPeerConnection(from);

      try {
        if (data.type === "offer") {
          if (
            pc.signalingState !== "stable" &&
            pc.signalingState !== "have-remote-offer"
          ) {
            console.warn(
              `[offer] signalingState inesperado: ${pc.signalingState}`,
            );
            return;
          }
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("signal", from, socket.id, answer);
          // Informar nuestro estado de media al nuevo peer
          socket.emit("signal", from, socket.id, {
            type: "media-state",
            isVideoOn: isVideoOnRef.current,
            isMicOn: isMicOnRef.current,
          });
        } else if (data.type === "answer") {
          if (pc.signalingState !== "have-local-offer") {
            console.warn(
              `[answer] signalingState inesperado: ${pc.signalingState}`,
            );
            return;
          }
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          // Informar nuestro estado de media al peer que respondió
          socket.emit("signal", from, socket.id, {
            type: "media-state",
            isVideoOn: isVideoOnRef.current,
            isMicOn: isMicOnRef.current,
          });
        } else if (data.candidate) {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          }
        }
      } catch (err) {
        console.error(`[signal] error con ${from.slice(0, 5)}:`, err);
      }
    };

    // ── Nuevo peer en la sala → los peers EXISTENTES crean la offer ───────
    const onNewPeer = async (data: {
      peerId: string;
      username: string;
      uid: string;
      activeUsers: ActiveUser[];
    }) => {
      const { peerId, username } = data;
      if (peerId === socket.id) return;

      console.log(`[new-peer-joined] ${username} (${peerId.slice(0, 5)})`);

      // Registrar username aunque todavía no haya stream
      upsertRemote(peerId, { username });
      setActiveUsers(data.activeUsers);

      // ✅ CRÍTICO: los peers EXISTENTES son quienes hacen la offer
      const pc = createPeerConnection(peerId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("signal", peerId, socket.id, offer);
        // También enviar nuestro estado de media
        socket.emit("signal", peerId, socket.id, {
          type: "media-state",
          isVideoOn: isVideoOnRef.current,
          isMicOn: isMicOnRef.current,
        });
      } catch (err) {
        console.error(`[new-peer-joined] error creando offer:`, err);
      }
    };

    // ── Peer se desconectó ────────────────────────────────────────────────
    const onUserDisconnected = (peerId: string) => {
      console.log(`[userDisconnected] ${peerId.slice(0, 5)}`);
      const pc = peerConnectionsRef.current.get(peerId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(peerId);
      }
      removeRemote(peerId);
    };

    // ── Registrar TODOS los listeners ANTES de emitir join-room ──────────
    socket.on("signal", onSignal);
    socket.on("new-peer-joined", onNewPeer);
    socket.on("userDisconnected", onUserDisconnected);

    socket.on("delete-room", (data: { message: string }) => {
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
        console.log(
          `[room-joined-success] myId=${data.mySocketId} peers=${data.activeUsers.length}`,
        );
        mySocketIdRef.current = data.mySocketId;
        setRoomName(data.roomName);
        setHostUid(data.hostUid);
        setActiveUsers(data.activeUsers);
        setIsValidating(false);
        setLoading(false);

        // ✅ El peer NUEVO hace la offer a todos los que ya estaban en la sala
        const existingPeers = data.activeUsers.filter(
          (u) => u.socketId && u.socketId !== data.mySocketId,
        );
        console.log(
          `[room-joined-success] haré offer a ${existingPeers.length} peer(s)`,
        );

        for (const peer of existingPeers) {
          upsertRemote(peer.socketId, { username: peer.username });
          try {
            const pc = createPeerConnection(peer.socketId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit("signal", peer.socketId, socket.id, offer);
            socket.emit("signal", peer.socketId, socket.id, {
              type: "media-state",
              isVideoOn: isVideoOnRef.current,
              isMicOn: isMicOnRef.current,
            });
          } catch (err) {
            console.error(
              `[room-joined-success] error offer a ${peer.socketId.slice(0, 5)}:`,
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

    // ✅ Emitir join-room DESPUÉS de registrar todos los listeners
    socket.emit("join-room", {
      roomId,
      username: user.username || user.displayName || "Estudiante",
      uid: user.uid,
    });

    return () => {
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
      setRemotes(new Map());

      socket.off("signal", onSignal);
      socket.off("new-peer-joined", onNewPeer);
      socket.off("userDisconnected", onUserDisconnected);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, user?.uid]);

  // ── 5. Auto scroll chat ───────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── 6. Controles ─────────────────────────────────────────────────────────
  const toggleMic = () => {
    const next = !isMicOn;
    localStreamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
    setIsMicOn(next);
    isMicOnRef.current = next;
    broadcastMediaState(isVideoOnRef.current, next);
  };

  const toggleVideo = () => {
    const next = !isVideoOn;
    localStreamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
    setIsVideoOn(next);
    isVideoOnRef.current = next;
    broadcastMediaState(next, isMicOnRef.current);
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

  // ── Renders de estado ─────────────────────────────────────────────────────
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

  // ── Render principal ──────────────────────────────────────────────────────
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
            {/* ── Video local ─────────────────────────────────────────────── */}
            <div
              className={`room-video-card${isLocalSpeaking ? " speaking" : ""}`}
            >
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className={`room-video-feed${isVideoOn ? "" : " room-video-feed--hidden"}`}
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
              <div className="room-video-card-top-badges">
                <span
                  className={`media-status-badge ${isMicOn ? "active" : "muted"}`}
                >
                  {isMicOn ? <LuMic size={14} /> : <LuMicOff size={14} />}
                </span>
                <span
                  className={`media-status-badge ${isVideoOn ? "active" : "muted"}`}
                >
                  {isVideoOn ? <LuVideo size={14} /> : <LuVideoOff size={14} />}
                </span>
              </div>
              <div className="room-participant-labels">
                <span
                  className="participant-badge-name"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {isLocalSpeaking && (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: "#22c55e",
                        display: "inline-block",
                      }}
                    />
                  )}
                  Tú
                </span>
              </div>
            </div>

            {/* ── Videos remotos — uno por entrada en `remotes` ────────────── */}
            {Array.from(remotes.entries()).map(([peerId, state]) => (
              <RemoteVideo key={peerId} peerId={peerId} state={state} />
            ))}
          </div>

          {/* ── Controles ─────────────────────────────────────────────────── */}
          <div className="room-controls-bar">
            <button
              onClick={toggleMic}
              disabled={
                !localStream || localStream.getAudioTracks().length === 0
              }
              className={`room-control-btn ${isMicOn ? "room-control-btn--active" : "room-control-btn--muted"}`}
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
            >
              {isVideoOn ? <LuVideo size={20} /> : <LuVideoOff size={20} />}
              <span>{isVideoOn ? "Cámara Activa" : "Cámara Off"}</span>
            </button>
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
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
