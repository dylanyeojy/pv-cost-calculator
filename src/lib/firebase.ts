import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyDkMMa9qMVl2QpV4k6ZEE_n2N8a5Arogr8",
  authDomain: "pv-costing.firebaseapp.com",
  projectId: "pv-costing",
  storageBucket: "pv-costing.firebasestorage.app",
  messagingSenderId: "876465897066",
  appId: "1:876465897066:web:834ecd8a4a8b97fc491413",
  measurementId: "G-HH6BYW6HRH",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
