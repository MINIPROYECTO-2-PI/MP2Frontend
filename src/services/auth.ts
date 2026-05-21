import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";

import { auth } from "./firebase.js";

const provider = new GoogleAuthProvider();

export class User {
  static async googleLogin() {
    try {
      const userCredential = await signInWithPopup(auth, provider);

      const credential =
        GoogleAuthProvider.credentialFromResult(userCredential);

      const token = credential.accessToken;

      const user = userCredential.user;

      console.log(user);

      return user;
    } catch (error) {
      console.error(error);
    }
  }
}
