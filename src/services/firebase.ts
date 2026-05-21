import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyA1j3mybOpG9gcINcts2Pk8veE_m3VCGJI",
  authDomain: "mproyecto2-e6d4e.firebaseapp.com",
  projectId: "mproyecto2-e6d4e",
  storageBucket: "mproyecto2-e6d4e.firebasestorage.app",
  messagingSenderId: "881475675016",
  appId: "1:881475675016:web:aa61a99fca124074a4903d",
};

// Inicializar app
const app = initializeApp(firebaseConfig);

// Exportar auth tipado automáticamente por Firebase
export const auth = getAuth(app);
