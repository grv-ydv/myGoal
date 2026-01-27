"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './QuickTask.module.css';

interface QuickTaskProps {
    onAddTask: (task: string) => void;
    disabled?: boolean;
}

const SUGGESTED_TASKS = [
    { icon: '💧', text: 'Drink 8 glasses of water' },
    { icon: '🧘', text: '10 min meditation' },
    { icon: '📖', text: 'Read for 30 minutes' },
    { icon: '🏃', text: 'Exercise for 20 minutes' },
    { icon: '🛌', text: 'Sleep by 10 PM' },
];

export default function QuickTask({ onAddTask, disabled }: QuickTaskProps) {
    const [customTask, setCustomTask] = useState('');
    const [showInput, setShowInput] = useState(false);
    const [addedTasks, setAddedTasks] = useState<string[]>([]);

    const handleAddTask = (task: string) => {
        if (addedTasks.includes(task)) return;
        setAddedTasks([...addedTasks, task]);
        onAddTask(task);
    };

    const handleCustomTask = () => {
        if (customTask.trim()) {
            handleAddTask(customTask.trim());
            setCustomTask('');
            setShowInput(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className={styles.wrapper}
        >
            <div className={styles.header}>
                <span className={styles.label}>or add a quick habit</span>
            </div>

            <div className={styles.suggestions}>
                {SUGGESTED_TASKS.map((task, index) => (
                    <button
                        key={index}
                        className={`${styles.chip} ${addedTasks.includes(task.text) ? styles.chipAdded : ''}`}
                        onClick={() => handleAddTask(task.text)}
                        disabled={disabled || addedTasks.includes(task.text)}
                    >
                        <span className={styles.chipIcon}>{task.icon}</span>
                        <span className={styles.chipText}>{task.text}</span>
                        {addedTasks.includes(task.text) && (
                            <span className={styles.checkmark}>✓</span>
                        )}
                    </button>
                ))}

                <button
                    className={styles.addCustom}
                    onClick={() => setShowInput(!showInput)}
                    disabled={disabled}
                >
                    <span>+</span>
                    <span>Custom</span>
                </button>
            </div>

            <AnimatePresence>
                {showInput && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className={styles.customInputWrapper}
                    >
                        <input
                            type="text"
                            className={styles.customInput}
                            placeholder="e.g., Walk 10,000 steps"
                            value={customTask}
                            onChange={(e) => setCustomTask(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCustomTask()}
                            disabled={disabled}
                        />
                        <button
                            className={styles.addBtn}
                            onClick={handleCustomTask}
                            disabled={disabled || !customTask.trim()}
                        >
                            Add
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {addedTasks.length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={styles.addedList}
                >
                    <span className={styles.addedLabel}>Added today:</span>
                    {addedTasks.map((task, i) => (
                        <span key={i} className={styles.addedTask}>{task}</span>
                    ))}
                </motion.div>
            )}
        </motion.div>
    );
}
