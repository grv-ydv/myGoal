"use client";

import { motion } from 'framer-motion';

interface QuestionDisplayProps {
    questions: string[];
}

export default function QuestionDisplay({ questions }: QuestionDisplayProps) {
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full max-w-4xl mt-12 text-left"
        >
            <h2 className="text-3xl font-serif text-[#1a1a1a] mb-8 text-center">
                To build your perfect plan, ask yourself...
            </h2>

            <div className="grid gap-6">
                {questions.map((q, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 + 0.5 }}
                        className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex gap-4 items-start"
                    >
                        <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#F0F0F0] text-[#1a1a1a] flex items-center justify-center font-serif text-lg">
                            {i + 1}
                        </span>
                        <p className="text-lg text-[#333333] leading-relaxed font-light font-sans">
                            {q}
                        </p>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
}
