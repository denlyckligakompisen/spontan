import React from 'react';
import { formatTime, isLive } from '../utils/dateUtils';

const EventItem = ({
    event,
    viewType,
    highlightIds,
    activeCategory,
    isLastOfLastDay
}) => {
    const live = isLive(event.startDate, event.endDate);
    const shouldHideTime = false;

    return (
        <a
            id={`${event.source}-${event.id}`}
            href={event.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`event-row-venue stacked ${highlightIds.has(`${event.source}-${event.id}`) ? 'highlighted' : ''} ${isLastOfLastDay ? 'no-border' : ''}`}
        >
            <div className="event-info-stack">
                <span className="event-artist-venue">
                    {event.artist || event.name}
                </span>
                <span className="event-venue-subtext">
                    {event.venue} {event.distance !== undefined && event.distance !== Infinity && viewType !== 'helg' && viewType !== 'kommande' && (
                        `• ${event.distance < 1 ? Math.round(event.distance * 1000) + ' m' : event.distance.toFixed(1) + ' km'}`
                    )} {event.category && activeCategory === 'alla' && `• ${event.category}`}
                    {event.nextTimes && ` • Kommande: ${event.nextTimes.join(', ')}`}
                </span>
            </div>

            <div className="event-meta-right">
                <span className="event-date-text">
                    {(() => {
                        if (viewType === 'idag' || viewType === 'helg' || viewType === 'nara') {
                            const startTime = formatTime(event.startDate);
                            const endTime = event.endDate ? formatTime(event.endDate) : null;

                            return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    {live && <span className="live-pulse" title="Börjar snart/Pågår"></span>}
                                    {shouldHideTime ? '' : (
                                        <div className={endTime ? "time-stacked" : ""}>
                                            <span>{startTime}</span>
                                            {endTime && <span className="event-time-end">-{endTime}</span>}
                                        </div>
                                    )}
                                </div>
                            );
                        }

                        const d = new Date(event.startDate);
                        const day = d.getDate();
                        const month = d.toLocaleDateString('sv-SE', { month: 'short' }).replace('.', '');
                        return (
                            <div className="date-stacked">
                                <span className="date-day">{day}</span>
                                <span className="date-month">{month}</span>
                            </div>
                        );
                    })()}
                </span>
            </div>
        </a>
    );
};

export default EventItem;
