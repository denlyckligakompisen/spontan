import React from 'react';
import { RotateCcw } from 'lucide-react';
import { formatTime, isLive } from '../utils/dateUtils';

const EventBundle = ({
    item,
    viewType,
    expandedGroups,
    toggleGroup,
    isLastOfLastDay
}) => {
    const isExpanded = expandedGroups.has(item.key);
    const count = item.events.length;
    const repEvent = item.events[0];
    const isIdagView = viewType === 'idag';
    const isFyris = item.source === 'fyrisbiografen';
    const effectiveIsExpanded = isExpanded || (isIdagView && count === 1); // Allow expansion even on Idag

    const disablePreClick = viewType === 'kommande';

    return (
        <div className="bundle-container">
            <div
                className={`event-row-venue stacked ${isLastOfLastDay && !effectiveIsExpanded ? 'no-border' : ''}`}
                onClick={(e) => {
                    if (disablePreClick) return;
                    e.preventDefault();
                    toggleGroup(item.key);
                }}
                style={{ cursor: disablePreClick ? 'default' : 'pointer' }}
            >
                <div className="event-info-stack">
                    <span className="event-artist-venue">
                        {count} filmvisningar
                    </span>
                    {!isIdagView && (
                        <span className="event-venue-subtext">
                            {repEvent.venue}
                        </span>
                    )}
                </div>

                <div className="event-meta-right">
                    {(!disablePreClick) && (
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

            {effectiveIsExpanded && (
                <div className="bundle-content" style={{ paddingLeft: '1rem', borderBottom: '1px solid #eee' }}>
                    {item.events.map((subEvent, subIndex) => {
                        const startTime = formatTime(subEvent.startDate);
                        const endTime = subEvent.endDate ? formatTime(subEvent.endDate) : null;
                        const now = new Date();
                        const isPast = subEvent.endDate
                            ? new Date(subEvent.endDate) < now
                            : new Date(subEvent.startDate) < now;
                        const live = isLive(subEvent.startDate, subEvent.endDate);

                        return (
                            <a
                                key={subEvent.id}
                                href={subEvent.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="event-row-venue compact"
                                style={{ borderBottom: subIndex === item.events.length - 1 ? 'none' : '1px solid #f0f0f0', padding: '0.8rem 0' }}
                            >
                                <div className="event-info-stack">
                                    <span className="event-artist-venue" style={{ fontSize: '0.95rem' }}>
                                        {subEvent.name}
                                    </span>
                                </div>
                                <div className="event-meta-right">
                                    <span className="event-date-text">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                            {isPast && (
                                                <RotateCcw size={14} style={{ opacity: 0.5 }} />
                                            )}
                                            {live && <span className="live-pulse" title="Börjar snart/Pågår"></span>}
                                            <div className={endTime ? "time-stacked" : ""} style={{ opacity: isPast ? 0.6 : 1, textDecoration: isPast ? 'line-through' : 'none' }}>
                                                <span>{startTime}</span>
                                                {endTime && <span className="event-time-end">-{endTime}</span>}
                                            </div>
                                        </div>
                                    </span>
                                </div>
                            </a>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default EventBundle;
