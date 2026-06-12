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
  LuShieldAlert,
  LuWifi,
  LuX,
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
  const isVideoOnRef = useRef(true);
  const isMicOnRef = useRef(true);

  // estado de UI
  const [loading, setLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [roomName, setRoomName] = useState("");
  const [hostUid, setHostUid] = useState("");
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [copied, setCopied] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // ── Estado de permisos de media ────────────────────────────────────────────
  const [mediaReady, setMediaReady] = useState(false);
  const [mediaPerms, setMediaPerms] = useState<{
    video: "pending" | "granted" | "denied";
    audio: "pending" | "granted" | "denied";
  }>({ video: "pending", audio: "pending" });
  const [toasts, setToasts] = useState<
    {
      id: string;
      type: "success" | "error" | "warning" | "info";
      message: string;
    }[]
  >([]);

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
        socket.emit("signal", peerId, mySocketIdRef.current, {
          type: "media-state",
          isVideoOn: videoOn,
          isMicOn: micOn,
        });
      });
    },
    [],
  );

  // ── Helper para toasts ──────────────────────────────────────────────────────
  const addToast = useCallback(
    (type: "success" | "error" | "warning" | "info", message: string) => {
      const id = `toast-${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    },
    [],
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── 1. Obtener media con feedback de permisos ─────────────────────────────
  useEffect(() => {
    let mounted = true;
    let activeStream: MediaStream | null = null;

    const tryGetMedia = async () => {
      let hasVideo = false;
      let hasAudio = false;
      let stream: MediaStream | null = null;

      // Intento 1: video + audio
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        hasVideo = true;
        hasAudio = true;
      } catch (err: any) {
        const name = err?.name || "";
        // Si fue denegado explícitamente, intentar por separado
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          // Intentar solo audio
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: false,
              audio: true,
            });
            hasAudio = true;
          } catch {
            /* sin audio */
          }
          // Intentar solo video si no tenemos stream
          if (!stream) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
              });
              hasVideo = true;
            } catch {
              /* sin video */
            }
          }
        } else {
          // Otro error (NotFoundError, etc) — intentar parciales
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: false,
              audio: true,
            });
            hasAudio = true;
          } catch {
            /* */
          }
          if (!stream) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
              });
              hasVideo = true;
            } catch {
              /* */
            }
          }
        }
      }

      if (!mounted) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      // Detectar tracks reales obtenidos
      if (stream) {
        activeStream = stream;
        hasVideo = stream.getVideoTracks().length > 0;
        hasAudio = stream.getAudioTracks().length > 0;

        // Mantener activos los tracks por defecto para que la persona pueda verse
        localStreamRef.current = stream;
        setLocalStream(stream);

        // Inicializar el estado de controles de acuerdo con el hardware real obtenido
        setIsVideoOn(hasVideo);
        isVideoOnRef.current = hasVideo;
        setIsMicOn(hasAudio);
        isMicOnRef.current = hasAudio;
      } else {
        setIsVideoOn(false);
        isVideoOnRef.current = false;
        setIsMicOn(false);
        isMicOnRef.current = false;
      }

      // Actualizar permisos y mostrar toasts
      setMediaPerms({
        video: hasVideo ? "granted" : "denied",
        audio: hasAudio ? "granted" : "denied",
      });

      if (hasVideo && hasAudio) {
        addToast("success", "Cámara y micrófono conectados correctamente");
      } else if (hasVideo && !hasAudio) {
        addToast(
          "warning",
          "Cámara conectada · Micrófono denegado o no disponible",
        );
      } else if (!hasVideo && hasAudio) {
        addToast(
          "warning",
          "Micrófono conectado · Cámara denegada o no disponible",
        );
      } else {
        addToast(
          "error",
          "No se pudo acceder a cámara ni micrófono. Revisa los permisos del navegador.",
        );
      }

      setMediaReady(true);
    };

    tryGetMedia();

    return () => {
      mounted = false;
      if (activeStream) {
        console.log("[Room] Limpiando tracks locales del efecto actual...");
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2.5 Vincular stream local al <video> ───────────────────────────────────
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      console.log("[Room] Vinculando stream local al elemento video...");
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.play().catch((err) => {
        console.warn("[Room] Error al reproducir video local:", err);
      });
    }
  }, [localStream, loading]);

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
          socketRef.current.emit(
            "signal",
            remotePeerId,
            mySocketIdRef.current,
            {
              type: "candidate",
              candidate,
            },
          );
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
    if (!mediaReady) return;
    if (!roomId || !user) {
      navigate("/dashboard");
      return;
    }

    const socket = connectSocket();
    socketRef.current = socket;

    const handleConnect = () => {
      console.log("[socket] Conectado. Enviando join-room...");
      socket.emit("join-room", {
        roomId,
        username: user.username || user.displayName || "Estudiante",
        uid: user.uid,
      });
    };

    // ── Señalización ──────────────────────────────────────────────────────
    const onSignal = async (_to: string, from: string, data: any) => {
      if (from === mySocketIdRef.current) return;

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
          socket.emit("signal", from, mySocketIdRef.current, answer);
          // Informar nuestro estado de media al nuevo peer
          socket.emit("signal", from, mySocketIdRef.current, {
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
          socket.emit("signal", from, mySocketIdRef.current, {
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
      if (peerId === mySocketIdRef.current) return;

      console.log(`[new-peer-joined] ${username} (${peerId.slice(0, 5)})`);

      // Registrar username aunque todavía no haya stream
      upsertRemote(peerId, { username });
      setActiveUsers(data.activeUsers);

      // ✅ CRÍTICO: los peers EXISTENTES son quienes hacen la offer
      const pc = createPeerConnection(peerId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("signal", peerId, mySocketIdRef.current, offer);
        // También enviar nuestro estado de media
        socket.emit("signal", peerId, mySocketIdRef.current, {
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
      (data: {
        roomId: string;
        roomName: string;
        hostUid: string;
        activeUsers: ActiveUser[];
        mySocketId: string;
      }) => {
        // ✅ FIX: usar mySocketId del servidor, nunca socket.id del cliente
        const myId = data.mySocketId || socket.id || "";
        console.log(
          `[room-joined-success] myId=${myId} peers=${data.activeUsers.length}`,
        );
        console.log(
          "[room-joined-success] activeUsers list:",
          JSON.stringify(data.activeUsers),
        );
        mySocketIdRef.current = myId;
        setRoomName(data.roomName);
        setHostUid(data.hostUid);
        setActiveUsers(data.activeUsers);
        setIsValidating(false);
        setLoading(false);

        // ✅ Solo registrar usernames de peers existentes.
        // Los peers EXISTENTES crean offers vía "new-peer-joined".
        // NO crear offers aquí para evitar colisión de offers.
        const existingPeers = data.activeUsers.filter(
          (u) => u.socketId && u.socketId !== myId,
        );
        console.log(
          `[room-joined-success] ${existingPeers.length} peer(s) existentes (ellos harán offer)`,
        );
        for (const peer of existingPeers) {
          upsertRemote(peer.socketId, { username: peer.username });
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

    // ✅ Emitir join-room DESPUÉS de registrar todos los listeners, controlando reconexiones
    socket.on("connect", handleConnect);
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      setRemotes(new Map());

      socket.off("connect", handleConnect);
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
  }, [roomId, user?.uid, mediaReady]);

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

    if (next && localVideoRef.current) {
      localVideoRef.current.play().catch((err) => {
        console.warn("[Room] Error forzando play() en video local:", err);
      });
    }
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
          {/* ── Banner de Permisos de Media ── */}
          {(mediaPerms.video === "denied" || mediaPerms.audio === "denied") && (
            <div className="media-permission-alert-banner">
              <div className="media-permission-alert-icon">
                <LuShieldAlert size={20} />
              </div>
              <div className="media-permission-alert-content">
                <h4>Acceso denegado a la Cámara/Micrófono</h4>
                <p>
                  El navegador denegó el acceso a tu{" "}
                  {mediaPerms.video === "denied" &&
                  mediaPerms.audio === "denied"
                    ? "cámara y micrófono"
                    : mediaPerms.video === "denied"
                      ? "cámara"
                      : "micrófono"}
                  . Haz clic en el candado de la barra de direcciones de tu
                  navegador para otorgar los permisos.
                </p>
              </div>
            </div>
          )}

          {/* ── Status de Dispositivos ── */}
          <div className="media-devices-status-panel">
            <div className="media-device-status-item">
              <span
                className={`status-dot ${mediaPerms.video === "granted" ? "status-dot--success" : "status-dot--danger"}`}
              />
              <LuVideo size={14} />
              <span>
                Cámara:{" "}
                {mediaPerms.video === "granted"
                  ? "Conectada"
                  : mediaPerms.video === "pending"
                    ? "Pendiente"
                    : "Bloqueada/No disponible"}
              </span>
            </div>
            <div className="media-device-status-item">
              <span
                className={`status-dot ${mediaPerms.audio === "granted" ? "status-dot--success" : "status-dot--danger"}`}
              />
              <LuMic size={14} />
              <span>
                Micrófono:{" "}
                {mediaPerms.audio === "granted"
                  ? "Conectado"
                  : mediaPerms.audio === "pending"
                    ? "Pendiente"
                    : "Bloqueado/No disponible"}
              </span>
            </div>
            <div className="media-device-status-item media-device-status-item--webrtc">
              <span className="status-dot status-dot--success" />
              <LuWifi size={14} />
              <span>Conexión WebRTC: Lista</span>
            </div>
          </div>

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

      {/* ── Sistema de Toasts/Notificaciones ── */}
      <div className="room-toasts-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`room-toast room-toast--${toast.type}`}
          >
            <span className="room-toast-message">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="room-toast-close-btn"
              type="button"
            >
              <LuX size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Room;
