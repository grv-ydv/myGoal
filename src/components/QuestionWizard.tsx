"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './QuestionWizard.module.css';

interface Question {
    id: number;
    text: string;
    type: 'text' | 'choice';
    options?: string[];
}

interface QuestionWizardProps {
    questions: Question[];
    goal: string;
    onFinish: (answers: Record<number, string>) => void;
}

export default function QuestionWizard({ questions, goal, onFinish }: QuestionWizardProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<Record<number, string>>({});
    const [inputValue, setInputValue] = useState("");

    const currentQuestion = questions[currentIndex];
    // Calculate raw progress (1-based index)
    const currentStep = currentIndex + 1;
    const totalSteps = questions.length;

    const handleNext = () => {
        if (!inputValue.trim()) return;

        // Save answer
        const newAnswers = { ...answers, [currentQuestion.id]: inputValue };
        setAnswers(newAnswers);

        // Clear input for next step or keep if going back (not implemented yet, keeping simple)
        setInputValue("");

        if (currentIndex < totalSteps - 1) {
            setCurrentIndex(currentIndex + 1);
        } else {
            // Finished
            onFinish(newAnswers);
        }
    };

    const handleOptionSelect = (opt: string) => {
        setInputValue(opt);
        // Auto-advance for choices could be nice, but let's stick to explicit continue for consistency
        // or maybe auto-advance for better UX:
        // setAnswers({ ...answers, [currentQuestion.id]: opt });
        // setTimeout(() => { ... advance ... }, 300);
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={styles.container}
        >
            {/* Top Bar: Progress */}
            <div className={styles.topBar}>
                <span className={styles.progressLabel}>
                    Question {currentStep} of {totalSteps}
                </span>
                <div className={styles.progressTrack}>
                    {questions.map((_, idx) => (
                        <div
                            key={idx}
                            className={`${styles.progressStep} ${idx < currentStep ? styles.active : ''}`}
                        />
                    ))}
                </div>
            </div>

            {/* Goal Context */}
            <div className="text-left w-full max-w-2xl mx-auto">
                <p className={styles.contextLabel}>Understanding your goal</p>
                <div className={styles.goalChip}>
                    <span className={styles.sparkle}>✨</span>
                    {goal}
                </div>
            </div>

            {/* Question Card */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={currentQuestion.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4 }}
                    className={styles.card}
                >
                    <h2 className={styles.questionText}>{currentQuestion.text}</h2>

                    {currentQuestion.type === 'choice' && currentQuestion.options ? (
                        <div className={styles.optionsGrid}>
                            {currentQuestion.options.map((opt) => (
                                <button
                                    key={opt}
                                    className={`${styles.optionButton} ${inputValue === opt ? styles.selected : ''}`}
                                    onClick={() => handleOptionSelect(opt)}
                                >
                                    {opt}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <textarea
                            className={styles.textArea}
                            placeholder="Type your answer here..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            autoFocus
                        />
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Footer Navigation */}
            <div className={styles.footer}>
                <button
                    className={`${styles.continueButton} ${inputValue.trim() ? styles.active : ''}`}
                    onClick={handleNext}
                    disabled={!inputValue.trim()}
                >
                    {currentIndex === totalSteps - 1 ? 'Finish' : 'Continue'}
                    <span className={styles.arrow}>→</span>
                </button>
            </div>
        </motion.div>
    );
}
