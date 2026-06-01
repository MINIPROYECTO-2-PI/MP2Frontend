import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { auth } from "../services/firebase";
import { User } from "../services/auth";
import type { AuthUser, UpdateProfileData } from "../services/auth";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  needsUsername: boolean;
  tempGoogleUser: AuthUser | null;
  login: (userData: AuthUser) => void;
  logout: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  completeGoogleProfile: (username: string) => Promise<void>;
  updateUser: (updates: UpdateProfileData) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [tempGoogleUser, setTempGoogleUserState] = useState<AuthUser | null>(null);

  const syncGoogleUserWithBackend = async (firebaseUser: FirebaseUser) => {
    try {
      const response = await fetch(`http://localhost:3000/google-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName,
          photoURL: firebaseUser.photoURL,
        }),
      });

      const result: { isNewUser: boolean; user: AuthUser; error?: string } = await response.json();

      if (response.ok) {
        if (result.isNewUser) {
          setNeedsUsername(true);
          setTempGoogleUserState(result.user);
          setUser(null);
        } else {
          setUser(result.user);
          setNeedsUsername(false);
          setTempGoogleUserState(null);
        }
      } else {
        setUser(null);
        setNeedsUsername(false);
        setTempGoogleUserState(null);
      }
    } catch (error) {
      console.error("Error al sincronizar con backend:", error);
      setUser(null);
      setNeedsUsername(false);
      setTempGoogleUserState(null);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setLoading(true);
        if (firebaseUser) {
          await syncGoogleUserWithBackend(firebaseUser);
        } else {
          const localUser = localStorage.getItem("meet_clone_user");
          if (localUser) {
            setUser(JSON.parse(localUser) as AuthUser);
          } else {
            setUser(null);
          }
          setNeedsUsername(false);
          setTempGoogleUserState(null);
        }
      } catch (error) {
        console.error("Error al sincronizar auth con backend:", error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = (userData: AuthUser) => {
    setUser(userData);
    localStorage.setItem("meet_clone_user", JSON.stringify(userData));
    setNeedsUsername(false);
    setTempGoogleUserState(null);
  };

  const logout = async () => {
    setLoading(true);
    try {
      await User.logout();
      setUser(null);
      localStorage.removeItem("meet_clone_user");
      setNeedsUsername(false);
      setTempGoogleUserState(null);
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
    } finally {
      setLoading(false);
    }
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    try {
      const result = await User.googleLogin();
      if (result.isNewUser) {
        setNeedsUsername(true);
        setTempGoogleUserState(result.user);
        setUser(null);
      } else {
        login(result.user);
      }
    } catch (error) {
      console.error("Error al ingresar con Google:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const completeGoogleProfile = async (username: string) => {
    if (!tempGoogleUser) {
      throw new Error("No hay un usuario de Google temporal configurado");
    }

    const result = await User.googleRegisterComplete({
      uid: tempGoogleUser.uid,
      email: tempGoogleUser.email,
      displayName: tempGoogleUser.displayName,
      photoURL: tempGoogleUser.photoURL,
      username: username,
    });

    // Guardar el usuario completo logueado
    login(result.user);
  };

  const updateUser = async (updates: UpdateProfileData) => {
    if (!user) throw new Error("No hay usuario autenticado");

    const result = await User.updateProfile(user.uid, updates);
    const updatedUser: AuthUser = {
      uid: result.profile.uid,
      email: result.profile.email,
      displayName: `${result.profile.name} ${result.profile.surname}`,
      photoURL: result.profile.avatar,
      username: result.profile.username,
    };
    setUser(updatedUser);
    localStorage.setItem("meet_clone_user", JSON.stringify(updatedUser));
  };

  const deleteAccount = async () => {
    if (!user) throw new Error("No hay usuario autenticado");

    await User.deleteAccount(user.uid);
    setUser(null);
    localStorage.removeItem("meet_clone_user");
    setNeedsUsername(false);
    setTempGoogleUserState(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        needsUsername,
        tempGoogleUser,
        login,
        logout,
        signInWithGoogle,
        completeGoogleProfile,
        updateUser,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
};
