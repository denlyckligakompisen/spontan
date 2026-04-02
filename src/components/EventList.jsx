import React from 'react';
import MonthHeader from './MonthHeader';
import EventItem from './EventItem';
import EventBundle from './EventBundle';
import { processItemsForBundling } from '../utils/eventUtils';

const EventList = ({
    groups,
    viewType,
    eventsList,
    loading,
    error,
    emptyMessage,
    searchQuery,
    highlightIds,
    expandedGroups,
    collapsedGroups,
    activeCategory,
    toggleGroup,
    toggleCollapse,
    loaderRef
}) => {
    if (loading && eventsList.length === 0) {
        return (
            <div className="content-container">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="skeleton-group">
                        <div className="skeleton skeleton-header" style={{ width: '40%' }}></div>
                        <div className="skeleton-row">
                            <div className="skeleton" style={{ width: '60%', height: '1.2rem' }}></div>
                            <div className="skeleton" style={{ width: '20%', height: '1rem' }}></div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (error && eventsList.length === 0) {
        return <div className="error">{error}</div>;
    }

    if (groups.length === 0) {
        const message = searchQuery.trim()
            ? "här var det tomt! testa sök efter något annat :)"
            : (emptyMessage || "här var det tomt :(");

        return (
            <div className="content-container">
                <div className="no-events">{message}</div>
            </div>
        );
    }

    return (
        <div className="content-container">
            <div className="event-list-venue">
                {groups.map(group => {
                    const processedItems = processItemsForBundling(group.events, viewType, activeCategory);
                    const onlyMovies = processedItems.every(item => 
                        item.type === 'bundle' || 
                        (item.type === 'single' && ['nordiskbio', 'fyrisbiografen'].includes(item.event?.source))
                    );

                    return (
                        <React.Fragment key={group.month}>
                            {viewType !== 'idag' && viewType !== 'nara' && <MonthHeader month={group.month} />}
                            {processedItems.map((item, index) => {
                                const isLastOfLastDay = index === processedItems.length - 1;

                                if (item.type === 'bundle') {
                                    return (
                                        <EventBundle
                                            key={item.key}
                                            item={item}
                                            viewType={viewType}
                                            expandedGroups={expandedGroups}
                                            collapsedGroups={collapsedGroups}
                                            toggleGroup={toggleGroup}
                                            toggleCollapse={toggleCollapse}
                                            isLastOfLastDay={isLastOfLastDay}
                                            onlyMovies={onlyMovies}
                                        />
                                    );
                                } else {
                                    return (
                                        <EventItem
                                            key={`${item.event.source}-${item.event.id}`}
                                            event={item.event}
                                            viewType={viewType}
                                            activeCategory={activeCategory}
                                            highlightIds={highlightIds}
                                            isLastOfLastDay={isLastOfLastDay}
                                        />
                                    );
                                }
                            })}
                        </React.Fragment>
                    );
                })}
                {viewType === 'kommande' && loaderRef && (
                    <div ref={loaderRef} style={{ height: '20px', margin: '20px 0' }} />
                )}
            </div>
        </div>
    );
};

export default EventList;
