import React from 'react';

interface SymbolTileProps {
  icon: React.ReactNode;
  title: string;
  description?: string[];
}

const SymbolTile: React.FC<SymbolTileProps> = ({ icon, title, description = [] }) => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '24px',
      backgroundColor: '#111',
      borderRadius: '8px',
      textAlign: 'center',
      width: '100%',
      maxWidth: '250px',
      border: '1px solid #333',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '80px',
        height: '80px',
        marginBottom: '16px',
        fontSize: '36px'
      }}>
        {icon}
      </div>
      <h3 style={{ fontSize: '20px', margin: '0 0 16px 0', color: 'white', fontWeight: 'bold' }}>
        {title}
      </h3>
      <div style={{ color: '#888' }}>
        {description.map((line, index) => (
          <p key={index} style={{ margin: '4px 0' }}>{line}</p>
        ))}
      </div>
    </div>
  );
};

export default SymbolTile; 