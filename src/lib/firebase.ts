import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
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
