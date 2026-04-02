import React from 'react';
import { Calendar, Coffee, CalendarRange, Info, MapPin } from 'lucide-react';

const Navbar = ({ view, scrollToView }) => {
    const items = [
        { id: 'idag', label: 'Idag', icon: <Calendar size={20} /> },
        { id: 'helg', label: 'Nästa helg', icon: <Coffee size={20} /> },
        { id: 'kommande', label: 'Kommande', icon: <CalendarRange size={20} /> },
        { id: 'info', label: 'Info', icon: <Info size={20} /> }
    ];

    return (
        <nav className="bottom-nav">
            <div className="nav-indicator" />
            {items.map(item => (
                <button
                    key={item.id}
                    className={`nav-item ${view === item.id ? 'active' : ''}`}
                    onClick={() => scrollToView(item.id)}
                >
                    {item.icon}
                    <span>{item.label}</span>
                </button>
            ))}
        </nav>
    );
};

export default Navbar;
