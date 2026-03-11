"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import * as firestoreService from '@/lib/firestore';
import AddTaskModal from './AddTaskModal';
import styles from './PlanDashboard.module.css';

interface Task {
    id: string;
    text: string;
    completed: boolean;
    type?: 'task' | 'note';
    isUserCreated?: boolean;
    repeat?: string;
    goalId?: string | null;
}

interface Goal {
    id: string;
    title: string;
    tasks: Task[];
    progress?: number;
}

interface Day {
    dayNumber: number;
    focus?: string;
    tasks: Task[];
}

interface Week {
    weekNumber: number;
    theme: string;
    days: Day[];
}

interface PlanResult {
    title: string;
    totalDays: number;
    weeks: Week[];
    goals?: Goal[];
}

interface PlanDashboardProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plan: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    allPlans?: any[];  // All user's plans for multi-goal support
    goal: string;
    userId: string;
    userEmail?: string;
    userPhoto?: string;
}

const QUOTES = [
    "The journey of a thousand miles begins with a single step.",
    "Believe you can and you're halfway there.",
    "It does not matter how slowly you go as long as you do not stop.",
    "Your limitation—it's only your imagination.",
];





const PLAN_STORAGE_KEY = 'myGoal_planState';

export default function PlanDashboard({ plan: initialPlan, allPlans = [], goal, userId, userEmail, userPhoto }: PlanDashboardProps) {
    const router = useRouter();
    const { logout } = useAuth();
    const [showProfileMenu, setShowProfileMenu] = useState(false);

    console.log('📊 [PlanDashboard] Rendered with plan:', initialPlan?.title, 'ID:', initialPlan?.id);
    console.log('📊 [PlanDashboard] Week 1 Day 1 Tasks:', initialPlan?.weeks?.[0]?.days?.[0]?.tasks?.length);

    // Initialize goals from allPlans (Firestore) with actual task counts from initialPlan
    const [goals, setGoals] = useState<Goal[]>(() => {
        // If we have multiple plans from Firestore, use them as goals
        if (allPlans && allPlans.length > 0) {
            // Get all tasks from the merged plan structure
            const allTasks: Task[] = initialPlan.weeks?.flatMap((w: Week) =>
                w.days.flatMap((d: Day) => d.tasks)
            ) || [];

            return allPlans.map(plan => {
                // Count tasks belonging to this goal
                const goalTasks = allTasks.filter(t => t.goalId === plan.id);
                const completedTasks = goalTasks.filter(t => t.completed);
                const progress = goalTasks.length > 0
                    ? Math.round((completedTasks.length / goalTasks.length) * 100)
                    : 0;

                return {
                    id: plan.id,
                    title: plan.title || plan.goal || 'Untitled Goal',
                    tasks: goalTasks,
                    progress
                };
            });
        }
        // Fallback to initialPlan structure
        if (initialPlan.goals && initialPlan.goals.length > 0) {
            return initialPlan.goals;
        }
        return [{
            id: 'main-goal',
            title: initialPlan.title || 'My Goal',
            tasks: [],
            progress: 0
        }];
    });


    // Multi-select: 'all' means show all goals, or specific goal IDs
    const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>(['all']);

    // Use initialPlan for initial data - sessionStorage is ONLY for preserving user edits during the session
    const [currentPlan, setCurrentPlan] = useState<PlanResult>(() => {
        // If initialPlan has actual data (weeks with tasks), use it
        const hasRealData = initialPlan?.weeks?.some((w: Week) =>
            w.days?.some((d: Day) => d.tasks?.length > 0)
        );

        if (hasRealData || initialPlan?.id?.startsWith('new')) {
            console.log('📦 [PlanDashboard] Using initialPlan from props:', initialPlan?.title);
            // Clear any stale sessionStorage
            if (typeof window !== 'undefined') {
                sessionStorage.removeItem(PLAN_STORAGE_KEY);
            }
            return initialPlan;
        }

        // Only use sessionStorage for resuming user edits within same session
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem(PLAN_STORAGE_KEY);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Only use if it has actual data
                    if (parsed?.weeks?.some((w: Week) => w.days?.some((d: Day) => d.tasks?.length > 0))) {
                        console.log('📦 Using plan from sessionStorage');
                        return parsed;
                    }
                } catch (e) {
                    console.error('Failed to parse plan from sessionStorage:', e);
                }
            }
        }
        return initialPlan;
    });
    // Start in 'daily' mode for empty plans, 'review' for newly generated plans
    const isEmptyPlan = initialPlan?.id === 'empty';
    const [viewMode, setViewMode] = useState<'review' | 'daily'>(isEmptyPlan ? 'daily' : 'review');
    const [feedback, setFeedback] = useState("");
    const [isModifying, setIsModifying] = useState(false);

    // Daily Mode State
    const [selectedDayNum, setSelectedDayNum] = useState(1);
    const [startDate] = useState(new Date());
    const [weather, setWeather] = useState<'sunny' | 'cloudy' | 'rain' | null>(null);
    const [newUserTask, setNewUserTask] = useState("");
    const [quote, setQuote] = useState(QUOTES[0]);

    // New state for Task vs Note selector
    const [newItemType, setNewItemType] = useState<'task' | 'note'>('note');
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);

    // Add Goal Modal state
    const [showAddGoalModal, setShowAddGoalModal] = useState(false);
    const [newGoalInput, setNewGoalInput] = useState('');
    const [isCreatingGoal, setIsCreatingGoal] = useState(false);

    // Editing state
    const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
    const [editingText, setEditingText] = useState("");

    // AI Chat in Daily View
    const [dailyChatInput, setDailyChatInput] = useState("");
    const [isAiProcessing, setIsAiProcessing] = useState(false);

    useEffect(() => {
        // Random quote on mount
        setQuote(QUOTES[Math.floor(Math.random() * QUOTES.length)]);
    }, []);

    // Save plan to sessionStorage whenever it changes
    useEffect(() => {
        sessionStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(currentPlan));
    }, [currentPlan]);

    // Update goals progress whenever tasks in currentPlan change
    useEffect(() => {
        if (allPlans && allPlans.length > 0) {
            const allTasks: Task[] = currentPlan.weeks?.flatMap((w: Week) =>
                w.days.flatMap((d: Day) => d.tasks)
            ) || [];

            setGoals(prevGoals => prevGoals.map(goal => {
                const goalTasks = allTasks.filter(t => t.goalId === goal.id);
                const completedTasks = goalTasks.filter(t => t.completed);
                const progress = goalTasks.length > 0
                    ? Math.round((completedTasks.length / goalTasks.length) * 100)
                    : 0;

                return {
                    ...goal,
                    tasks: goalTasks,
                    progress
                };
            }));
        }
    }, [currentPlan, allPlans]);

    // Handle pending quick task from home page
    useEffect(() => {
        const pendingTask = sessionStorage.getItem('myGoal_pendingQuickTask');
        if (pendingTask) {
            const newTask: Task = {
                id: `q-${Date.now()}`,
                text: pendingTask,
                completed: false,
                type: 'task',
                isUserCreated: true
            };

            setCurrentPlan(prev => {
                const newWeeks = prev.weeks.map((week, wIndex) => {
                    if (wIndex === 0) {
                        return {
                            ...week,
                            days: week.days.map((day, dIndex) => {
                                if (dIndex === 0) { // Add to Today (Day 1)
                                    // Avoid duplicates
                                    if (day.tasks.some(t => t.text === pendingTask)) return day;
                                    return {
                                        ...day,
                                        tasks: [...day.tasks, newTask]
                                    };
                                }
                                return day;
                            })
                        };
                    }
                    return week;
                });
                return { ...prev, weeks: newWeeks };
            });

            sessionStorage.removeItem('myGoal_pendingQuickTask');
            setViewMode('daily'); // Ensure we are in daily view
        }
    }, []);

    // Helper to get flat list of days for Calendar Strip
    const allDaysFlat = currentPlan.weeks.flatMap(w => w.days);

    // Helper to calculate real date from day number
    const getDateForDay = (dayNum: number): Date => {
        const date = new Date(startDate);
        date.setDate(date.getDate() + dayNum - 1);
        return date;
    };

    // Format date for display
    const formatDate = (date: Date): { weekday: string; day: number; month: string } => ({
        weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
        day: date.getDate(),
        month: date.toLocaleDateString('en-US', { month: 'short' })
    });



    const handleModifyPlan = async () => {
        if (!feedback.trim()) return;
        setIsModifying(true);
        try {
            const response = await fetch('/api/modify-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: currentPlan, feedback }),
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            setCurrentPlan(data);
            setFeedback("");
        } catch (e) {
            console.error(e);
            alert("Failed to modify plan");
        } finally {
            setIsModifying(false);
        }
    };

    // Unified Task Updates
    const updateTask = async (taskId: string, updates: Partial<Task>) => {
        // Optimistic update
        const newPlan = { ...currentPlan };
        let taskUpdated = false;

        for (const week of newPlan.weeks) {
            for (const day of week.days) {
                const taskIndex = day.tasks.findIndex(t => t.id === taskId);
                if (taskIndex > -1) {
                    day.tasks[taskIndex] = { ...day.tasks[taskIndex], ...updates };
                    taskUpdated = true;
                    // Persist to Firestore
                    if (userId) {
                        firestoreService.updateTask(userId, taskId, updates).catch(err =>
                            console.error("Failed to auto-save task update:", err)
                        );
                    }
                    break;
                }
            }
            if (taskUpdated) break;
        }

        if (taskUpdated) setCurrentPlan(newPlan);
    };

    const addTask = async () => {
        if (!newUserTask.trim() || !selectedDayNum) return;

        // If "All Goals" is selected and we have multiple goals, we don't know which goal to add to.
        // Default to the first one or alert?
        // Better: Find the goal that matches the current context or ask user?
        // Simple fix: If 'all' selected, use the first goal's ID.
        let targetGoalId = (goals.length > 0) ? goals[0].id : null;
        if (!selectedGoalIds.includes('all') && selectedGoalIds.length > 0) {
            targetGoalId = selectedGoalIds[0];
        }

        if (!targetGoalId) {
            alert("Please create a goal first");
            return;
        }

        // Create task object for UI (optimistic)
        // We need a temp ID first, but if we save immediately we might get real ID fast.
        // Let's create in Firestore first to get valid ID.

        const dDate = getDateForDay(selectedDayNum);
        const dDateStr = dDate.toISOString().split('T')[0];

        try {
            const tempId = `temp-${Date.now()}`;
            const optimisticTask: Task = {
                id: tempId,
                text: newUserTask,
                completed: false,
                type: newItemType,
                isUserCreated: true,
                goalId: targetGoalId,
                // These fields needed for UI but might not be in Task interface fully depending on definition
                // PlanDashboard defines Task interface at top, let's match it.
            };

            // Calculate date/dayNumber
            // Note: firestoreService.createTask needs specific fields

            if (userId) {
                const savedTask = await firestoreService.createTask(userId, {
                    planId: targetGoalId, // Mapping goalId to planId as per backend refactor
                    dayNumber: selectedDayNum,
                    date: dDateStr,
                    text: newUserTask,
                    completed: false,
                    type: newItemType,
                    isUserCreated: true
                });

                // Use the saved task with real ID
                const newTask: Task = {
                    ...optimisticTask,
                    id: savedTask.id,
                    goalId: targetGoalId // Ensure this is preserved
                };

                const newPlan = { ...currentPlan };
                // Find day object in UI plan
                // note: UI plan might be merged. We just need to add to the correct day bucket in UI.
                for (const week of newPlan.weeks) {
                    const day = week.days.find(d => d.dayNumber === selectedDayNum);
                    if (day) {
                        day.tasks.push(newTask);
                        setCurrentPlan(newPlan);
                        setNewUserTask("");
                        setShowTypeDropdown(false);
                        return;
                    }
                }
            } else {
                // Offline/Demo mode - just update state
                const newTask: Task = {
                    id: `u-${Date.now()}`,
                    text: newUserTask,
                    completed: false,
                    type: newItemType,
                    isUserCreated: true,
                    goalId: targetGoalId
                };
                const newPlan = { ...currentPlan };
                for (const week of newPlan.weeks) {
                    const day = week.days.find(d => d.dayNumber === selectedDayNum);
                    if (day) {
                        day.tasks.push(newTask);
                        setCurrentPlan(newPlan);
                        setNewUserTask("");
                        setShowTypeDropdown(false);
                        return;
                    }
                }
            }

        } catch (e) {
            console.error("Failed to add task:", e);
            alert("Failed to save task");
        }
    };

    const deleteTask = (taskId: string) => {
        // Optimistic delete
        const newPlan = { ...currentPlan };
        newPlan.weeks.forEach(w => w.days.forEach(d => {
            d.tasks = d.tasks.filter(t => t.id !== taskId);
        }));
        setCurrentPlan(newPlan);

        // Persist
        if (userId) {
            firestoreService.deleteTask(userId, taskId).catch(err =>
                console.error("Failed to delete task:", err)
            );
        }
    };

    // Start editing a task
    const startEdit = (task: Task) => {
        setEditingTaskId(task.id);
        setEditingText(task.text);
    };

    // Save edited task
    const saveEdit = () => {
        if (editingTaskId && editingText.trim()) {
            updateTask(editingTaskId, { text: editingText });
        }
        setEditingTaskId(null);
        setEditingText("");
    };

    // Handle AI chat in daily view
    const handleModalAdd = async (taskData: { title: string; note: string; date: string; time?: string; urgent?: boolean; type: 'task' | 'note'; repeat?: string }) => {
        // Similar logic to addTask but with more fields
        // Simplified for brevity - assumes goalId logic

        let targetGoalId = (goals.length > 0) ? goals[0].id : 'main';
        if (!selectedGoalIds.includes('all') && selectedGoalIds.length > 0) {
            targetGoalId = selectedGoalIds[0];
        }

        const text = taskData.title + (taskData.note ? `\n${taskData.note}` : '');

        if (userId) {
            const savedTask = await firestoreService.createTask(userId, {
                planId: targetGoalId,
                dayNumber: selectedDayNum, // Note: taskData.date logic needed mapping back to dayNumber if complex
                // simple mapping for now assuming added to current view's day or recalculated
                date: taskData.date,
                text: text,
                completed: false,
                type: taskData.type,
                isUserCreated: true
            });

            const newTask: Task = {
                id: savedTask.id,
                text,
                completed: false,
                type: taskData.type,
                isUserCreated: true,
                repeat: taskData.repeat,
                goalId: targetGoalId
            };

            setCurrentPlan(prev => {
                const newWeeks = prev.weeks.map(week => ({
                    ...week,
                    days: week.days.map(day => {
                        const dDate = getDateForDay(day.dayNumber);
                        const dDateStr = dDate.toISOString().split('T')[0];
                        if (dDateStr === taskData.date) {
                            return { ...day, tasks: [...day.tasks, newTask] };
                        }
                        return day;
                    })
                }));
                return { ...prev, weeks: newWeeks };
            });
        }

        setShowAddModal(false);
    };

    const handleDailyChat = async () => {
        if (!dailyChatInput.trim()) return;

        if (selectedGoalIds.includes('all') && goals.length > 1) {
            alert("Please select a specific goal to modify with AI.");
            return;
        }

        setIsAiProcessing(true);
        try {
            const response = await fetch('/api/modify-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan: currentPlan, feedback: dailyChatInput }),
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error);

            // Validate data structure
            if (!data.weeks) throw new Error("Invalid plan data returned");

            setCurrentPlan(data);
            setDailyChatInput("");

            // Auto-save the modified plan
            if (userId) {
                // Determine which plan ID to save to
                // If we are here, we are not on 'all' goals OR we only have 1 goal
                const targetGoalId = currentPlan.goals?.[0]?.id || (goals.length > 0 ? goals[0].id : null);
                // If the returned plan doesn't have ID, inject it

                // Reuse save_goal logic
                // We need to pass the plan object. 'data' is the plan object (PlanResult).
                // We need title, goal name etc.
                const goalTitle = data.goal || data.title || 'Updated Goal';
                await firestoreService.save_goal(userId, { ...data, id: targetGoalId }, goalTitle);
                console.log("Auto-saved modified plan");
            }

        } catch (e) {
            console.error(e);
            alert("Failed to modify plan");
        } finally {
            setIsAiProcessing(false);
        }
    };

    // Get current day object
    const activeDayObj = allDaysFlat.find(d => d.dayNumber === selectedDayNum);

    // Helper to check if a goal is selected
    const isGoalSelected = (goalId: string) =>
        selectedGoalIds.includes('all') || selectedGoalIds.includes(goalId);

    // Helper to toggle goal selection
    const toggleGoalSelection = (goalId: string) => {
        setSelectedGoalIds(prev => {
            if (goalId === 'all') {
                return ['all'];
            }
            // Remove 'all' if selecting specific goal
            const withoutAll = prev.filter(id => id !== 'all');
            if (withoutAll.includes(goalId)) {
                // Deselect - if last one, select all
                const newSelection = withoutAll.filter(id => id !== goalId);
                return newSelection.length === 0 ? ['all'] : newSelection;
            } else {
                return [...withoutAll, goalId];
            }
        });
    };

    // Filter tasks based on selected goals
    const getFilteredTasks = (tasks: Task[]) => {
        if (selectedGoalIds.includes('all')) return tasks;
        return tasks.filter(t => t.goalId && selectedGoalIds.includes(t.goalId));
    };

    return (
        <div className={styles.dashboardFixed}>
            {/* Sidebar */}
            <div className={styles.sidebarFixed}>
                <div className={styles.sidebarTitleFixed}>Goal Library</div>
                <div className={styles.goalListFixed}>
                    {/* All Goals Toggle */}
                    <div
                        className={`${styles.goalItem} ${selectedGoalIds.includes('all') ? styles.selectedGoal : ''}`}
                        onClick={() => toggleGoalSelection('all')}
                    >
                        <div className={styles.goalFill} style={{ width: '100%', opacity: 0.3 }} />
                        <div className={styles.goalContent}>
                            <span>📋 All Goals</span>
                            <span className={styles.goalPercent}>{goals.length}</span>
                        </div>
                    </div>

                    {/* Individual Goals */}
                    {goals.map(g => (
                        <div
                            key={g.id}
                            className={`${styles.goalItem} ${isGoalSelected(g.id) && !selectedGoalIds.includes('all') ? styles.selectedGoal : ''}`}
                            onClick={() => toggleGoalSelection(g.id)}
                        >
                            <div
                                className={styles.goalFill}
                                style={{ width: `${g.progress || 0}%` }}
                            />
                            <div className={styles.goalContent}>
                                <span>{g.title}</span>
                                <span className={styles.goalPercent}>{g.progress}%</span>
                            </div>
                        </div>
                    ))}
                </div>

                <div className={styles.addGoalWrapper}>
                    <button
                        className={styles.addGoalBtn}
                        onClick={() => setShowAddGoalModal(true)}
                    >
                        <span>+</span> New Goal
                    </button>
                </div>
            </div>

            {/* Add Goal Modal */}
            {showAddGoalModal && (
                <div className={styles.modalOverlay} onClick={() => setShowAddGoalModal(false)}>
                    <div className={styles.addGoalModal} onClick={e => e.stopPropagation()}>
                        <h3>Create New Goal</h3>
                        <p>What goal would you like to achieve?</p>
                        <input
                            type="text"
                            className={styles.addGoalInput}
                            placeholder="e.g., Learn Guitar, Get Fit, Learn Spanish..."
                            value={newGoalInput}
                            onChange={(e) => setNewGoalInput(e.target.value)}
                            autoFocus
                        />
                        <div className={styles.addGoalActions}>
                            <button
                                className={styles.cancelBtn}
                                onClick={() => { setShowAddGoalModal(false); setNewGoalInput(''); }}
                            >
                                Cancel
                            </button>
                            <button
                                className={styles.createGoalBtn}
                                disabled={!newGoalInput.trim() || isCreatingGoal}
                                onClick={async () => {
                                    if (!newGoalInput.trim()) return;
                                    setIsCreatingGoal(true);
                                    // Navigate to home with the goal pre-filled
                                    sessionStorage.setItem('pendingGoal', newGoalInput.trim());
                                    router.push('/');
                                }}
                            >
                                {isCreatingGoal ? 'Creating...' : 'Create with AI'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={styles.mainContent}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`${styles.dashboard} ${viewMode === 'review' ? styles.reviewModePadded : ''}`}
                >

                    {viewMode === 'daily' ? (
                        /* ================= DAILY VIEW ================= */
                        <motion.div
                            key="daily"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            {/* Header */}
                            <div className={styles.headerDaily}>
                                <div className={styles.logoDaily}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" />
                                    </svg>
                                    myGoal
                                </div>
                                <div className={styles.headerRight}>
                                    <div className={styles.dateWeatherContainer}>
                                        <div className={styles.currentDate}>
                                            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                                        </div>
                                        <div className={styles.weatherWidget}>
                                            <div
                                                className={`${styles.weatherIcon} ${weather === 'sunny' ? styles.selected : ''}`}
                                                onClick={() => setWeather('sunny')}
                                                title="Sunny"
                                            >☀️</div>
                                            <div
                                                className={`${styles.weatherIcon} ${weather === 'cloudy' ? styles.selected : ''}`}
                                                onClick={() => setWeather('cloudy')}
                                                title="Cloudy"
                                            >☁️</div>
                                            <div
                                                className={`${styles.weatherIcon} ${weather === 'rain' ? styles.selected : ''}`}
                                                onClick={() => setWeather('rain')}
                                                title="Rain"
                                            >🌧️</div>
                                        </div>
                                    </div>
                                    <div className={styles.profileSection}>
                                        <button
                                            className={styles.profileButton}
                                            onClick={() => setShowProfileMenu(!showProfileMenu)}
                                        >
                                            {userPhoto ? (
                                                <img src={userPhoto} alt="Profile" className={styles.profileImage} />
                                            ) : (
                                                <div className={styles.profileAvatar}>
                                                    {(userEmail || 'U')[0].toUpperCase()}
                                                </div>
                                            )}
                                        </button>
                                        {showProfileMenu && (
                                            <div className={styles.profileDropdown}>
                                                <div className={styles.profileDropdownHeader}>
                                                    <span className={styles.profileEmail}>{userEmail}</span>
                                                </div>
                                                <button
                                                    className={styles.profileMenuItem}
                                                    onClick={() => { router.push('/profile'); setShowProfileMenu(false); }}
                                                >
                                                    👤 View Profile
                                                </button>
                                                <button
                                                    className={styles.profileMenuItem}
                                                    onClick={() => { logout(); setShowProfileMenu(false); }}
                                                >
                                                    🚪 Sign Out
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Calendar Strip */}
                            <div className={styles.calendarStrip}>
                                {allDaysFlat.map((day) => {
                                    const dateInfo = formatDate(getDateForDay(day.dayNumber));
                                    return (
                                        <div
                                            key={day.dayNumber}
                                            className={`${styles.calendarDay} ${day.dayNumber === selectedDayNum ? styles.active : ''}`}
                                            onClick={() => setSelectedDayNum(day.dayNumber)}
                                        >
                                            <span className={styles.dayLabel}>{dateInfo.weekday}</span>
                                            <div className={styles.dateCircle}>{dateInfo.day}</div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Daily Progress Bar */}
                            {activeDayObj && (
                                <div className={styles.dailyProgressContainer}>
                                    <div className={styles.contextLabel}>
                                        Showing tasks for: <strong>{selectedGoalIds.includes('all') ? 'All Goals' : goals.filter(g => selectedGoalIds.includes(g.id)).map(g => g.title).join(', ') || 'Goal'}</strong>
                                    </div>
                                    <div className={styles.dailyProgressBar} style={{ maxWidth: '400px' }}>
                                        <div
                                            className={styles.dailyProgressFill}
                                            style={{
                                                width: `${(() => {
                                                    const filtered = getFilteredTasks(activeDayObj?.tasks || []);
                                                    return filtered.length > 0
                                                        ? (filtered.filter(t => t.completed).length / filtered.length) * 100
                                                        : 0;
                                                })()}%`
                                            }}
                                        />
                                    </div>
                                    <div className={styles.dailyProgressText}>
                                        {(() => {
                                            const filteredTasks = getFilteredTasks(activeDayObj?.tasks || []);
                                            const completedCount = filteredTasks.filter(t => t.completed).length;
                                            const totalCount = filteredTasks.length;
                                            return totalCount > 0 ? `${completedCount} of ${totalCount}` : '0 of 0';
                                        })()}
                                    </div>
                                </div>
                            )}

                            {/* Today's Tasks */}
                            <h2 className={styles.sectionTitle}>Today&apos;s Focus</h2>

                            <div className={styles.taskList}>
                                {getFilteredTasks(activeDayObj?.tasks || []).filter(t => t.type !== 'note').map(task => (
                                    <div
                                        key={task.id}
                                        className={`${styles.taskCard} ${task.completed ? styles.completed : ''}`}
                                    >
                                        <div
                                            className={styles.checkbox}
                                            onClick={() => updateTask(task.id, { completed: !task.completed })}
                                        >
                                            {task.completed && <span>✓</span>}
                                        </div>
                                        {editingTaskId === task.id ? (
                                            <input
                                                className={styles.editInput}
                                                value={editingText}
                                                onChange={(e) => setEditingText(e.target.value)}
                                                onBlur={saveEdit}
                                                onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                                autoFocus
                                            />
                                        ) : (
                                            <p
                                                className={styles.taskText}
                                                onDoubleClick={() => startEdit(task)}
                                            >
                                                {task.text}
                                            </p>
                                        )}
                                        <button
                                            className={styles.deleteBtn}
                                            onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }}
                                            title="Delete task"
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                                {!getFilteredTasks(activeDayObj?.tasks || []).filter(t => t.type !== 'note').length && (
                                    <p className={styles.emptyState}>No tasks scheduled for today.</p>
                                )}
                            </div>

                            {/* Notes Section */}
                            {getFilteredTasks(activeDayObj?.tasks || []).some(t => t.type === 'note') && (
                                <>
                                    <h3 className={styles.notesTitle}>📝 Notes</h3>
                                    <div className={styles.notesList}>
                                        {getFilteredTasks(activeDayObj?.tasks || []).filter(t => t.type === 'note').map(note => (
                                            <div key={note.id} className={styles.noteCard}>
                                                {editingTaskId === note.id ? (
                                                    <input
                                                        className={styles.editInput}
                                                        value={editingText}
                                                        onChange={(e) => setEditingText(e.target.value)}
                                                        onBlur={saveEdit}
                                                        onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <p onDoubleClick={() => startEdit(note)}>{note.text}</p>
                                                )}
                                                <button
                                                    className={styles.deleteBtn}
                                                    onClick={() => deleteTask(note.id)}
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}

                            {/* Add Note Section */}
                            <div className={styles.addItemSection}>
                                <input
                                    className={styles.addItemInput}
                                    placeholder="Add a note..."
                                    value={newUserTask}
                                    onChange={(e) => setNewUserTask(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addTask()}
                                />
                                <button className={styles.mediaBtn} title="Add media">
                                    +
                                </button>
                            </div>

                            {/* Footer Quote */}
                            <div className={styles.footerQuote}>
                                &ldquo;{quote}&rdquo;
                            </div>

                            {/* AI Chat Bar - Fixed at bottom */}
                            <div className={styles.dailyChatBar}>
                                {isAiProcessing && (
                                    <div className={styles.aiProcessing}>AI is updating your plan...</div>
                                )}
                                <button
                                    className={styles.addManualTaskBtn}
                                    onClick={() => setShowAddModal(true)}
                                >
                                    +
                                </button>
                                <div className={styles.chatInputWrapper}>
                                    <span className={styles.chatIcon}>✨</span>
                                    <input
                                        className={styles.chatInput}
                                        placeholder="Ask AI to modify your plan..."
                                        value={dailyChatInput}
                                        onChange={(e) => setDailyChatInput(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleDailyChat()}
                                        disabled={isAiProcessing}
                                    />
                                    {dailyChatInput.trim() && (
                                        <button
                                            className={styles.chatSendBtn}
                                            onClick={handleDailyChat}
                                            disabled={isAiProcessing}
                                        >
                                            Send
                                        </button>
                                    )}
                                </div>
                                <button
                                    className={styles.createPlanBtn}
                                    onClick={() => router.push('/')}
                                >
                                    ✨ Create Plan with AI
                                </button>
                            </div>

                        </motion.div>
                    ) : (
                        /* ================= REVIEW VIEW ================= */
                        <motion.div
                            key="review"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={styles.reviewList}
                        >
                            {/* Simple Header for Review Mode */}
                            <div className="flex justify-between items-center mb-8">
                                <span className={styles.statusBadge}>Reviewing Plan</span>
                            </div>

                            {currentPlan.weeks.map(week => (
                                <div key={week.weekNumber} className={styles.weekBlock}>
                                    <h3 className={styles.weekTitle}>Week {week.weekNumber}</h3>
                                    <p className={styles.weekTheme}>{week.theme}</p>

                                    {week.days.map(day => {
                                        const dateInfo = formatDate(getDateForDay(day.dayNumber));
                                        return (
                                            <div key={day.dayNumber} className={styles.dayBlock}>
                                                <div className={styles.dayTitle}>
                                                    {dateInfo.weekday}, {dateInfo.month} {dateInfo.day}
                                                    {day.focus && ` — ${day.focus}`}
                                                </div>
                                                <div className={styles.dayTasks}>
                                                    {day.tasks.map(t => (
                                                        <div key={t.id} className={styles.miniTask}>• {t.text}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ))}

                            {/* Bottom Interaction Bar */}
                            <div className={styles.bottomBar}>
                                {isModifying && (
                                    <div className={styles.loadingOverlay}>Updating plan with AI...</div>
                                )}
                                <div className={styles.inputWrapper}>
                                    <span style={{ marginRight: '8px' }}>✨</span>
                                    <input
                                        className={styles.aiInput}
                                        placeholder="Suggest changes (e.g. 'remove weekends')"
                                        value={feedback}
                                        onChange={(e) => setFeedback(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleModifyPlan()}
                                    />
                                </div>
                                {feedback.trim() ? (
                                    <button className={`${styles.actionButton} ${styles.changeBtn}`} onClick={handleModifyPlan}>
                                        Change
                                    </button>
                                ) : (
                                    <button className={`${styles.actionButton} ${styles.continueBtn}`} onClick={() => setViewMode('daily')}>
                                        Continue
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    )
                    }

                    <AnimatePresence>
                        {showAddModal && (
                            <AddTaskModal
                                isOpen={showAddModal}
                                onClose={() => setShowAddModal(false)}
                                onAdd={handleModalAdd}
                            />
                        )}
                    </AnimatePresence>

                </motion.div >
            </div>
        </div>
    );
}
