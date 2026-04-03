import React, { useState, useEffect, useRef, useMemo } from 'react';
import './index.css';
import Intro from './Intro';
import Header from './components/Header';
import Navbar from './components/Navbar';
import EventList from './components/EventList';
import Footer from './components/Footer';
import { useEvents } from './hooks/useEvents';

const VIEWS = ['idag', 'imorgon', 'helg', 'kommande', 'info'];

function App() {
  const [view, setView] = useState('idag');
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(25);
  const [activeCategory, setActiveCategory] = useState('alla');
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [highlightIds] = useState(new Set());
  // Use a 'now' ticker to force re-renders every minute for live status
  const [nowTick, setNowTick] = useState(Date.now());

  const scrollContainerRef = useRef(null);
  const viewRefs = useRef([]);
  const loaderRefKommande = useRef(null);

  // Custom hook for all event data and logic
  const {
    loading,
    error,
    groupsIdag,
    groupsImorgon,
    groupsHelg,
    groupsKommande,
    groupsNara,
    eventsIdag,
    eventsImorgon,
    eventsHelg,
    eventsKommande,
    eventsNara,
    events,
    unfilteredIdag,
    unfilteredImorgon,
    unfilteredHelg,
    unfilteredKommande,
    unfilteredNara
  } = useEvents(activeCategory, searchQuery, visibleCount, nowTick);

  // Update 'now' every 60 seconds to refresh live status/pulsing dots
  useEffect(() => {
    const interval = setInterval(() => setNowTick(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  // Initial loadMore logic for infinite scroll
  const loadMore = () => setVisibleCount(prev => prev + 25);

  // Horizontal Scroll / Snap Logic
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollLeft, clientWidth, offsetWidth } = container;
      if (clientWidth > 0) setScrollProgress(scrollLeft / clientWidth);

      const index = Math.round(scrollLeft / offsetWidth);
      const newView = VIEWS[index];
      if (newView && newView !== view) setView(newView);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [view]);

  // Vertical Scroll Logic for Header minimization
  useEffect(() => {
    const index = VIEWS.indexOf(view);
    const currentViewElement = viewRefs.current[index];
    if (!currentViewElement) return;

    const handleVerticalScroll = (e) => setIsHeaderScrolled(e.target.scrollTop > 20);
    currentViewElement.addEventListener('scroll', handleVerticalScroll, { passive: true });
    setIsHeaderScrolled(currentViewElement.scrollTop > 20);

    return () => currentViewElement.removeEventListener('scroll', handleVerticalScroll);
  }, [view]);

  // Infinite Scroll Observer
  useEffect(() => {
    if (view === 'kommande' && loaderRefKommande.current) {
      const observer = new IntersectionObserver(entries => {
        if (entries[0].isIntersecting) loadMore();
      }, { threshold: 1.0 });

      observer.observe(loaderRefKommande.current);
      return () => observer.disconnect();
    }
  }, [view]);

  const scrollToView = (targetView) => {
    const index = VIEWS.indexOf(targetView);
    const container = scrollContainerRef.current;
    if (container && index !== -1) {
      container.scrollTo({ left: index * container.offsetWidth, behavior: 'smooth' });
    }
  };

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
    // Remove from collapsed if we are manually toggling
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.delete(groupId);
      return next;
    });
  };

  const toggleCollapse = (groupId) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
    // Ensure it's not in expanded if we are collapsing
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.delete(groupId);
      return next;
    });
  };

  const availableCategories = useMemo(() => {
    let currentViewEvents = [];
    if (view === 'idag') currentViewEvents = unfilteredIdag;
    else if (view === 'imorgon') currentViewEvents = unfilteredImorgon;
    else if (view === 'helg') currentViewEvents = unfilteredHelg;
    else if (view === 'kommande') currentViewEvents = unfilteredKommande;
    else if (view === 'nara') currentViewEvents = unfilteredNara;
    else return ['alla', 'musik', 'sport', 'teater', 'film', 'övrigt'];

    const cats = new Set(['alla']);
    currentViewEvents.forEach(e => {
      const catLabel = e.category === '🎵' ? 'musik' :
        e.category === '⚽' ? 'sport' :
        e.category === '🎭' ? 'teater' :
        e.category === '🎬' ? 'film' : 'övrigt';
      cats.add(catLabel);
    });

    const order = ['alla', 'musik', 'sport', 'teater', 'film', 'övrigt'];
    return order.filter(c => cats.has(c));
  }, [view, unfilteredIdag, unfilteredHelg, unfilteredKommande, unfilteredNara]);

  const hasFilters = view !== 'info' && view !== 'nara';
  const headerScrolledHeight = hasFilters ? '110px' : '70px';
  const headerExpandedHeight = hasFilters ? '230px' : '105px';
  const stickyTop = isHeaderScrolled ? headerScrolledHeight : headerExpandedHeight;

  return (
    <>
      <Intro />
      <div
        style={{
          '--header-expanded': headerExpandedHeight,
          '--sticky-top': stickyTop,
          '--scroll-progress': scrollProgress
        }}
        className="app"
      >
        <Header
          view={view}
          isHeaderScrolled={isHeaderScrolled}
          scrollToView={scrollToView}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          availableCategories={availableCategories}
        />

        <div className="swipe-container" ref={scrollContainerRef}>
          <section className="view-section" ref={el => viewRefs.current[0] = el}>
            <div className="scroll-content">
              <EventList
                groups={groupsIdag}
                viewType="idag"
                eventsList={eventsIdag}
                loading={loading}
                error={error}
                emptyMessage={activeCategory === 'alla' ? "här var det tomt! kom tillbaka imorgon :)" : "här var det tomt! testa välj ett annat filter :)"}
                searchQuery={searchQuery}
                highlightIds={highlightIds}
                expandedGroups={expandedGroups}
                collapsedGroups={collapsedGroups}
                activeCategory={activeCategory}
                toggleGroup={toggleGroup}
                toggleCollapse={toggleCollapse}
              />
            </div>
          </section>

          <section className="view-section" ref={el => viewRefs.current[1] = el}>
            <div className="scroll-content">
              <EventList
                groups={groupsImorgon}
                viewType="imorgon"
                eventsList={eventsImorgon}
                loading={loading}
                error={error}
                emptyMessage="här var det tomt för imorgon! testa välj ett annat filter :)"
                searchQuery={searchQuery}
                highlightIds={highlightIds}
                expandedGroups={expandedGroups}
                collapsedGroups={collapsedGroups}
                activeCategory={activeCategory}
                toggleGroup={toggleGroup}
                toggleCollapse={toggleCollapse}
              />
            </div>
          </section>

          <section className="view-section" ref={el => viewRefs.current[2] = el}>
            <div className="scroll-content">
              <EventList
                groups={groupsHelg}
                viewType="helg"
                eventsList={eventsHelg}
                loading={loading}
                error={error}
                searchQuery={searchQuery}
                highlightIds={highlightIds}
                expandedGroups={expandedGroups}
                collapsedGroups={collapsedGroups}
                activeCategory={activeCategory}
                toggleGroup={toggleGroup}
                toggleCollapse={toggleCollapse}
              />
            </div>
          </section>

          <section className="view-section" ref={el => viewRefs.current[3] = el}>
            <div className="scroll-content">
              <EventList
                groups={groupsKommande}
                viewType="kommande"
                eventsList={eventsKommande}
                loading={loading}
                error={error}
                searchQuery={searchQuery}
                highlightIds={highlightIds}
                expandedGroups={expandedGroups}
                collapsedGroups={collapsedGroups}
                activeCategory={activeCategory}
                toggleGroup={toggleGroup}
                toggleCollapse={toggleCollapse}
                loaderRef={loaderRefKommande}
              />
            </div>
          </section>

          <section className="view-section" ref={el => viewRefs.current[4] = el}>
            <div className="scroll-content">
              <Footer events={events} />
            </div>
          </section>
        </div>

        <Navbar view={view} scrollToView={scrollToView} />
      </div>
    </>
  );
}

export default App;
