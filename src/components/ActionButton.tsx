"use client";

import { motion } from 'framer-motion';
import styles from './ActionButton.module.css';

interface ActionButtonProps {
    onClick: () => void;
    isLoading?: boolean;
}

export default function ActionButton({ onClick, isLoading }: ActionButtonProps) {
    return (
        <motion.button
            whileHover={{ scale: isLoading ? 1 : 1.02 }}
            whileTap={{ scale: isLoading ? 1 : 0.98 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className={styles.button}
            onClick={onClick}
            disabled={isLoading}
            style={{ opacity: isLoading ? 0.7 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
        >
            {isLoading ? "Generating Plan..." : "Turn this into my daily plan"}
            {!isLoading && <span className={styles.icon}>→</span>}
        </motion.button>
    );
}
