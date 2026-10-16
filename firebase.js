import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB1QUxM_hlpHYdITokdhAOvfqn9QQDBXys",
  authDomain: "excellentspay.firebaseapp.com",
  projectId: "excellentspay",
  storageBucket: "excellentspay.firebasestorage.app",
  messagingSenderId: "601604553085",
  appId: "1:601604553085:web:5673577b69d0a9ecce3414"
};

export const OWNER = "excellentservices.excel@gmail.com";
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// O dono sempre entra. Os demais precisam estar liberados na aba "Acessos".
export async function temAcesso(user) {
  const email = (user.email || "").toLowerCase();
  if (email === OWNER) return true;
  try { return (await getDoc(doc(db, "acessos", email))).exists(); }
  catch (_) { return false; }
}
