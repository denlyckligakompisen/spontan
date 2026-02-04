import React from 'react';

const Footer = ({ events }) => {
    const activeSources = [...new Set(events.map(e => e.source))]
        .filter(s => s !== 'ticketmaster' && s !== 'tickster');

    const sourceNames = {
        'destinationuppsala': 'Destination Uppsala',
        'fyrisbiografen': 'Fyrisbiografen',
        'hejauppsala': 'Heja Uppsala',
        'katalin': 'Katalin',
        'nordiskbio': 'Nordisk Bio',
        'ukk': 'UKK',
        'uppsalastadsteater': 'Uppsala Stadsteater'
    };

    return (
        <div className="info-page">
            <div className="footer-sources">
                <p style={{ marginBottom: '0.5rem', fontWeight: 500, color: '#666' }}>Källor</p>
                {activeSources.sort().map(source => (
                    <span key={source}>{sourceNames[source] || source}</span>
                ))}
            </div>
        </div>
    );
};

export default Footer;
