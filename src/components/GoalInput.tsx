"use client";

import { motion } from 'framer-motion';
import styles from './GoalInput.module.css';

interface GoalInputProps {
    value: string;
    onChange: (value: string) => void;
    disabled?: boolean;
}

export default function GoalInput({ value, onChange, disabled }: GoalInputProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className={styles.wrapper}
        >
            <textarea
                className={styles.textarea}
                placeholder="Get a product management job in 30 days..."
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
            />
        </motion.div>
    );
}
