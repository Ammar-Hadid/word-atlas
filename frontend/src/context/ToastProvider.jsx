import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";

import { ToastContext } from "./contexts.js";

const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState(null);
    const timerRef = useRef(null);

    const notify = useCallback((message) => {
        clearTimeout(timerRef.current);
        setToast({ id: crypto.randomUUID(), message });
        timerRef.current = setTimeout(() => setToast(null), 2400);
    }, []);

    return (
        <ToastContext.Provider value={notify}>
            {children}

            <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-xl z-50 flex justify-center px-md">
                <AnimatePresence>
                    {toast && (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, y: 16, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                            className="flex items-center gap-sm rounded-full bg-ink py-sm pl-base pr-md text-body-sm text-paper shadow-soft"
                        >
                            <span className="grid h-5 w-5 place-items-center rounded-full bg-accent text-accent-ink">
                                <Check className="h-3 w-3" strokeWidth={3} />
                            </span>
                            {toast.message}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
};

export default ToastProvider;
