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
        }, 100);

        // Unmount after the intro duration (0.5s)
        const hideTimeout = setTimeout(() => {
            setHidden(true);
        }, 500);

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
