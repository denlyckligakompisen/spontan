import { useEffect, useState } from "react";

export default function Intro() {
    const [hidden, setHidden] = useState(false);
    const [isFloating, setIsFloating] = useState(false);

    useEffect(() => {
        const prefersReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        // Start floating after a short hold
        const floatTimeout = setTimeout(() => {
            setIsFloating(true);
        }, prefersReducedMotion ? 0 : 100);

        // Unmount after floating animation
        const hideTimeout = setTimeout(() => {
            setHidden(true);
        }, prefersReducedMotion ? 0 : 500);

        return () => {
            clearTimeout(floatTimeout);
            clearTimeout(hideTimeout);
        };
    }, []);

    if (hidden) return null;

    return (
        <div className={`intro ${isFloating ? 'floating' : ''}`}>
            <span>spontan.</span>
        </div>
    );
}
