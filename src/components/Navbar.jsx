import React from 'react';
import AccessTimeRoundedIcon from '@mui/icons-material/AccessTimeRounded';
import LocalBarRoundedIcon from '@mui/icons-material/LocalBarRounded';
import DateRangeRoundedIcon from '@mui/icons-material/DateRangeRounded';
import InfoOutlineRoundedIcon from '@mui/icons-material/InfoOutlineRounded';

const Navbar = ({ view, scrollToView }) => {
    const items = [
        { id: 'idag', label: 'Idag', icon: <AccessTimeRoundedIcon sx={{ fontSize: 22 }} /> },
        { id: 'helg', label: 'Nästa helg', icon: <LocalBarRoundedIcon sx={{ fontSize: 22 }} /> },
        { id: 'kommande', label: 'Kommande', icon: <DateRangeRoundedIcon sx={{ fontSize: 22 }} /> },
        { id: 'info', label: 'Info', icon: <InfoOutlineRoundedIcon sx={{ fontSize: 22 }} /> }
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
