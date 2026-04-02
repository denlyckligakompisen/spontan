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
    const isAllMovies = item.key === 'all-movies-idag';
    const totalCount = item.totalCount || item.events.length;
    const count = item.events.length;
    const repEvent = item.events[0];
    const isIdagView = viewType === 'idag';
    const effectiveIsExpanded = isExpanded || (count <= 5 && !isCollapsed);



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
                    {isIdagView && (
                        <span className="event-venue-subtext" style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                            {subEvent.venue} {subEvent.distance !== undefined && ` • ${subEvent.distance < 1 ? Math.round(subEvent.distance * 1000) + ' m' : subEvent.distance.toFixed(1) + ' km'}`}
                        </span>
                    )}
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
                className={`event-row-venue stacked ${isLastOfLastDay && !effectiveIsExpanded ? 'no-border' : ''}`}
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
                        {totalCount} filmvisningar
                    </span>
                    <span className="event-venue-subtext">
                        {/* No distance or category here as requested */}
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
                {/* Show events if expanded */}
                {effectiveIsExpanded && item.events.map((e, i) => renderSubEvent(e, i === item.events.length - 1))}
            </div>
        </div>
    );
};

export default EventBundle;
