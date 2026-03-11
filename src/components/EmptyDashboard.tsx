"use client";

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { createTask, Task } from '@/lib/firestore';
import { withTimeout } from '@/lib/firebase';
import styles from './EmptyDashboard.module.css';

interface EmptyDashboardProps {
    userId: string;
    todaysTasks: Task[];
    onCreateWithAI: () => void;
    onLogout: () => void;
    userEmail: string;
    userPhoto?: string;
}

export default function EmptyDashboard({
    userId,
    todaysTasks: initialTasks,
    onCreateWithAI,
    onLogout,
    userEmail,
    userPhoto
}: EmptyDashboardProps) {
    const [tasks, setTasks] = useState<Task[]>(initialTasks);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newTaskText, setNewTaskText] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);

    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
    });

    const handleAddTask = async () => {
        if (!newTaskText.trim() || isAdding) return;

        const taskText = newTaskText.trim();
        const todayStr = new Date().toISOString().split('T')[0];

        // Optimistic UI update - add task immediately
        const tempTask: Task = {
            id: `temp-${Date.now()}`,
            planId: 'daily-habits',
            dayNumber: 0,
            date: todayStr,
            text: taskText,
            completed: false,
            type: 'task',
            isUserCreated: true,
            createdAt: {} as Task['createdAt'],
            updatedAt: {} as Task['updatedAt'],
        };

        setTasks([...tasks, tempTask]);
        setNewTaskText('');
        setShowAddModal(false);

        // Save to Firestore in background with timeout
        try {
            await withTimeout(createTask(userId, {
                planId: 'daily-habits',
                dayNumber: 0,
                date: todayStr,
                text: taskText,
                completed: false,
                type: 'task',
                isUserCreated: true,
            }), 5000);
        } catch (error) {
            console.error('Failed to save task:', error);
            // Task is still visible in UI (optimistic update)
        }
    };

    const toggleTask = async (taskId: string) => {
        setTasks(tasks.map(t =>
            t.id === taskId ? { ...t, completed: !t.completed } : t
        ));
    };

    const completedCount = tasks.filter(t => t.completed).length;
    const progressPercent = tasks.length > 0 ? (completedCount / tasks.length) * 100 : 0;

    return (
        <div className={styles.dashboard}>
            {/* Header */}
            <header className={styles.header}>
                <div className={styles.headerLeft}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" />
                    </svg>
                    <span className={styles.logo}>myGoal</span>
                </div>

                <div className={styles.userMenu}>
                    <button
                        className={styles.userButton}
                        onClick={() => setShowUserMenu(!showUserMenu)}
                    >
                        <div className={styles.userAvatar}>
                            {userPhoto ? (
                                <Image src={userPhoto} alt="" width={32} height={32} />
                            ) : (
                                <span>{(userEmail || 'U')[0].toUpperCase()}</span>
                            )}
                        </div>
                    </button>
                    {showUserMenu && (
                        <div className={styles.userDropdown}>
                            <div className={styles.userEmail}>{userEmail}</div>
                            <button onClick={onLogout} className={styles.logoutBtn}>
                                Sign Out
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Date Display */}
            <div className={styles.dateDisplay}>
                <h1 className={styles.greeting}>Good {getTimeOfDay()}</h1>
                <p className={styles.date}>{formattedDate}</p>
            </div>

            {/* Action Buttons */}
            <div className={styles.actionButtons}>
                <button
                    className={styles.addManuallyBtn}
                    onClick={() => setShowAddModal(true)}
                >
                    <span className={styles.btnIcon}>+</span>
                    Add Manually
                </button>

                <button
                    className={styles.createWithAIBtn}
                    onClick={onCreateWithAI}
                >
                    <span className={styles.btnIcon}>✨</span>
                    Create with AI
                </button>
            </div>

            {/* Today's Tasks */}
            <div className={styles.tasksSection}>
                <div className={styles.sectionHeader}>
                    <h2 className={styles.sectionTitle}>Today&apos;s Tasks</h2>
                    {tasks.length > 0 && (
                        <span className={styles.taskCount}>
                            {completedCount}/{tasks.length}
                        </span>
                    )}
                </div>

                {tasks.length > 0 && (
                    <div className={styles.progressBar}>
                        <div
                            className={styles.progressFill}
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                )}

                <div className={styles.taskList}>
                    {tasks.length === 0 ? (
                        <div className={styles.emptyState}>
                            <p>No tasks for today</p>
                            <p className={styles.emptyHint}>
                                Add a task manually or create a goal with AI
                            </p>
                        </div>
                    ) : (
                        tasks.map(task => (
                            <div
                                key={task.id}
                                className={`${styles.taskCard} ${task.completed ? styles.completed : ''}`}
                            >
                                <div
                                    className={styles.checkbox}
                                    onClick={() => toggleTask(task.id)}
                                >
                                    {task.completed && <span>✓</span>}
                                </div>
                                <span className={styles.taskText}>{task.text}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Add Task Modal */}
            <AnimatePresence>
                {showAddModal && (
                    <motion.div
                        className={styles.modalOverlay}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowAddModal(false)}
                    >
                        <motion.div
                            className={styles.modal}
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <h3 className={styles.modalTitle}>Add Task</h3>
                            <input
                                type="text"
                                className={styles.modalInput}
                                placeholder="e.g., Drink 8 glasses of water"
                                value={newTaskText}
                                onChange={e => setNewTaskText(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleAddTask()}
                                autoFocus
                            />
                            <div className={styles.modalActions}>
                                <button
                                    className={styles.cancelBtn}
                                    onClick={() => setShowAddModal(false)}
                                >
                                    Cancel
                                </button>
                                <button
                                    className={styles.addBtn}
                                    onClick={handleAddTask}
                                    disabled={!newTaskText.trim() || isAdding}
                                >
                                    {isAdding ? 'Adding...' : 'Add Task'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function getTimeOfDay() {
    const hour = new Date().getHours();
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
}
