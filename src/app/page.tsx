"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { getActivePlan, createUserProfile, getUserProfile, createTask } from '@/lib/firestore';
import { withTimeout } from '@/lib/firebase';
import GoalInput from '@/components/GoalInput';
import ActionButton from '@/components/ActionButton';
import QuickTask from '@/components/QuickTask';
import styles from './page.module.css';

const STORAGE_KEY = 'myGoal_appData';

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading, logout } = useAuth();
  const [goal, setGoal] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [checkingPlan, setCheckingPlan] = useState(true);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCheckingPlan(false);
      router.push('/login');
    }
  }, [user, authLoading, router]);

  // Check if user has existing plan in Firestore (OPTIMIZED)
  useEffect(() => {
    async function initializeUser() {
      if (!user) {
        setCheckingPlan(false);
        return;
      }

      try {
        // Run both checks in PARALLEL with 3 second TIMEOUT for speed
        const [profile, existingPlan] = await Promise.all([
          withTimeout(getUserProfile(user.uid), 3000).catch(() => null),
          withTimeout(getActivePlan(user.uid), 3000).catch(() => null)
        ]);

        // Create profile in background if needed (don't wait for it)
        if (!profile) {
          createUserProfile(user.uid, user.email || '', user.displayName || undefined);
        }

        // If plan exists, redirect immediately
        if (existingPlan) {
          router.push('/plan');
          return;
        }

        // No plan - show goal input
        setCheckingPlan(false);
      } catch (error) {
        console.error('Error initializing:', error);
        setCheckingPlan(false);
      }
    }

    if (user && !authLoading) {
      initializeUser();
    }
  }, [user, authLoading, router]);

  const handleGoalSubmit = async () => {
    if (!goal.trim()) return;

    setIsLoading(true);

    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal }),
      });

      const data = await response.json();

      if (data.questions) {
        // Save to sessionStorage and navigate
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ goal, questions: data.questions }));
        router.push('/questions');
      }
    } catch (error) {
      console.error('Failed to submit goal:', error);
      alert('Something went wrong. Please check your API key and try again.');
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // Handle quick task - add a daily habit directly to today


  // Show loading while checking auth or plan
  if (authLoading || checkingPlan) {
    return (
      <main className={styles.main}>
        <div className={styles.loadingState}>Loading...</div>
      </main>
    );
  }

  if (!user) return null;

  return (
    <main className={styles.main}>
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className={styles.header}
      >
        <div className={styles.headerLeft}>
          <div className={styles.iconWrapper}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" fill="currentColor" />
            </svg>
          </div>
          <div className={styles.logo}>myGoal</div>
        </div>

        {/* User Menu */}
        <div className={styles.userMenu}>
          <button
            className={styles.userButton}
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className={styles.userAvatar}>
              {user.photoURL ? (
                <img src={user.photoURL} alt="" />
              ) : (
                <span>{(user.email || 'U')[0].toUpperCase()}</span>
              )}
            </div>
          </button>
          {showUserMenu && (
            <div className={styles.userDropdown}>
              <div className={styles.userEmail}>{user.email}</div>
              <button onClick={handleLogout} className={styles.logoutBtn}>
                Sign Out
              </button>
            </div>
          )}
        </div>
      </motion.header>

      {/* Main Content */}
      <section className={styles.section}>
        <div className={styles.container}>
          <AnimatePresence mode="wait">
            {!isLoading && (
              <motion.div
                key="intro"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
              >
                <h1 className={styles.title}>
                  Turn your ambition<br />into action.
                </h1>
                <p className={styles.subtitle}>
                  Share your goal, and we&apos;ll create a personalized daily plan to help you get there.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {!isLoading && (
            <>
              <GoalInput
                value={goal}
                onChange={setGoal}
                disabled={isLoading}
              />

              <ActionButton
                onClick={handleGoalSubmit}
                isLoading={isLoading}
              />

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className={styles.skipLink}
              >
                <button
                  onClick={() => router.push('/plan')}
                  className={styles.skipButton}
                >
                  Skip AI based plan for now
                </button>
              </motion.div>
            </>
          )}

          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.loadingText}>
              Analyzing your goal...
            </motion.div>
          )}

          {!isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className={styles.footer}
            >
              Powered by advanced AI planning models
            </motion.div>
          )}


        </div>
      </section>
    </main>
  );
}
