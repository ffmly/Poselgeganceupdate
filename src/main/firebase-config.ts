import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAMIiOBE5yLkHf4HiVIjXLTy0L-H5d3TWg",
  authDomain: "elegance-pos-2b059.firebaseapp.com",
  projectId: "elegance-pos-2b059",
  storageBucket: "elegance-pos-2b059.firebasestorage.app",
  messagingSenderId: "73389992067",
  appId: "1:73389992067:web:d0b313dae14000e945d3b6",
};

const app = initializeApp(firebaseConfig, 'electron-pos');
export const db = getFirestore(app);
