import { GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "./firebase";

const API_URL = "https://mp2backend.onrender.com";
const provider = new GoogleAuthProvider();

export interface AuthUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  username?: string;
}

export interface AuthResponse {
  message: string;
  user: AuthUser;
}

export interface GoogleAuthResponse {
  isNewUser: boolean;
  message: string;
  user: AuthUser;
}

export interface ErrorResponse {
  error: string;
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

export interface GoogleLoginData {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

export interface GoogleRegisterCompleteData {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  username: string;
}

class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(url: string, body: object): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const result: unknown = await response.json();

  if (!response.ok) {
    const err = result as ErrorResponse;
    throw new ApiError(err.error || "Error en la solicitud", response.status);
  }

  return result as T;
}

export class User {
  static async register(data: RegisterData): Promise<AuthResponse> {
    return request<AuthResponse>(`${API_URL}/register`, data);
  }

  static async login(data: LoginData): Promise<AuthResponse> {
    return request<AuthResponse>(`${API_URL}/login`, data);
  }

  static async googleLogin(): Promise<GoogleAuthResponse> {
    const userCredential = await signInWithPopup(auth, provider);
    const firebaseUser = userCredential.user;

    return request<GoogleAuthResponse>(`${API_URL}/google-login`, {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      displayName: firebaseUser.displayName,
      photoURL: firebaseUser.photoURL,
    });
  }

  static async googleRegisterComplete(
    data: GoogleRegisterCompleteData,
  ): Promise<AuthResponse> {
    return request<AuthResponse>(`${API_URL}/google-register-complete`, data);
  }

  static async logout(): Promise<void> {
    await signOut(auth);
    await fetch(`${API_URL}/logout`, { method: "POST" });
  }
}
