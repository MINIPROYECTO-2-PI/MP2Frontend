import { GoogleAuthProvider, signInWithPopup, signOut, deleteUser as deleteFirebaseAuthUser } from "firebase/auth";
import { auth } from "./firebase";

const API_URL = "http://localhost:3000";
const provider = new GoogleAuthProvider();

export interface AuthUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  username?: string;
}

export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  name: string;
  surname: string;
  avatar: string;
  provider?: string;
  createdAt?: string;
}

export interface AuthResponse {
  message: string;
  user: AuthUser;
}

export interface ProfileResponse {
  message: string;
  profile: UserProfile;
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

export interface UpdateProfileData {
  name?: string;
  surname?: string;
  username?: string;
  email?: string;
  avatar?: string;
}

export interface RoomData {
  id: string;
  roomId: string;
  name: string;
  hostUid: string;
  hostUsername: string;
  createdAt: string;
}

export interface RoomResponse {
  message: string;
  room: RoomData;
}

export interface RoomsListResponse {
  message: string;
  rooms: RoomData[];
}

class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type");
  let result: any;
  
  if (contentType && contentType.includes("application/json")) {
    result = await response.json();
  } else {
    const text = await response.text();
    result = { error: text || `Error de servidor (Estado: ${response.status})` };
  }

  if (!response.ok) {
    throw new ApiError(result.error || "Error en la solicitud", response.status);
  }

  return result as T;
}

async function request<T>(url: string, body: object): Promise<T> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await handleResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error(`No se pudo conectar con el servidor backend en http://localhost:3000. Por favor, asegúrate de que el backend esté corriendo.`);
  }
}

async function requestGet<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    return await handleResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error(`No se pudo conectar con el servidor backend en http://localhost:3000. Por favor, asegúrate de que el backend esté corriendo.`);
  }
}

async function requestPut<T>(url: string, body: object): Promise<T> {
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return await handleResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error(`No se pudo conectar con el servidor backend en http://localhost:3000. Por favor, asegúrate de que el backend esté corriendo.`);
  }
}

async function requestDelete<T>(url: string): Promise<T> {
  try {
    const response = await fetch(url, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
    return await handleResponse<T>(response);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new Error(`No se pudo conectar con el servidor backend en http://localhost:3000. Por favor, asegúrate de que el backend esté corriendo.`);
  }
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

  // US-04: Profile
  static async getProfile(uid: string): Promise<ProfileResponse> {
    return requestGet<ProfileResponse>(`${API_URL}/profile/${uid}`);
  }

  static async updateProfile(uid: string, data: UpdateProfileData): Promise<ProfileResponse> {
    return requestPut<ProfileResponse>(`${API_URL}/profile/${uid}`, data);
  }

  // US-05: Delete Account
  static async deleteAccount(uid: string): Promise<{ message: string }> {
    const result = await requestDelete<{ message: string }>(`${API_URL}/profile/${uid}`);
    // Also delete from Firebase Auth on client side
    const currentUser = auth.currentUser;
    if (currentUser) {
      try {
        await deleteFirebaseAuthUser(currentUser);
      } catch {
        // If Firebase Auth deletion fails on client, the backend already cleaned Firestore
        console.warn("Firebase Auth user deletion handled by backend");
      }
    }
    await signOut(auth).catch(() => {});
    return result;
  }

  // US-06: Rooms
  static async createRoom(data: { name: string; hostUid: string; hostUsername: string }): Promise<RoomResponse> {
    return request<RoomResponse>(`${API_URL}/rooms`, data);
  }

  static async getRooms(uid: string): Promise<RoomsListResponse> {
    return requestGet<RoomsListResponse>(`${API_URL}/rooms/${uid}`);
  }
}
