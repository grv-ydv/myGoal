import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyD85mrLZxE2q1Xrx1dfVcXRgodowLWYfzE",
    authDomain: "mygoal-ai-planner-86a11.firebaseapp.com",
    projectId: "mygoal-ai-planner-86a11",
    storageBucket: "mygoal-ai-planner-86a11.firebasestorage.app",
    messagingSenderId: "119705216292",
    appId: "1:119705216292:web:3f8c4bf1c3d2ea5c733fb1",
    measurementId: "G-H1WDKBQCJY"
};

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
