"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import styles from './profile.module.css';

export default function ProfilePage() {
    const router = useRouter();
    const { user, loading: authLoading, logout } = useAuth();

    // Redirect if not authenticated
    useEffect(() => {
        if (!authLoading && !user) {
            router.push('/login');
        }
    }, [user, authLoading, router]);

    if (authLoading) {
        return (
            <main className={styles.main}>
                <div className={styles.loading}>Loading...</div>
            </main>
        );
    }

    if (!user) return null;

    const creationTime = user.metadata?.creationTime
        ? new Date(user.metadata.creationTime).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        })
        : 'Unknown';

    return (
        <main className={styles.main}>
            <motion.div
                className={styles.container}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                {/* Header */}
                <div className={styles.header}>
                    <button
                        className={styles.backButton}
                        onClick={() => router.push('/plan')}
                    >
                        ← Back to Dashboard
                    </button>
                    <h1 className={styles.title}>Profile</h1>
                </div>

                {/* Profile Card */}
                <div className={styles.profileCard}>
                    <div className={styles.avatarSection}>
                        {user.photoURL ? (
                            <img
                                src={user.photoURL}
                                alt="Profile"
                                className={styles.avatar}
                            />
                        ) : (
                            <div className={styles.avatarPlaceholder}>
                                {(user.email || 'U')[0].toUpperCase()}
                            </div>
                        )}
                    </div>

                    <div className={styles.infoSection}>
                        <div className={styles.infoGroup}>
                            <label className={styles.label}>Full Name</label>
                            <p className={styles.value}>
                                {user.displayName || 'Not set'}
                            </p>
                        </div>

                        <div className={styles.infoGroup}>
                            <label className={styles.label}>Email</label>
                            <p className={styles.value}>{user.email}</p>
                        </div>

                        <div className={styles.infoGroup}>
                            <label className={styles.label}>Member Since</label>
                            <p className={styles.value}>{creationTime}</p>
                        </div>

                        <div className={styles.infoGroup}>
                            <label className={styles.label}>Account Provider</label>
                            <p className={styles.value}>
                                {user.providerData?.[0]?.providerId === 'google.com'
                                    ? '🔵 Google'
                                    : '📧 Email'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className={styles.actions}>
                    <button
                        className={styles.signOutBtn}
                        onClick={logout}
                    >
                        🚪 Sign Out
                    </button>
                </div>
            </motion.div>
        </main>
    );
}
