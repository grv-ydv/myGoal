"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './AddTaskModal.module.css';

interface AddTaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAdd: (task: { title: string; note: string; date: string; time?: string; urgent?: boolean; type: 'task' | 'note'; repeat?: string }) => void;
}

export default function AddTaskModal({ isOpen, onClose, onAdd }: AddTaskModalProps) {
    const [title, setTitle] = useState('');
    const [note, setNote] = useState('');
    const [url, setUrl] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('09:00');
    const [isTimeEnabled, setIsTimeEnabled] = useState(false);
    const [isUrgent, setIsUrgent] = useState(false);
    const [repeat, setRepeat] = useState('Never');
    const [showRepeatMenu, setShowRepeatMenu] = useState(false);
    const [type, setType] = useState<'task' | 'note'>('task');

    // Reset form when opening
    useEffect(() => {
        if (isOpen) {
            const resetForm = () => {
                setDate(new Date().toISOString().split('T')[0]);
                setTitle('');
                setNote('');
                setUrl('');
                setIsTimeEnabled(false);
                setIsUrgent(false);
                setRepeat('Never');
                setShowRepeatMenu(false);
            };
            resetForm();
        }
    }, [isOpen]);

    const handleSave = () => {
        if (!title.trim()) return;

        const fullNote = note + (url ? `\n\nURL: ${url}` : '');

        onAdd({
            title,
            note: fullNote,
            date,
            time: isTimeEnabled ? time : undefined,
            urgent: isUrgent,
            type,
            repeat: repeat !== 'Never' ? repeat : undefined
        });

        onClose();
    };

    // Prevent propagation for overlay click
    const handleOverlayClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    // Animation variants
    const modalVariants = {
        hidden: { y: '100%', opacity: 0 },
        visible: { y: 0, opacity: 1 },
        exit: { y: '100%', opacity: 0 }
    };

    return (
        <div className={styles.overlay} onClick={handleOverlayClick}>
            <motion.div
                className={styles.modal}
                variants={modalVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            >
                <div className={styles.header}>
                    <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
                    <span className={styles.headerTitle}>New Task</span>
                    <button
                        className={styles.saveBtn}
                        onClick={handleSave}
                        disabled={!title.trim()}
                    >
                        Done
                    </button>
                </div>

                <div className={styles.content}>
                    {/* Title & Note */}
                    <div className={styles.formGroup}>
                        <div className={styles.field}>
                            <input
                                className={styles.input}
                                placeholder="Title"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className={styles.field}>
                            <textarea
                                className={styles.textarea}
                                placeholder="Notes"
                                value={note}
                                onChange={e => setNote(e.target.value)}
                            />
                        </div>
                        <div className={styles.field}>
                            <input
                                className={styles.input}
                                placeholder="URL"
                                value={url}
                                onChange={e => setUrl(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Date & Time */}
                    <span className={styles.headerTitle} style={{ fontSize: '0.85rem', marginLeft: '0.5rem', color: '#666', textTransform: 'uppercase' }}>Date & Time</span>
                    <div className={styles.formGroup}>
                        <div className={styles.field}>
                            <span className={styles.rowLabel}>Date</span>
                            <div className={styles.rowValue}>
                                <input
                                    type="date"
                                    className={styles.dateInput}
                                    value={date}
                                    onChange={e => setDate(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className={styles.field}>
                            <span className={styles.rowLabel}>Time</span>
                            <div className={styles.rowValue}>
                                <label className={styles.switch}>
                                    <input type="checkbox" checked={isTimeEnabled} onChange={e => setIsTimeEnabled(e.target.checked)} />
                                    <span className={styles.slider}></span>
                                </label>
                            </div>
                        </div>
                        {isTimeEnabled && (
                            <div className={styles.field}>
                                <span className={styles.rowLabel}></span>
                                <div className={styles.rowValue}>
                                    <input
                                        type="time"
                                        className={styles.timeInput}
                                        value={time}
                                        onChange={e => setTime(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}
                        <div className={styles.field}>
                            <span className={styles.rowLabel}>Urgent</span>
                            <div className={styles.rowValue}>
                                <label className={styles.switch}>
                                    <input type="checkbox" checked={isUrgent} onChange={e => setIsUrgent(e.target.checked)} />
                                    <span className={styles.slider}></span>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className={styles.formGroup} style={{ marginTop: '0.5rem' }}>
                        <div className={styles.field} onClick={() => setShowRepeatMenu(true)} style={{ cursor: 'pointer' }}>
                            <span className={styles.rowLabel}>Repeat</span>
                            <div className={styles.rowValue} style={{ color: '#8E8E93', marginRight: '0.5rem' }}>
                                {repeat} <span style={{ marginLeft: '6px', color: '#BBB' }}>›</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Repeat Menu Overlay */}
                <AnimatePresence>
                    {showRepeatMenu && (
                        <div className={styles.repeatMenuOverlay} onClick={(e) => { e.stopPropagation(); setShowRepeatMenu(false); }}>
                            <motion.div
                                className={styles.repeatMenu}
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                transition={{ duration: 0.1 }}
                                onClick={e => e.stopPropagation()}
                            >
                                {['Never', 'Daily', 'Weekdays', 'Weekends', 'Weekly', 'Biweekly', 'Monthly', 'Every 3 Months', 'Every 6 Months', 'Yearly'].map(option => (
                                    <div
                                        key={option}
                                        className={`${styles.repeatOption} ${repeat === option ? styles.repeatOptionSelected : ''}`}
                                        onClick={() => { setRepeat(option); setShowRepeatMenu(false); }}
                                    >
                                        <span>{option}</span>
                                        {repeat === option && <span className={styles.checkIcon}>✓</span>}
                                    </div>
                                ))}
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    );
}
