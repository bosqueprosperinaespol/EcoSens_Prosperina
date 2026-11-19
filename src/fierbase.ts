// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {
  addDoc,
  collection,
  getFirestore,
  serverTimestamp,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBR8U4TWc1efk2aOBBx-jgGd7FtwQr9cuY",
  authDomain: "ecosense-58b0e.firebaseapp.com",
  projectId: "ecosense-58b0e",
  storageBucket: "ecosense-58b0e.firebasestorage.app",
  messagingSenderId: "391897542833",
  appId: "1:391897542833:web:e277cecdda8a91b66f3290",
  measurementId: "G-3NKX9DQ912"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const database = getFirestore(app);
export const auth = getAuth(app);

export type LecturaAmbiental = {
  stationId: string;
  voltage?: number;
  current?: number;
  humidity?: number;
  timestamp?: number;
};

export async function guardarLectura(lectura: LecturaAmbiental) {
  if (!lectura.stationId.trim()) {
    throw new Error("La estación es obligatoria.");
  }

  const variables = [lectura.voltage, lectura.current, lectura.humidity];
  if (!variables.some((value) => value !== undefined)) {
    throw new Error("La lectura debe incluir al menos una variable.");
  }

  if (variables.some((value) => value !== undefined && !Number.isFinite(value))) {
    throw new Error("Las variables de la lectura deben ser números válidos.");
  }

  if (
    lectura.timestamp !== undefined &&
    !Number.isFinite(lectura.timestamp)
  ) {
    throw new Error("La fecha de la lectura no es válida.");
  }

  if (
    lectura.humidity !== undefined &&
    (lectura.humidity < 0 || lectura.humidity > 100)
  ) {
    throw new Error("La humedad debe estar entre 0 y 100 por ciento.");
  }

  const newMeasurement = await addDoc(collection(database, "measurements"), {
    ...lectura,
    stationId: lectura.stationId.trim(),
    timestamp: lectura.timestamp !== undefined
      ? new Date(lectura.timestamp)
      : serverTimestamp(),
  });

  return newMeasurement.id;
}

export { analytics };