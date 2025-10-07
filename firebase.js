import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "REPLACE_WITH_YOUR_APIKEY",
  authDomain: "REPLACE_WITH_YOUR_AUTHDOMAIN",
  projectId: "REPLACE_WITH_YOUR_PROJECTID",
  storageBucket: "REPLACE_WITH_YOUR_STORAGEBUCKET",
  messagingSenderId: "REPLACE_WITH_YOUR_MESSAGINGSENDERID",
  appId: "REPLACE_WITH_YOUR_APPID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
