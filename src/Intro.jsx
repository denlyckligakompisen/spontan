import { useEffect, useState } from "react";

export default function Intro() {
    const [hidden, setHidden] = useState(false);
    const [isFloating, setIsFloating] = useState(false);

    useEffect(() => {
        const prefersReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        // Start floating immediately
        const floatTimeout = setTimeout(() => {
            setIsFloating(true);
        }, 0);

        // Unmount after floating animation (match the 300ms CSS transition)
        const hideTimeout = setTimeout(() => {
            setHidden(true);
        }, 350);

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
