import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  Component,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { LuMonitor, LuMonitorOff } from "react-icons/lu";
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
// FIX: Removidos los TURN servers de openrelay.metered.ca — son poco confiables
// y causan ICE checking → disconnected inmediato. Usar servidores STUN de Google
// es suficiente para la mayoría de redes. Si hay NAT simétrico, añadir TURN propio.
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
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

// ─── ErrorBoundary para tarjetas de video ────────────────────────────────────
// Evita que un crash en un <video> remoto (p.ej. el NotFoundError de insertBefore
// en mobile) tire toda la sala. El error queda contenido en esa tarjeta.
class VideoErrorBoundary extends Component<
  { children: React.ReactNode; peerId: string },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn(
      "[VideoErrorBoundary] Error en tarjeta de video:",
      error.message,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="room-video-card">
          <div className="room-video-placeholder">
            <div className="room-video-avatar-fallback">
              <LuUser size={40} />
            </div>
            <span className="room-video-name">Participante</span>
            <span className="room-status-sub">Error de video</span>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Tarjeta de video remoto ──────────────────────────────────────────────────
const RemoteVideo: React.FC<{
  peerId: string;
  state: RemoteState;
}> = ({ peerId, state }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const speaking = useIsSpeaking(state.stream, !state.isMicOn);

  const hasVideoTrack = state.stream
    ?.getVideoTracks()
    .some((t) => t.enabled && t.readyState === "live");

  // FIX: Un solo useEffect con dependencia en state.stream — evita bucle infinito
  // del useEffect sin array de dependencias que había antes.
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !state.stream) return;
    if (el.srcObject === state.stream) return;
    el.srcObject = state.stream;
    el.play().catch(() => {});
  }, [state.stream]);

  const showVideo = hasVideoTrack && !!state.stream;

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

// ─── Componentes auxiliares para Presentación ────────────────────────────────
const PresenterVideo: React.FC<{ stream: MediaStream }> = ({ stream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    if (el.srcObject === stream) return;
    el.srcObject = stream;
    el.play().catch(() => {});
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      className="room-screen-feed"
    />
  );
};

const LocalCameraPreview: React.FC<{
  stream: MediaStream | null;
  isVideoOn: boolean;
}> = ({ stream, isVideoOn }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !stream) return;
    if (el.srcObject === stream) return;
    el.srcObject = stream;
    el.play().catch(() => {});
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className={`room-video-feed${isVideoOn ? "" : " room-video-feed--hidden"}`}
    />
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
  // FIX: Cola de ICE candidates pendientes por peer — evita perder candidates
  // que llegan antes de que setRemoteDescription termine.
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map(),
  );
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const mySocketIdRef = useRef<string>("");
  const isVideoOnRef = useRef(true);
  const isMicOnRef = useRef(true);
  // FIX: Ref para saber si el componente sigue montado — evita setState en unmount
  const mountedRef = useRef(true);
  const screenStreamRef = useRef<MediaStream | null>(null);
  // Track original de cámara — NUNCA se sobreescribe después de asignarse
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  // Estado de video previo al compartir pantalla
  const wasVideoOnBeforeScreenShare = useRef(true);

  // estado de UI
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  // quién está compartiendo pantalla (null = nadie)
  const [sharingPeerId, setSharingPeerId] = useState<string | null>(null);
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

  const [remotes, setRemotes] = useState<Map<string, RemoteState>>(new Map());

  const isLocalSpeaking = useIsSpeaking(localStream, !isMicOn);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ── Toasts ────────────────────────────────────────────────────────────────
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

  // ── Broadcast estado de media ─────────────────────────────────────────────
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

  const stopScreenShare = useCallback(() => {
    const screenStream = screenStreamRef.current;
    if (screenStream) {
      screenStream.getTracks().forEach((t) => t.stop());
      screenStreamRef.current = null;
    }

    // Restaurar el track de cámara en todas las PeerConnections
    const camTrack = cameraTrackRef.current;
    if (camTrack) {
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(camTrack);
        }
      });
    }

    // Restaurar preview local al stream de cámara
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }

    // Restaurar estado previo de video
    const restoreVideo = wasVideoOnBeforeScreenShare.current;
    if (camTrack) {
      camTrack.enabled = restoreVideo;
    }
    isVideoOnRef.current = restoreVideo;

    // Notificar al servidor que dejamos de compartir
    if (socketRef.current && roomId) {
      socketRef.current.emit("screen-share-stop", { roomId });
    }

    requestAnimationFrame(() => {
      setIsScreenSharing(false);
      setIsVideoOn(restoreVideo);
    });
    broadcastMediaState(restoreVideo, isMicOnRef.current);
  }, [roomId, broadcastMediaState]);

  const startScreenShare = useCallback(async () => {
    // Verificar con el servidor que no haya otro presenter
    if (!socketRef.current || !roomId) return;

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      // Guardar estado previo de video ANTES de compartir
      wasVideoOnBeforeScreenShare.current = isVideoOnRef.current;

      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];

      // Reemplazar el track de video en cada PeerConnection activa
      peerConnectionsRef.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });

      // Actualizar preview local
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = screenStream;
      }

      // Notificar al servidor
      socketRef.current.emit("screen-share-start", { roomId });

      requestAnimationFrame(() => {
        setIsScreenSharing(true);
        setIsVideoOn(true);
      });
      isVideoOnRef.current = true;
      broadcastMediaState(true, isMicOnRef.current);

      // Cuando el usuario usa el botón nativo del browser "Detener"
      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err: any) {
      if (err?.name !== "NotAllowedError") {
        console.error("[screenShare] Error:", err);
        addToast("error", "No se pudo iniciar la compartición de pantalla");
      }
    }
  }, [roomId, broadcastMediaState, addToast, stopScreenShare]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [isScreenSharing, stopScreenShare, startScreenShare]);

  // ── Helpers de estado remoto ──────────────────────────────────────────────
  const upsertRemote = useCallback(
    (peerId: string, patch: Partial<RemoteState>) => {
      if (!mountedRef.current) return;
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
    if (!mountedRef.current) return;
    setRemotes((prev) => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  }, []);


  // ── 1. Obtener media ──────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    let activeStream: MediaStream | null = null;

    const tryGetMedia = async () => {
      let hasVideo = false;
      let hasAudio = false;
      let stream: MediaStream | null = null;

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        hasVideo = true;
        hasAudio = true;
      } catch (err: any) {
        const name = err?.name || "";
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: false,
              audio: true,
            });
            hasAudio = true;
          } catch {
            /* sin audio */
          }
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

      if (stream) {
        activeStream = stream;
        hasVideo = stream.getVideoTracks().length > 0;
        hasAudio = stream.getAudioTracks().length > 0;

        localStreamRef.current = stream;
        setLocalStream(stream);

        // Guardar el track original de cámara UNA SOLA VEZ
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack && !cameraTrackRef.current) {
          cameraTrackRef.current = videoTrack;
        }

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
          "No se pudo acceder a cámara ni micrófono. Revisa los permisos.",
        );
      }

      setMediaReady(true);
    };

    tryGetMedia();

    return () => {
      mounted = false;
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── 2. Vincular stream local al <video> ───────────────────────────────────
  useEffect(() => {
    if (loading) return;
    const video = localVideoRef.current;
    if (!video) return;

    const expectedStream = isScreenSharing ? screenStreamRef.current : localStream;
    if (!expectedStream) return;

    if (video.srcObject === expectedStream) return;
    video.srcObject = expectedStream;
    video.play().catch(() => {});
  }, [localStream, loading, isScreenSharing]);

  // ── 3. Crear peer connection ──────────────────────────────────────────────
  // FIX: La función ahora recibe el stream como parámetro en vez de leerlo
  // del ref — garantiza que siempre use el stream correcto en el momento de
  // creación, incluso si localStreamRef.current todavía es null por timing.
  const createPeerConnection = useCallback(
    (remotePeerId: string, stream: MediaStream | null): RTCPeerConnection => {
      const old = peerConnectionsRef.current.get(remotePeerId);
      if (old) {
        old.close();
        peerConnectionsRef.current.delete(remotePeerId);
      }

      // FIX: Limpiar cola de ICE candidates al recrear la conexión
      pendingCandidatesRef.current.delete(remotePeerId);

      const pc = new RTCPeerConnection(RTC_CONFIG);

      // FIX: Añadir tracks usando el stream recibido como parámetro,
      // no localStreamRef.current que puede ser null en este momento.
      if (stream) {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
        });
      }

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

      // FIX: ontrack maneja múltiples tracks del mismo stream correctamente.
      // Antes solo se usaba streams[0] sin verificar si era el stream correcto.
      pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (!stream) return;

        // Actualizar el stream remoto — si ya existe, React compara por referencia
        upsertRemote(remotePeerId, { stream });

        // FIX: Escuchar cambios en los tracks del stream remoto (e.g. cuando
        // el otro peer activa/desactiva cámara o mic después de conectado)
        stream.onaddtrack = () => {
          upsertRemote(remotePeerId, { stream });
        };
        stream.onremovetrack = () => {
          upsertRemote(remotePeerId, { stream });
        };
      };

      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        console.log(`[ICE:${remotePeerId.slice(0, 5)}] ${s}`);
        if (s === "failed") {
          // FIX: En fallo ICE intentar reiniciar negociación en vez de cerrar
          console.warn(
            `[ICE:${remotePeerId.slice(0, 5)}] Fallo ICE — intentando restartIce`,
          );
          pc.restartIce();
        }
        if (s === "closed") {
          peerConnectionsRef.current.delete(remotePeerId);
          pendingCandidatesRef.current.delete(remotePeerId);
        }
      };

      // FIX: Loggear estado de conexión para diagnóstico más claro
      pc.onconnectionstatechange = () => {
        console.log(
          `[PC:${remotePeerId.slice(0, 5)}] connectionState=${pc.connectionState}`,
        );
      };

      peerConnectionsRef.current.set(remotePeerId, pc);
      return pc;
    },
    [upsertRemote],
  );

  // ── FIX: Función para drenar la cola de ICE candidates pendientes ─────────
  // Los candidates pueden llegar vía socket ANTES de que setRemoteDescription
  // termine. Si se llama addIceCandidate sin remoteDescription, falla silenciosamente.
  const drainPendingCandidates = useCallback(
    async (peerId: string, pc: RTCPeerConnection) => {
      const queue = pendingCandidatesRef.current.get(peerId) ?? [];
      pendingCandidatesRef.current.delete(peerId);
      for (const candidate of queue) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn(
            `[ICE queue] error añadiendo candidate para ${peerId.slice(0, 5)}:`,
            err,
          );
        }
      }
    },
    [],
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

      if (data.type === "media-state") {
        upsertRemote(from, {
          isVideoOn: !!data.isVideoOn,
          isMicOn: !!data.isMicOn,
        });
        return;
      }

      // FIX: Al obtener/crear la PC, pasar el stream actual del ref.
      // createPeerConnection ahora lo recibe como parámetro.
      let pc = peerConnectionsRef.current.get(from);
      if (!pc) {
        pc = createPeerConnection(from, localStreamRef.current);
      }

      try {
        if (data.type === "offer") {
          // FIX: Si ya hay una offer local pendiente (glare/colisión), el peer
          // con socketId lexicográficamente mayor se retira (rollback).
          if (pc.signalingState === "have-local-offer") {
            if (mySocketIdRef.current > from) {
              // Yo me retiro: rollback y acepto la offer del otro
              await pc.setLocalDescription({ type: "rollback" });
            } else {
              // El otro se retirará — ignorar esta offer
              console.warn(
                `[offer] Glare detectado — ignorando offer de ${from.slice(0, 5)}`,
              );
              return;
            }
          }

          if (
            pc.signalingState !== "stable" &&
            pc.signalingState !== "have-remote-offer"
          ) {
            console.warn(
              `[offer] signalingState inesperado: ${pc.signalingState} — ignorando`,
            );
            return;
          }

          await pc.setRemoteDescription(new RTCSessionDescription(data));

          // FIX: Drenar candidates pendientes DESPUÉS de setRemoteDescription
          await drainPendingCandidates(from, pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit("signal", from, mySocketIdRef.current, answer);

          socket.emit("signal", from, mySocketIdRef.current, {
            type: "media-state",
            isVideoOn: isVideoOnRef.current,
            isMicOn: isMicOnRef.current,
          });
        } else if (data.type === "answer") {
          if (pc.signalingState !== "have-local-offer") {
            console.warn(
              `[answer] signalingState inesperado: ${pc.signalingState} — ignorando`,
            );
            return;
          }
          await pc.setRemoteDescription(new RTCSessionDescription(data));

          // FIX: Drenar candidates pendientes DESPUÉS de setRemoteDescription
          await drainPendingCandidates(from, pc);

          socket.emit("signal", from, mySocketIdRef.current, {
            type: "media-state",
            isVideoOn: isVideoOnRef.current,
            isMicOn: isMicOnRef.current,
          });
        } else if (data.type === "candidate" && data.candidate) {
          // FIX: Si remoteDescription todavía no está lista, encolar el candidate
          // en vez de descartarlo. Se drena cuando llega offer/answer.
          if (pc.remoteDescription) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (err) {
              console.warn(`[ICE] error añadiendo candidate:`, err);
            }
          } else {
            console.log(
              `[ICE] Encolando candidate para ${from.slice(0, 5)} (sin remoteDesc aún)`,
            );
            const queue = pendingCandidatesRef.current.get(from) ?? [];
            queue.push(data.candidate);
            pendingCandidatesRef.current.set(from, queue);
          }
        }
      } catch (err) {
        console.error(`[signal] error con ${from.slice(0, 5)}:`, err);
      }
    };

    // ── Nuevo peer en la sala ─────────────────────────────────────────────
    const onNewPeer = async (data: {
      peerId: string;
      username: string;
      uid: string;
      activeUsers: ActiveUser[];
    }) => {
      const { peerId, username } = data;
      if (peerId === mySocketIdRef.current) return;

      console.log(`[new-peer-joined] ${username} (${peerId.slice(0, 5)})`);

      upsertRemote(peerId, { username });
      setActiveUsers(data.activeUsers);

      // FIX: Pasar localStreamRef.current explícitamente al crear la PC
      const pc = createPeerConnection(peerId, localStreamRef.current);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("signal", peerId, mySocketIdRef.current, offer);
        socket.emit("signal", peerId, mySocketIdRef.current, {
          type: "media-state",
          isVideoOn: isVideoOnRef.current,
          isMicOn: isMicOnRef.current,
        });
      } catch (err) {
        console.error(`[new-peer-joined] error creando offer:`, err);
      }
    };

    // ── Peer desconectado ────────────────────────────────────────────────
    // FIX: Pequeño delay antes de limpiar el remote del estado visual.
    // Cuando un peer recarga, llegan en ráfaga: userDisconnected (socket viejo)
    // seguido de new-peer-joined (nuevo socketId). Sin el delay, hay riesgo de
    // que el estado visual parpadee. La PC se cierra inmediatamente igual.
    const onUserDisconnected = (peerId: string) => {
      console.log(`[userDisconnected] ${peerId.slice(0, 5)}`);
      const pc = peerConnectionsRef.current.get(peerId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(peerId);
      }
      pendingCandidatesRef.current.delete(peerId);
      setTimeout(() => removeRemote(peerId), 800);
    };

    socket.on("signal", onSignal);
    socket.on("new-peer-joined", onNewPeer);
    socket.on("userDisconnected", onUserDisconnected);

    socket.on("delete-room", (data: { message: string }) => {
      alert(data.message);
      navigate("/dashboard");
    });

    // FIX: El servidor desconecta sesiones duplicadas del mismo uid.
    // Si el usuario tenía la sala abierta en otra pestaña, llega este evento.
    socket.on("session-replaced", (data: { message: string }) => {
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
        currentPresenter?: string | null;
      }) => {
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

        // Si ya hay alguien compartiendo pantalla al entrar
        if (data.currentPresenter) {
          setSharingPeerId(data.currentPresenter);
        }

        const existingPeers = data.activeUsers.filter(
          (u) => u.socketId && u.socketId !== myId,
        );
        console.log(
          `[room-joined-success] ${existingPeers.length} peer(s) existentes`,
        );

        // FIX: Al entrar (o recargar), el recién llegado debe iniciar la
        // conexión con cada peer existente. Antes solo se registraba el username
        // pero NO se creaba la PC ni se mandaba offer — así que si el otro peer
        // no detectaba el new-peer-joined a tiempo (p.ej. por evict+rejoin rápido),
        // la conexión nunca arrancaba.
        //
        // Estrategia: el recién llegado manda offer a TODOS los peers existentes.
        // Los peers existentes reciben new-peer-joined y también mandan offer.
        // El glare (colisión de offers) lo resuelve el handler de "offer" con rollback.
        for (const peer of existingPeers) {
          upsertRemote(peer.socketId, { username: peer.username });
          // Crear PC y mandar offer al peer existente
          const pc = createPeerConnection(
            peer.socketId,
            localStreamRef.current,
          );
          pc.createOffer()
            .then((offer) => pc.setLocalDescription(offer).then(() => offer))
            .then((offer) => {
              socket.emit("signal", peer.socketId, myId, offer);
              socket.emit("signal", peer.socketId, myId, {
                type: "media-state",
                isVideoOn: isVideoOnRef.current,
                isMicOn: isMicOnRef.current,
              });
              console.log(
                `[room-joined-success] offer enviada a peer existente ${peer.socketId.slice(0, 5)}`,
              );
            })
            .catch((err) => {
              console.error(
                `[room-joined-success] error creando offer para ${peer.socketId.slice(0, 5)}:`,
                err,
              );
            });
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

    // ── Screen share exclusiva ──────────────────────────────────────────
    socket.on("screen-share-started", (data: { peerId: string }) => {
      setSharingPeerId(data.peerId);
    });

    socket.on("screen-share-stopped", () => {
      setSharingPeerId(null);
    });

    socket.on("screen-share-denied", () => {
      // Detener el stream que ya obtuvimos con getDisplayMedia
      const scr = screenStreamRef.current;
      if (scr) {
        scr.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
      }
      // Restaurar cámara en los senders
      const camTrack = cameraTrackRef.current;
      if (camTrack) {
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(camTrack);
        });
      }
      // Restaurar preview local
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      const restoreVideo = wasVideoOnBeforeScreenShare.current;
      if (camTrack) camTrack.enabled = restoreVideo;
      isVideoOnRef.current = restoreVideo;
      requestAnimationFrame(() => {
        setIsScreenSharing(false);
        setIsVideoOn(restoreVideo);
      });
      broadcastMediaState(restoreVideo, isMicOnRef.current);
      addToast("error", "Ya hay alguien compartiendo pantalla");
    });

    socket.on("connect", handleConnect);
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      // Cleanup screen share si estamos compartiendo al desmontar
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
        screenStreamRef.current = null;
        if (roomId) {
          socket.emit("screen-share-stop", { roomId });
        }
      }

      peerConnectionsRef.current.forEach((pc) => pc.close());
      peerConnectionsRef.current.clear();
      pendingCandidatesRef.current.clear();
      setRemotes(new Map());

      socket.off("connect", handleConnect);
      socket.off("signal", onSignal);
      socket.off("new-peer-joined", onNewPeer);
      socket.off("userDisconnected", onUserDisconnected);
      socket.off("delete-room");
      socket.off("session-replaced");
      socket.off("room-joined-success");
      socket.off("room-invalid");
      socket.off("error-msg");
      socket.off("room-history");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("receive-message");
      socket.off("screen-share-started");
      socket.off("screen-share-stopped");
      socket.off("screen-share-denied");
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
    isMicOnRef.current = next;
    broadcastMediaState(isVideoOnRef.current, next);
    // Defer setState un frame igual que toggleVideo — consistencia en mobile
    requestAnimationFrame(() => {
      setIsMicOn(next);
    });
  };

  const toggleVideo = () => {
    // No tocar video si estamos compartiendo pantalla
    if (isScreenSharing) return;
    const next = !isVideoOn;
    // FIX: Usar cameraTrackRef directamente — NO tocar localStreamRef ni screenStreamRef.
    // Esto evita que al desactivar cámara mientras se comparte pantalla se pierda la referencia.
    if (cameraTrackRef.current) {
      cameraTrackRef.current.enabled = next;
    }
    isVideoOnRef.current = next;
    broadcastMediaState(next, isMicOnRef.current);

    // Defer el setState un frame para que el browser termine el layout actual
    requestAnimationFrame(() => {
      setIsVideoOn(next);
      if (next && localVideoRef.current) {
        localVideoRef.current.play().catch((err) => {
          console.warn("[Room] Error forzando play() en video local:", err);
        });
      }
    });
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
        <div className={`room-stage${sharingPeerId ? " room-stage--sharing" : ""}`}>
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

          {/* Determine who is the presenter */}
          {(() => {
            const isPresenting = sharingPeerId !== null;
            const iAmPresenter = sharingPeerId === mySocketIdRef.current;
            // Find the presenter's video (remote or local)
            const presenterRemote = sharingPeerId ? remotes.get(sharingPeerId) : null;
            // All participant cards (local + remotes) go to the strip when presenting
            return isPresenting ? (
              /* ── SCREEN SHARE LAYOUT (Google Meet style) ── */
              <div className="room-screenshare-layout">
                {/* Main stage: screen share */}
                <div className="room-stage-main">
                  {iAmPresenter ? (
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="room-screen-feed"
                    />
                  ) : presenterRemote?.stream ? (
                    <PresenterVideo stream={presenterRemote.stream} />
                  ) : (
                    <div className="room-screen-placeholder">
                      <LuMonitor size={48} />
                      <span>Esperando pantalla compartida...</span>
                    </div>
                  )}
                  <div className="room-presenter-badge">
                    <LuMonitor size={14} />
                    <span>
                      {iAmPresenter
                        ? "Tú estás presentando"
                        : `${presenterRemote?.username || "Participante"} está presentando`}
                    </span>
                  </div>
                </div>

                {/* Participants strip */}
                <div className="room-participants-strip">
                  {/* Local video card (small) */}
                  {iAmPresenter ? (
                    /* When I'm presenter, show camera preview from localStreamRef */
                    <div className={`room-video-card room-strip-card${isLocalSpeaking ? " speaking" : ""}`}>
                      <LocalCameraPreview
                        stream={localStreamRef.current}
                        isVideoOn={!isScreenSharing ? isVideoOn : wasVideoOnBeforeScreenShare.current}
                      />
                      {!(isScreenSharing ? wasVideoOnBeforeScreenShare.current : isVideoOn) && (
                        <div className="room-video-placeholder">
                          <div className="room-video-avatar-fallback" style={{ width: 40, height: 40, fontSize: "1rem" }}>
                            {user?.displayName?.charAt(0).toUpperCase() || <LuUser size={20} />}
                          </div>
                        </div>
                      )}
                      <div className="room-participant-labels">
                        <span className="participant-badge-name">Tú</span>
                      </div>
                    </div>
                  ) : (
                    <div className={`room-video-card room-strip-card${isLocalSpeaking ? " speaking" : ""}`}>
                      <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        className={`room-video-feed${isVideoOn ? "" : " room-video-feed--hidden"}`}
                      />
                      {!isVideoOn && (
                        <div className="room-video-placeholder">
                          <div className="room-video-avatar-fallback" style={{ width: 40, height: 40, fontSize: "1rem" }}>
                            {user?.displayName?.charAt(0).toUpperCase() || <LuUser size={20} />}
                          </div>
                        </div>
                      )}
                      <div className="room-participant-labels">
                        <span className="participant-badge-name">Tú</span>
                      </div>
                    </div>
                  )}

                  {/* Remote video cards (small, skip presenter) */}
                  {Array.from(remotes.entries())
                    .filter(([pid]) => pid !== sharingPeerId)
                    .map(([peerId, state]) => (
                      <VideoErrorBoundary key={peerId} peerId={peerId}>
                        <div className="room-strip-card">
                          <RemoteVideo peerId={peerId} state={state} />
                        </div>
                      </VideoErrorBoundary>
                    ))}
                </div>
              </div>
            ) : (
              /* ── GRID LAYOUT (default, no screen share) ── */
              <div className="room-video-container">
            {/* ── Video local ──────────────────────────────────────────── */}
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

            {Array.from(remotes.entries()).map(([peerId, state]) => (
              <VideoErrorBoundary key={peerId} peerId={peerId}>
                <RemoteVideo peerId={peerId} state={state} />
              </VideoErrorBoundary>
            ))}
          </div>
            );
          })()}

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
            <button
              onClick={toggleScreenShare}
              disabled={
                !localStream ||
                (sharingPeerId !== null && sharingPeerId !== mySocketIdRef.current)
              }
              className={`room-control-btn ${
                isScreenSharing
                  ? "room-control-btn--sharing"
                  : "room-control-btn--muted"
              }`}
              title={
                sharingPeerId !== null && sharingPeerId !== mySocketIdRef.current
                  ? "Alguien más está compartiendo pantalla"
                  : isScreenSharing
                    ? "Detener compartición"
                    : "Compartir pantalla"
              }
            >
              {isScreenSharing ? (
                <LuMonitorOff size={20} />
              ) : (
                <LuMonitor size={20} />
              )}
              <span>{isScreenSharing ? "Detener" : "Pantalla"}</span>
            </button>
          </div>
        </div>

        {/* ── Sidebar ──────────────────────────────────────────────────── */}
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

      {/* ── Toasts ─────────────────────────────────────────────────────── */}
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
