import React from 'react';

const Header = ({
    view,
    isHeaderScrolled,
    scrollToView,
    activeCategory,
    setActiveCategory,
    searchQuery,
    setSearchQuery
}) => {
    const hasFilters = view !== 'info';

    return (
        <header className={`app-header ${isHeaderScrolled ? 'scrolled' : ''}`}>
            <h1
                className="app-title"
                onClick={() => scrollToView('idag')}
                style={{ cursor: 'pointer' }}
            >
                spontan.
            </h1>

            {hasFilters && (
                <div className="filter-search-container">
                    <div className="category-filters">
                        {['alla', 'musik', 'sport', 'teater', 'övrigt'].map(cat => (
                            <button
                                key={cat}
                                className={`filter-pill ${activeCategory === cat ? 'active' : ''}`}
                                onClick={() => setActiveCategory(activeCategory === cat ? 'alla' : cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                    <div className="search-container">
                        <input
                            type="text"
                            placeholder="Filtrera event, plats..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input"
                        />
                    </div>
                </div>
            )}
        </header>
    );
};

export default Header;
