import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { User } from "../services/auth";
import type { RoomData } from "../services/auth";
import { useNavigate } from "react-router-dom";
import { MdDelete } from "react-icons/md";
import {
  LuVideo,
  LuPlus,
  LuDoorOpen,
  LuCopy,
  LuCheck,
  LuCircleAlert,
  LuLoaderCircle,
  LuLayoutDashboard,
  LuLogOut,
  LuUser,
  LuClock,
  LuHash,
  LuSparkles,
  LuShieldAlert,
  LuTrash2,
} from "react-icons/lu";

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deleteRoom, setDeleteRoom] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const handleDeleteRoom = () => {
    setDeleteRoom(!deleteRoom);
  };
  const fetchRooms = async () => {
    try {
      setLoading(true);
      const result = await User.getRooms(user!.uid);
      setRooms(result.rooms);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al cargar salas");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (user?.uid) {
      fetchRooms();
    }
  }, [user?.uid]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!roomName.trim()) {
      setErrorMsg("El nombre de la sala es requerido");
      return;
    }

    setCreating(true);
    try {
      const result = await User.createRoom({
        name: roomName.trim(),
        hostUid: user!.uid,
        hostUsername: user!.username || "anónimo",
      });

      setRooms((prev) => [result.room, ...prev]);
      setRoomName("");
      setShowCreateForm(false);
      setSuccessMsg(`¡Sala "${result.room.name}" creada exitosamente!`);
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al crear sala");
      setTimeout(() => setErrorMsg(""), 5000);
    } finally {
      setCreating(false);
    }
  };

  const copyRoomId = (roomId: string) => {
    navigator.clipboard.writeText(roomId);
    setCopiedId(roomId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("es-CO", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="dashboard-page">
      <div className="auth-bg">
        <div className="auth-blob auth-blob--1" />
        <div className="auth-blob auth-blob--2" />
      </div>

      {/* Navbar */}
      <nav className="dashboard-nav">
        <div className="dashboard-nav-inner">
          <div className="dashboard-nav-left">
            <div className="dashboard-nav-logo">
              <LuVideo size={20} />
            </div>
            <span className="dashboard-nav-title">MeetClone</span>
          </div>

          <div className="dashboard-nav-right">
            {/* Profile Link */}
            <button
              onClick={() => navigate("/profile")}
              className="dashboard-profile-chip"
            >
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Avatar"
                  className="dashboard-profile-avatar"
                />
              ) : (
                <div className="dashboard-profile-avatar-fallback">
                  {user?.displayName ? (
                    user.displayName.charAt(0).toUpperCase()
                  ) : (
                    <LuUser size={14} />
                  )}
                </div>
              )}
              <div className="dashboard-profile-info">
                <span className="dashboard-profile-name">
                  {user?.displayName || user?.username || "Usuario"}
                </span>
                <span className="dashboard-profile-tag">
                  @{user?.username || "sin_usuario"}
                </span>
              </div>
            </button>

            <button
              onClick={logout}
              className="dashboard-logout-btn"
              title="Cerrar Sesión"
            >
              <LuLogOut size={16} />
              <span>Salir</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="dashboard-main">
        <div className="dashboard-container">
          {/* Header Section */}
          <div className="dashboard-header">
            <div className="dashboard-header-text">
              <h1 className="dashboard-title">
                <LuLayoutDashboard size={28} />
                Mis Salas de Estudio
              </h1>
              <p className="dashboard-subtitle">
                Crea y administra tus espacios de estudio colaborativo
              </p>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="dashboard-create-btn"
            >
              <LuPlus size={18} />
              Crear Sala
            </button>
          </div>

          {/* Alerts */}
          {successMsg && (
            <div className="profile-alert profile-alert--success">
              <LuCheck size={18} />
              <span>{successMsg}</span>
            </div>
          )}
          {errorMsg && (
            <div className="profile-alert profile-alert--error">
              <LuCircleAlert size={18} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Create Room Form */}
          {showCreateForm && (
            <div className="dashboard-create-card">
              <div className="dashboard-create-header">
                <LuSparkles size={20} className="dashboard-create-icon" />
                <h3>Crear Nueva Sala</h3>
              </div>
              <form
                onSubmit={handleCreateRoom}
                className="dashboard-create-form"
              >
                <div className="dashboard-create-input-wrap">
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="Nombre de la sala (ej: Estudio de Cálculo)"
                    className="dashboard-create-input"
                    maxLength={50}
                    disabled={creating}
                    autoFocus
                  />
                  <span className="dashboard-create-counter">
                    {roomName.length}/50
                  </span>
                </div>
                <div className="dashboard-create-actions">
                  <button
                    type="submit"
                    disabled={creating || !roomName.trim()}
                    className="profile-btn profile-btn--save"
                  >
                    {creating ? (
                      <LuLoaderCircle
                        className="profile-btn-spinner"
                        size={16}
                      />
                    ) : (
                      <LuPlus size={16} />
                    )}
                    {creating ? "Creando..." : "Crear Sala"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setRoomName("");
                    }}
                    disabled={creating}
                    className="profile-btn profile-btn--cancel"
                  >
                    Cancelar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Rooms List or Empty State */}
          {loading ? (
            <div className="dashboard-loading">
              <LuLoaderCircle className="profile-spinner" size={40} />
              <p>Cargando tus salas...</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="dashboard-empty">
              <div className="dashboard-empty-icon">
                <LuDoorOpen size={64} />
              </div>
              <h2 className="dashboard-empty-title">No tienes salas aún</h2>
              <p className="dashboard-empty-desc">
                ¡Crea tu primera sala de estudio y comienza a colaborar con
                otros estudiantes!
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="dashboard-create-btn dashboard-create-btn--large"
              >
                <LuPlus size={20} />
                Crear mi primera sala
              </button>
            </div>
          ) : (
            <div className="dashboard-rooms-grid">
              {rooms.map((room) => (
                <div key={room.id} className="dashboard-room-card">
                  <div className="dashboard-room-header">
                    <div className="dashboard-room-icon">
                      <LuVideo size={20} />
                    </div>
                    <div className="dashboard-room-meta">
                      <h3 className="dashboard-room-name">{room.name}</h3>
                      <span className="dashboard-room-role">Administrador</span>
                    </div>
                  </div>
                  <div className="dashboard-room-details">
                    <div className="dashboard-room-detail">
                      <LuHash size={14} />
                      <span className="dashboard-room-id">{room.roomId}</span>
                      <button
                        onClick={() => copyRoomId(room.roomId)}
                        className="dashboard-copy-btn"
                        title="Copiar ID"
                      >
                        {copiedId === room.roomId ? (
                          <LuCheck size={14} />
                        ) : (
                          <LuCopy size={14} />
                        )}
                      </button>
                    </div>
                    <div className="dashboard-room-detail">
                      <LuClock size={14} />
                      <span>{formatDate(room.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => navigate(`/room/${room.roomId}`)}
                      className="dashboard-room-enter"
                    >
                      <LuDoorOpen size={16} />
                      Entrar a la sala
                    </button>
                    <button
                      onClick={() => {
                        setDeleteRoom(true);
                      }}
                      className="dashboard-logout-btn"
                    >
                      <MdDelete size={40} />
                      Eliminar Sala
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {deleteRoom && (
            <div className="profile-modal-overlay" onClick={() => {}}>
              <div
                className="profile-modal"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="profile-modal-icon">
                  <LuShieldAlert size={48} />
                </div>
                <h3 className="profile-modal-title">⚠️ Eliminar Sala</h3>
                <p className="profile-modal-desc">
                  Si eliminas esta sala todas las <strong>PERSONAS</strong> que
                  se encuentren en ella se desconectaran inmediatamente
                </p>

                <div className="profile-modal-actions">
                  <button
                    onClick={() => {}}
                    className="profile-btn profile-btn--confirm-delete"
                  >
                    {deleting ? (
                      <LuLoaderCircle
                        className="profile-btn-spinner"
                        size={16}
                      />
                    ) : (
                      <LuTrash2 size={16} />
                    )}
                    {deleting ? "Eliminando..." : "Eliminar Sala"}
                  </button>
                  <button
                    onClick={() => {
                      setDeleteRoom(false);
                    }}
                    disabled={deleting}
                    className="profile-btn profile-btn--cancel-modal"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="dashboard-footer">
        &copy; 2026 MeetClone. Todos los derechos reservados.
      </footer>
    </div>
  );
};

export default Dashboard;
