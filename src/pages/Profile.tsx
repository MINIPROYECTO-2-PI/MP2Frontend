import React, { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { User } from "../services/auth";
import type { UserProfile } from "../services/auth";
import { useNavigate } from "react-router-dom";
import {
  LuUser,
  LuMail,
  LuPencil,
  LuSave,
  LuX,
  LuTrash2,
  LuArrowLeft,
  LuShieldAlert,
  LuCheck,
  LuCircleAlert,
  LuLoaderCircle,
  LuVideo,
} from "react-icons/lu";

const Profile: React.FC = () => {
  const { user, updateUser, deleteAccount} = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  // Editable fields
  const [editName, setEditName] = useState("");
  const [editSurname, setEditSurname] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");

  useEffect(() => {
    if (user?.uid) {
      fetchProfile();
    }
  }, [user?.uid]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const result = await User.getProfile(user!.uid);
      setProfile(result.profile);
      setEditName(result.profile.name);
      setEditSurname(result.profile.surname);
      setEditUsername(result.profile.username);
      setEditEmail(result.profile.email);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Error al cargar perfil",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setSaving(true);

    try {
      await updateUser({
        name: editName,
        surname: editSurname,
        username: editUsername,
        email: editEmail,
      });

      // Refresh profile from server
      const result = await User.getProfile(user!.uid);
      setProfile(result.profile);

      setIsEditing(false);
      setSuccessMsg("¡Perfil actualizado exitosamente!");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Error al actualizar perfil",
      );
      setTimeout(() => setErrorMsg(""), 5000);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    if (profile) {
      setEditName(profile.name);
      setEditSurname(profile.surname);
      setEditUsername(profile.username);
      setEditEmail(profile.email);
    }
    setIsEditing(false);
    setErrorMsg("");
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "ELIMINAR") return;

    setDeleting(true);
    try {
      await deleteAccount();
      navigate("/", { replace: true });
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Error al eliminar cuenta",
      );
      setDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="auth-bg">
          <div className="auth-blob auth-blob--1" />
          <div className="auth-blob auth-blob--2" />
        </div>
        <div className="profile-loading">
          <LuLoaderCircle className="profile-spinner" size={48} />
          <p>Cargando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="auth-bg">
        <div className="auth-blob auth-blob--1" />
        <div className="auth-blob auth-blob--2" />
      </div>

      {/* Navbar */}
      <nav className="profile-nav">
        <div className="profile-nav-inner">
          <button
            onClick={() => navigate("/home")}
            className="profile-back-btn"
          >
            <LuArrowLeft size={18} />
            <span>Volver</span>
          </button>
          <div className="profile-nav-brand">
            <div className="profile-nav-logo">
              <LuVideo size={18} />
            </div>
            <span className="profile-nav-title">Mi Perfil</span>
          </div>
          <div style={{ width: 100 }} />
        </div>
      </nav>

      {/* Main Content */}
      <main className="profile-main">
        <div className="profile-container">
          {/* Success/Error Messages */}
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

          {/* Profile Card */}
          <div className="profile-card">
            {/* Avatar Section */}
            <div className="profile-avatar-section">
              <div className="profile-avatar-wrapper">
                {profile?.avatar && profile.avatar.startsWith("<svg") ? (
                  <div
                    className="profile-avatar-svg"
                    dangerouslySetInnerHTML={{ __html: profile.avatar }}
                  />
                ) : profile?.avatar ? (
                  <img
                    src={profile.avatar}
                    alt="Avatar"
                    className="profile-avatar-img"
                  />
                ) : (
                  <div className="profile-avatar-fallback">
                    <LuUser size={40} />
                  </div>
                )}
                <div className="profile-avatar-badge">
                  <LuUser size={14} />
                </div>
              </div>
              <div className="profile-avatar-info">
                <h2 className="profile-display-name">
                  {profile?.name} {profile?.surname}
                </h2>
                <span className="profile-username-tag">
                  @{profile?.username}
                </span>
                {profile?.provider && (
                  <span className="profile-provider-badge">
                    {profile.provider === "google" ? "🔗 Google" : "📧 Email"}
                  </span>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="profile-divider" />

            {/* Profile Fields */}
            <div className="profile-fields">
              {/* Name */}
              <div className="profile-field">
                <label className="profile-field-label">
                  <LuUser size={14} />
                  Nombre
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="profile-field-input"
                    placeholder="Tu nombre"
                  />
                ) : (
                  <span className="profile-field-value">{profile?.name}</span>
                )}
              </div>

              {/* Surname */}
              <div className="profile-field">
                <label className="profile-field-label">
                  <LuUser size={14} />
                  Apellido
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editSurname}
                    onChange={(e) => setEditSurname(e.target.value)}
                    className="profile-field-input"
                    placeholder="Tu apellido"
                  />
                ) : (
                  <span className="profile-field-value">
                    {profile?.surname}
                  </span>
                )}
              </div>

              {/* Username */}
              <div className="profile-field">
                <label className="profile-field-label">
                  <LuUser size={14} />
                  Username
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    className="profile-field-input"
                    placeholder="Tu username"
                  />
                ) : (
                  <span className="profile-field-value">
                    @{profile?.username}
                  </span>
                )}
              </div>

              {/* Email */}
              <div className="profile-field">
                <label className="profile-field-label">
                  <LuMail size={14} />
                  Correo Electrónico
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="profile-field-input"
                    placeholder="Tu correo"
                  />
                ) : (
                  <span className="profile-field-value">{profile?.email}</span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="profile-actions">
              {isEditing ? (
                <div className="profile-edit-actions">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="profile-btn profile-btn--save"
                  >
                    {saving ? (
                      <LuLoaderCircle
                        className="profile-btn-spinner"
                        size={16}
                      />
                    ) : (
                      <LuSave size={16} />
                    )}
                    {saving ? "Guardando..." : "Guardar Cambios"}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={saving}
                    className="profile-btn profile-btn--cancel"
                  >
                    <LuX size={16} />
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="profile-view-actions">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="profile-btn profile-btn--edit"
                  >
                    <LuPencil size={16} />
                    Editar Perfil
                  </button>
                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="profile-btn profile-btn--delete"
                  >
                    <LuTrash2 size={16} />
                    Eliminar Cuenta
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div
          className="profile-modal-overlay"
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-icon">
              <LuShieldAlert size={48} />
            </div>
            <h3 className="profile-modal-title">⚠️ Eliminar Cuenta</h3>
            <p className="profile-modal-desc">
              Esta acción es <strong>permanente e irreversible</strong>. Se
              eliminarán todos tus datos de Firestore y tu cuenta de Firebase
              Auth. No podrás recuperar tu información.
            </p>
            <div className="profile-modal-confirm">
              <label className="profile-modal-label">
                Escribe <strong>ELIMINAR</strong> para confirmar:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="profile-modal-input"
                placeholder="ELIMINAR"
                disabled={deleting}
              />
            </div>
            <div className="profile-modal-actions">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== "ELIMINAR" || deleting}
                className="profile-btn profile-btn--confirm-delete"
              >
                {deleting ? (
                  <LuLoaderCircle className="profile-btn-spinner" size={16} />
                ) : (
                  <LuTrash2 size={16} />
                )}
                {deleting ? "Eliminando..." : "Sí, Eliminar mi Cuenta"}
              </button>
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteConfirmText("");
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
  );
};

export default Profile;
