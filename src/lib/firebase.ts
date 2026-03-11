import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyD85mrLZxE2q1Xrx1dfVcXRgodowLWYfzE",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "mygoal-ai-planner-86a11.firebaseapp.com",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "mygoal-ai-planner-86a11",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "mygoal-ai-planner-86a11.firebasestorage.app",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "119705216292",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:119705216292:web:3f8c4bf1c3d2ea5c733fb1",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-H1WDKBQCJY"
};

const missingFirebaseVars = Object.entries(firebaseConfig)
    .filter(([, value]) => !value)
    .map(([key]) => key);

if (typeof window !== 'undefined' && missingFirebaseVars.length > 0) {
    throw new Error(`Missing Firebase env vars: ${missingFirebaseVars.join(', ')}. Configure .env.local before running the app.`);
}

if (typeof window === 'undefined' && missingFirebaseVars.length > 0) {
    console.warn(`Firebase env vars missing during server build/runtime: ${missingFirebaseVars.join(', ')}.`);
}

// Initialize Firebase (prevent duplicate initialization in dev)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Firestore with memory-only cache (no offline persistence = faster initial load)
let db: ReturnType<typeof getFirestore>;
try {
    db = initializeFirestore(app, { localCache: memoryLocalCache() });
} catch {
    // Already initialized (e.g. during hot reload in dev)
    db = getFirestore(app);
}
export { db };

// Helper: wrap Firestore calls with a timeout for faster failure
export function withTimeout<T>(promise: Promise<T>, timeoutMs: number = 5000): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error('Firestore timeout')), timeoutMs)
        )
    ]);
}

export default app;
