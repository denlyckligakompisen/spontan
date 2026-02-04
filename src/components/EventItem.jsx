import React from 'react';
import { RotateCcw } from 'lucide-react';
import { formatTime, isLive } from '../utils/dateUtils';

const EventItem = ({
    event,
    viewType,
    highlightIds,
    isLastOfLastDay
}) => {
    const live = isLive(event.startDate, event.endDate);
    const shouldHideTime = viewType !== 'idag' && ['nordiskbio', 'fyrisbiografen'].includes(event.source);

    const now = new Date();
    const isPast = event.endDate
        ? new Date(event.endDate) < now
        : new Date(event.startDate) < now;

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
                    {(viewType === 'helg' && ['nordiskbio', 'fyrisbiografen'].includes(event.source))
                        ? "filmvisningar"
                        : (event.artist || event.name)}
                </span>
                <span className="event-venue-subtext">
                    {event.venue}
                </span>
            </div>

            <div className="event-meta-right">
                <span className="event-date-text">
                    {(() => {
                        if (viewType === 'idag' || viewType === 'helg') {
                            const startTime = formatTime(event.startDate);
                            const endTime = event.endDate ? formatTime(event.endDate) : null;

                            return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                    {isPast && (
                                        <RotateCcw size={14} style={{ opacity: 0.5 }} />
                                    )}
                                    {live && <span className="live-pulse" title="Börjar snart/Pågår"></span>}
                                    {shouldHideTime ? '' : (
                                        <div className={endTime ? "time-stacked" : ""} style={{ opacity: isPast ? 0.6 : 1, textDecoration: isPast ? 'line-through' : 'none' }}>
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
