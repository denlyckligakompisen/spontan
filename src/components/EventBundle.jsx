import React from 'react';
import { formatTime, isLive } from '../utils/dateUtils';

const EventBundle = ({
    item,
    viewType,
    expandedGroups,
    collapsedGroups,
    toggleGroup,
    toggleCollapse,
    isLastOfLastDay,
    onlyMovies
}) => {
    const isExpanded = expandedGroups.has(item.key);
    const isCollapsed = collapsedGroups.has(item.key);
    const count = item.events.length;
    const repEvent = item.events[0];
    const isIdagView = viewType === 'idag';
    // It's expanded if: 
    // 1. Manually expanded
    // 2. Contains 5 or fewer items and not manually collapsed
    // 3. (Fallback) It's only movies in the whole group and not manually collapsed
    const effectiveIsExpanded = isExpanded || (count <= 5 && !isCollapsed) || (onlyMovies && !isCollapsed);

    const liveEvents = item.events.filter(e => isLive(e.startDate, e.endDate));
    const otherEvents = item.events.filter(e => !isLive(e.startDate, e.endDate));

    const renderSubEvent = (subEvent, isLast) => {
        const startTime = formatTime(subEvent.startDate);
        const endTime = subEvent.endDate ? formatTime(subEvent.endDate) : null;
        const live = isLive(subEvent.startDate, subEvent.endDate);

        return (
            <a
                key={subEvent.id}
                href={subEvent.url}
                target="_blank"
                rel="noopener noreferrer"
                className="event-row-venue compact"
                style={{ borderBottom: isLast ? 'none' : '1px solid #1a1a1a', padding: '0.8rem 0' }}
            >
                <div className="event-info-stack">
                    <span className="event-artist-venue" style={{ fontSize: '0.95rem' }}>
                        {subEvent.name}
                    </span>
                </div>
                <div className="event-meta-right">
                    <span className="event-date-text">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            {live && <span className="live-pulse" title="Börjar snart/Pågår"></span>}
                            <div className={endTime ? "time-stacked" : ""}>
                                <span>{startTime}</span>
                                {endTime && <span className="event-time-end">-{endTime}</span>}
                            </div>
                        </div>
                    </span>
                </div>
            </a>
        );
    };

    const disablePreClick = viewType === 'kommande';

    return (
        <div className="bundle-container">
            <div
                className={`event-row-venue stacked ${isLastOfLastDay && !effectiveIsExpanded && liveEvents.length === 0 ? 'no-border' : ''}`}
                onClick={(e) => {
                    if (disablePreClick) return;
                    e.preventDefault();
                    if (effectiveIsExpanded && !isExpanded) {
                        toggleCollapse(item.key);
                    } else {
                        toggleGroup(item.key);
                    }
                }}
                style={{ cursor: disablePreClick ? 'default' : 'pointer' }}
            >
                <div className="event-info-stack">
                    <span className="event-artist-venue">
                        {count} filmvisningar
                    </span>
                    <span className="event-venue-subtext">
                        {repEvent.venue} {repEvent.distance !== undefined && repEvent.distance !== Infinity && (
                            `• ${repEvent.distance < 1 ? Math.round(repEvent.distance * 1000) + ' m' : repEvent.distance.toFixed(1) + ' km'}`
                        )} {repEvent.category && `• ${repEvent.category}`}
                    </span>
                </div>

                <div className="event-meta-right">
                    {(!disablePreClick && count > 5) && (
                        <div className="chevron-icon" style={{
                            transform: effectiveIsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                            opacity: 0.5
                        }}>
                            ▼
                        </div>
                    )}
                </div>
            </div>

            <div className="bundle-content" style={{ paddingLeft: '1rem' }}>
                {/* Always show live events */}
                {liveEvents.map((e, i) => renderSubEvent(e, i === liveEvents.length - 1 && !effectiveIsExpanded))}
                
                {/* Show other events if expanded */}
                {effectiveIsExpanded && otherEvents.map((e, i) => renderSubEvent(e, i === otherEvents.length - 1))}
            </div>
        </div>
    );
};

export default EventBundle;
