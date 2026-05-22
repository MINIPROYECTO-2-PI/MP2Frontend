import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { auth } from "./firebase";

const API_URL = "http://localhost:3000";
const provider = new GoogleAuthProvider();

export interface AuthResponse {
  message: string;
  user: {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
    username?: string;
  };
}

export interface GoogleAuthResponse {
  isNewUser: boolean;
  message: string;
  user: {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
    username?: string;
  };
}

export interface RegisterData {
  username: string;
  password: string;
  email: string;
  name: string;
  surname: string;
}

export interface LoginData {
  username: string;
  password: string;
}

export class User {
  /**
   * Registro normal con email y contraseña.
   * Envía los datos al backend que crea el usuario en Firebase Auth + Firestore.
   */
  static async register(data: RegisterData): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Error al registrar usuario");
    }

    return result;
  }

  /**
   * Login normal con username o email y contraseña.
   * El backend busca el email por username y autentica con Firebase Auth.
   */
  static async login(data: LoginData): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Error al iniciar sesión");
    }

    return result;
  }

  /**
   * Login con Google usando Firebase Auth en el frontend.
   * Luego notifica al backend para guardar/verificar el usuario en Firestore.
   */
  static async googleLogin(): Promise<GoogleAuthResponse> {
    const userCredential = await signInWithPopup(auth, provider);
    const firebaseUser = userCredential.user;

    // Notificar al backend para guardar el usuario en Firestore si no existe
    const response = await fetch(`${API_URL}/google-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        displayName: firebaseUser.displayName,
        photoURL: firebaseUser.photoURL,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Error al iniciar sesión con Google");
    }

    return result;
  }

  /**
   * Completar registro de Google eligiendo un username único.
   */
  static async googleRegisterComplete(data: {
    uid: string;
    email: string;
    displayName?: string;
    photoURL?: string;
    username: string;
  }): Promise<AuthResponse> {
    const response = await fetch(`${API_URL}/google-register-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Error al completar el perfil");
    }

    return result;
  }

  /**
   * Cerrar sesión.
   */
  static async logout(): Promise<void> {
    await signOut(auth);
    await fetch(`${API_URL}/logout`, { method: "POST" });
  }
}
