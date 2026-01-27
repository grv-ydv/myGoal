import {
    doc,
    setDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    collection,
    query,
    where,
    getDocs,
    orderBy,
    limit,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';
import { db } from './firebase';

// ==================== TYPES ====================

export interface UserProfile {
    uid: string;
    email: string;
    displayName?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

export interface Plan {
    id: string;
    title: string;
    goal: string;
    totalDays: number;
    startDate: Timestamp;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    weeks: Week[];
}

export interface Week {
    weekNumber: number;
    theme: string;
    days: Day[];
}

export interface Day {
    dayNumber: number;
    focus?: string;
    date: string; // ISO date string
}

export interface Task {
    id: string;
    planId: string;
    dayNumber: number;
    date: string;
    text: string;
    completed: boolean;
    type: 'task' | 'note';
    isUserCreated: boolean;
    createdAt: Timestamp;
    updatedAt: Timestamp;
}

// ==================== USER PROFILE ====================

export async function createUserProfile(uid: string, email: string, displayName?: string) {
    const userRef = doc(db, 'users', uid);
    const userData: UserProfile = {
        uid,
        email,
        displayName: displayName || email.split('@')[0],
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
    };
    await setDoc(userRef, userData);
    return userData;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        return userSnap.data() as UserProfile;
    }
    return null;
}

export async function updateUserProfile(uid: string, updates: Partial<UserProfile>) {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
        ...updates,
        updatedAt: serverTimestamp(),
    });
}

// ==================== PLANS / GOALS (Root Collection) ====================

export async function save_goal(uid: string, plan: any, goal: string) {
    // Determine the collection reference: root 'goals' collection
    // If we want to allow updating existing goals, we should check if plan.id exists
    let planRef;
    if (plan.id && plan.id !== 'new' && !plan.id.startsWith('new')) {
        planRef = doc(db, 'goals', plan.id);
    } else {
        planRef = doc(collection(db, 'goals'));
    }

    const startDate = new Date();

    const planData: Omit<Plan, 'id'> & { userId: string } = {
        userId: uid, // Critical for filtering
        title: plan.title,
        goal,
        totalDays: plan.totalDays,
        startDate: Timestamp.fromDate(startDate),
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
        weeks: plan.weeks.map((week: any) => ({
            weekNumber: week.weekNumber,
            theme: week.theme,
            days: week.days.map((day: any) => ({
                dayNumber: day.dayNumber,
                focus: day.focus,
                date: getDateForDayNumber(startDate, day.dayNumber),
            })),
        })),
    };

    // Use setDoc with merge: true to avoid overwriting unrelated fields if updating
    await setDoc(planRef, planData, { merge: true });

    // Save tasks - we can keep them in user's subcollection OR put them in subcollection of goal
    // For now, let's keep the existing pattern of creating tasks in `users/{uid}/tasks` linked by planId
    // OR, better yet, put them in `goals/{goalId}/tasks` to keep data together?
    // User didn't specify, but `users/{uid}/tasks` logic exists.
    // Let's stick to the existing task logic generally, but update `savePlan` (which calls this) to use existing `createTask`
    // which puts them in `users/{uid}/tasks`. Ideally tasks should move too, but that's a bigger refactor.
    // We will continue using `createTask` which puts them in `users/{uid}/tasks` for now unless asked otherwise.

    // Actually, `savePlan` below had logic to save tasks. We should replicate that or keep `savePlan` doing it.

    // Let's handle task creation here ensuring valid IDs
    for (const week of plan.weeks) {
        for (const day of week.days) {
            const dayDate = getDateForDayNumber(startDate, day.dayNumber);
            for (const task of day.tasks || []) {
                await createTask(uid, {
                    planId: planRef.id,
                    dayNumber: day.dayNumber,
                    date: dayDate,
                    text: task.text,
                    completed: task.completed || false,
                    type: task.type || 'task',
                    isUserCreated: false,
                });
            }
        }
    }

    return { id: planRef.id, ...planData };
}

// Alias for compatibility/clarity
export const saveGoal = save_goal;

export async function fetch_user_goals(uid: string): Promise<Plan[]> {
    const goalsRef = collection(db, 'goals');
    const q = query(goalsRef, where('userId', '==', uid));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Plan));
}

// Alias
export const fetchUserGoals = fetch_user_goals;

// Updated legacy function to use new save_goal
export async function savePlan(uid: string, plan: any, goal: string) {
    return save_goal(uid, plan, goal);
}

export async function getActivePlan(uid: string): Promise<Plan | null> {
    // Redirect to fetch_user_goals and take the first one
    const goals = await fetch_user_goals(uid);
    return goals.length > 0 ? goals[0] : null;
}

// Get ALL user plans (for multi-goal support) - Redirects to fetch_user_goals
export async function getAllPlans(uid: string): Promise<Plan[]> {
    return fetch_user_goals(uid);
}

export async function deletePlan(uid: string, planId: string) {
    // Delete all tasks for this plan first (still in users/{uid}/tasks)
    const tasksRef = collection(db, 'users', uid, 'tasks');
    const q = query(tasksRef, where('planId', '==', planId));
    const snapshot = await getDocs(q);

    for (const taskDoc of snapshot.docs) {
        await deleteDoc(taskDoc.ref);
    }

    // Delete the goal from 'goals' collection
    await deleteDoc(doc(db, 'goals', planId));

    // Also try deleting from old location just in case? No, strict separation.
}

// ==================== TASKS (Remains in users/{uid}/tasks for now) ====================

export async function createTask(uid: string, taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) {
    const taskRef = doc(collection(db, 'users', uid, 'tasks'));
    const task = {
        ...taskData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
    };
    await setDoc(taskRef, task);
    return { id: taskRef.id, ...task };
}

export async function updateTask(uid: string, taskId: string, updates: Partial<Task>) {
    const taskRef = doc(db, 'users', uid, 'tasks', taskId);
    await updateDoc(taskRef, {
        ...updates,
        updatedAt: serverTimestamp(),
    });
}

export async function deleteTask(uid: string, taskId: string) {
    await deleteDoc(doc(db, 'users', uid, 'tasks', taskId));
}

export async function getTasksForDate(uid: string, date: string): Promise<Task[]> {
    const tasksRef = collection(db, 'users', uid, 'tasks');
    const q = query(tasksRef, where('date', '==', date));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
}

export async function getTasksForPlan(uid: string, planId: string): Promise<Task[]> {
    const tasksRef = collection(db, 'users', uid, 'tasks');
    const q = query(tasksRef, where('planId', '==', planId), orderBy('dayNumber'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Task));
}

export async function toggleTaskComplete(uid: string, taskId: string, completed: boolean) {
    await updateTask(uid, taskId, { completed });
}

export async function getTodaysTasks(uid: string): Promise<Task[]> {
    const today = new Date().toISOString().split('T')[0];
    return getTasksForDate(uid, today);
}

// ==================== HELPERS ====================

function getDateForDayNumber(startDate: Date, dayNumber: number): string {
    const date = new Date(startDate);
    date.setDate(date.getDate() + dayNumber - 1);
    return date.toISOString().split('T')[0];
}
