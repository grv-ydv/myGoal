"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import QuestionWizard from '@/components/QuestionWizard';
import { useAuth } from '@/contexts/AuthContext';
import { save_goal } from '@/lib/firestore';
import styles from '../page.module.css';

const STORAGE_KEY = 'myGoal_appData';

export default function QuestionsPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [goal, setGoal] = useState('');
    const [questions, setQuestions] = useState<{ id: number; text: string; type: 'text' | 'choice'; options?: string[] }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadingStep, setLoadingStep] = useState(0);

    useEffect(() => {
        // Load data from sessionStorage
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.goal) setGoal(parsed.goal);
                if (parsed.questions && parsed.questions.length > 0) {
                    setQuestions(parsed.questions);
                } else {
                    // No questions, redirect to home
                    router.push('/');
                    return;
                }
            } catch (e) {
                console.error('Failed to parse sessionStorage:', e);
                router.push('/');
                return;
            }
        } else {
            // No data, redirect to home
            router.push('/');
            return;
        }
        setIsLoading(false);
    }, [router]);

    // Prefetch /plan so navigation is instant after generation
    useEffect(() => {
        router.prefetch('/plan');
    }, [router]);

    const handleWizardFinish = async (answers: Record<number, string>) => {
        setIsLoading(true);
        setLoadingStep(0);
        const stepTimer = setInterval(() => {
            setLoadingStep(prev => Math.min(prev + 1, 3));
        }, 3000);
        try {
            const response = await fetch('/api/generate-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    goal,
                    answers: Object.entries(answers).map(([id, ans]) => ({ questionId: id, answer: ans }))
                }),
            });

            const data = await response.json();
            clearInterval(stepTimer);

            if (data.error) {
                console.error('❌ [QuestionsPage] Server returned error:', data.error, data.details);
                throw new Error(data.details ? `${data.error}: ${data.details}` : data.error);
            }

            // Save plan to sessionStorage FIRST (for immediate use)
            const saved = sessionStorage.getItem(STORAGE_KEY);
            const current = saved ? JSON.parse(saved) : {};
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, planData: data }));

            // Redirect immediately - don't wait for Firestore
            router.push('/plan');

            // Save to Firestore in background (non-blocking)
            if (user?.uid) {
                save_goal(user.uid, data, goal)
                    .then((savedPlan) => {
                        // Update sessionStorage with the real Firestore ID so plan/page.tsx can dedupe
                        const currentSaved = sessionStorage.getItem(STORAGE_KEY);
                        if (currentSaved) {
                            try {
                                const parsed = JSON.parse(currentSaved);
                                if (parsed.planData) {
                                    parsed.planData.firestoreId = savedPlan.id;
                                    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
                                }
                            } catch (e) {
                                console.error('Failed to update sessionStorage with Firestore ID:', e);
                            }
                        }
                    })
                    .catch((err) => console.error('Failed to save to Firestore:', err));
            }
        } catch (error) {
            clearInterval(stepTimer);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            alert(`Failed to generate plan: ${errorMessage}`);
            setIsLoading(false);
        }
    };

    if (isLoading) {
        const steps = ['Analyzing your answers...', 'Building your daily plan...', 'Organizing tasks by week...', 'Finalizing your plan...'];
        return (
            <main className={styles.main}>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', marginTop: '4rem', color: '#888', fontFamily: 'var(--font-sans)' }}>
                    <div style={{ width: 32, height: 32, border: '3px solid #333', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite', margin: '0 auto 16px' }} />
                    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                    <p style={{ fontSize: '1.1rem' }}>{steps[loadingStep]}</p>
                </motion.div>
            </main>
        );
    }

    return (
        <main className={styles.main}>
            <motion.header
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className={styles.header}
            >
                <div className={styles.iconWrapper}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" />
                    </svg>
                </div>
                <div className={styles.logo}>myGoal</div>
            </motion.header>

            <section className={styles.section}>
                <div className={styles.container}>
                    <QuestionWizard
                        questions={questions}
                        goal={goal}
                        onFinish={handleWizardFinish}
                    />
                </div>
            </section>
        </main>
    );
}
