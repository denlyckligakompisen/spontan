import { useEffect, useState } from "react";

export default function Intro() {
    const [hidden, setHidden] = useState(false);

    useEffect(() => {
        const prefersReducedMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;

        // Total duration: 700ms delay + 300ms fade = 1000ms
        const timeout = setTimeout(
            () => setHidden(true),
            prefersReducedMotion ? 0 : 1000
        );

        return () => clearTimeout(timeout);
    }, []);

    if (hidden) return null;

    return (
        <div className="intro">
            <span>spontan.</span>
        </div>
    );
}
