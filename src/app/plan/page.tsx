"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getAllPlans, getTasksForPlan, Task, Plan } from '@/lib/firestore';
import PlanDashboard from '@/components/PlanDashboard';
import styles from '../page.module.css';

const STORAGE_KEY = 'myGoal_appData';

interface GoalWithTasks {
    id: string;
    title: string;
    goal: string;
    totalDays: number;
    startDate: Date;
    weeks: any[];
    tasks: Task[];
    isNew?: boolean;
}

// Create an empty plan structure for when no plan exists
function createEmptyPlan(): GoalWithTasks {
    const today = new Date();
    const days = [];

    // Create 14 days (2 weeks)
    for (let i = 1; i <= 14; i++) {
        days.push({
            dayNumber: i,
            focus: '',
            tasks: []
        });
    }

    return {
        id: 'empty',
        title: 'My Tasks',
        goal: '',
        totalDays: 14,
        startDate: today,
        weeks: [
            { weekNumber: 1, theme: 'This Week', days: days.slice(0, 7) },
            { weekNumber: 2, theme: 'Next Week', days: days.slice(7, 14) }
        ],
        tasks: []
    };
}

export default function PlanPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [allGoals, setAllGoals] = useState<GoalWithTasks[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Redirect if not authenticated
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        async function loadData() {
            if (!user) return;

            try {
                // 1. Load ALL existing goals from Firestore
                const firestorePlans = await getAllPlans(user.uid).catch((err) => {
                    console.error('getAllPlans error:', err);
                    return [];
                });

                // 2. Load tasks for each Firestore plan
                const firestoreGoals: GoalWithTasks[] = await Promise.all(
                    firestorePlans.map(async (plan) => {
                        const tasks = await getTasksForPlan(user.uid, plan.id).catch(() => []);

                        // Inject tasks into weeks structure
                        const weeksWithTasks = (plan.weeks || []).map((week: any) => ({
                            ...week,
                            days: week.days.map((day: any) => ({
                                ...day,
                                tasks: tasks
                                    .filter(t => t.dayNumber === day.dayNumber)
                                    .map(t => ({
                                        id: t.id,
                                        text: t.text,
                                        completed: t.completed,
                                        type: t.type,
                                        isUserCreated: t.isUserCreated,
                                        goalId: plan.id
                                    }))
                            }))
                        }));

                        return {
                            id: plan.id,
                            title: plan.title,
                            goal: plan.goal,
                            totalDays: plan.totalDays,
                            startDate: plan.startDate?.toDate?.() || new Date(),
                            weeks: weeksWithTasks,
                            tasks: tasks.map(t => ({ ...t, goalId: plan.id })),
                            isNew: false
                        };
                    })
                );

                // 3. Check sessionStorage for a NEW goal being created
                const saved = sessionStorage.getItem(STORAGE_KEY);
                let newGoal: GoalWithTasks | null = null;

                if (saved) {
                    try {
                        const parsed = JSON.parse(saved);
                        if (parsed.planData) {
                            // Create a temporary ID for the new goal (will be replaced by Firestore ID)
                            const tempId = `new-${Date.now()}`;

                            // Inject goalId into all tasks
                            const weeksWithGoalId = (parsed.planData.weeks || []).map((week: any) => ({
                                ...week,
                                days: week.days.map((day: any) => ({
                                    ...day,
                                    tasks: (day.tasks || []).map((task: any) => ({
                                        ...task,
                                        goalId: tempId
                                    }))
                                }))
                            }));

                            newGoal = {
                                id: tempId,
                                title: parsed.planData.title,
                                goal: parsed.goal || '',
                                totalDays: parsed.planData.totalDays,
                                startDate: new Date(),
                                weeks: weeksWithGoalId,
                                tasks: [],
                                isNew: true
                            };
                            console.log('📦 New goal from sessionStorage:', newGoal.title);

                            // Clear sessionStorage after reading - REMOVED to fix persistence issue
                            // sessionStorage.removeItem(STORAGE_KEY);
                        }
                    } catch (e) {
                        console.error('Failed to parse sessionStorage:', e);
                    }
                }

                // 4. Merge: Existing Firestore goals + New goal (if any)
                // Dedupe: Don't add new goal if it already exists in Firestore
                let mergedGoals = firestoreGoals;
                if (newGoal) {
                    // Check if this goal already exists in Firestore (by firestoreId or title match)
                    const saved = sessionStorage.getItem(STORAGE_KEY);
                    let firestoreId: string | null = null;
                    if (saved) {
                        try {
                            const parsed = JSON.parse(saved);
                            firestoreId = parsed.planData?.firestoreId || null;
                        } catch (e) { /* ignore */ }
                    }

                    const isDuplicate = firestoreGoals.some(fg =>
                        (firestoreId && fg.id === firestoreId) ||
                        (fg.title === newGoal.title && fg.goal === newGoal.goal)
                    );

                    if (!isDuplicate) {
                        mergedGoals = [...firestoreGoals, newGoal];
                        console.log('📦 Added new goal to list:', newGoal.title);
                    } else {
                        console.log('📦 Skipping duplicate goal:', newGoal.title);
                        // Clear sessionStorage since it's a duplicate - REMOVED to be safe, but duplicates are handled by logic
                        // sessionStorage.removeItem(STORAGE_KEY);
                    }
                }

                // 5. If no goals at all, create empty plan
                if (mergedGoals.length === 0) {
                    setAllGoals([createEmptyPlan()]);
                } else {
                    setAllGoals(mergedGoals);
                }

                setIsLoading(false);
            } catch (error) {
                console.error('Error loading data:', error);
                setAllGoals([createEmptyPlan()]);
                setIsLoading(false);
            }
        }

        if (user) {
            loadData();
        } else if (!authLoading) {
            setIsLoading(false);
        }
    }, [user, authLoading]);

    if (authLoading || isLoading) {
        return (
            <main className={styles.main}>
                <div className={styles.loadingState}>
                    Loading...
                </div>
            </main>
        );
    }

    // Create a merged view for the calendar (all tasks from all goals)
    const mergedPlan = allGoals.length > 0 ? {
        ...allGoals[0],
        weeks: allGoals[0].weeks.map((week: any, wi: number) => ({
            ...week,
            days: week.days.map((day: any, di: number) => ({
                ...day,
                // Merge tasks from ALL goals for this day
                tasks: allGoals.flatMap(goal =>
                    goal.weeks?.[wi]?.days?.[di]?.tasks || []
                )
            }))
        }))
    } : createEmptyPlan();

    return (
        <main className={styles.main}>
            <PlanDashboard
                plan={mergedPlan}
                allPlans={allGoals}
                goal={allGoals[0]?.goal || ''}
                userId={user?.uid || ''}
                userEmail={user?.email || ''}
                userPhoto={user?.photoURL || undefined}
            />
        </main>
    );
}
