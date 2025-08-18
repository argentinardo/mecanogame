import React, { useState, useEffect } from 'react';

const MobileWarning: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const isSmallScreen = window.innerWidth <= 768;
      
      setIsMobile(isMobileDevice || isSmallScreen);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!isMobile) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      padding: '20px',
      textAlign: 'center',
      fontFamily: 'monospace',
      color: '#00ff00'
    }}>
      <div style={{
        backgroundColor: '#000',
        border: '3px solid #00ff00',
        padding: '40px',
        borderRadius: '15px',
        maxWidth: '500px',
        boxShadow: '0 0 30px rgba(0, 255, 0, 0.6)'
      }}>
        <h2 style={{
          margin: '0 0 25px 0',
          fontSize: '28px',
          textTransform: 'uppercase',
          letterSpacing: '3px',
          color: '#ffff00'
        }}>
          MECANOGAME
        </h2>
        
        <p style={{
          margin: '0 0 20px 0',
          fontSize: '18px',
          lineHeight: '1.6',
          fontWeight: 'bold'
        }}>
          MECANOGAME está diseñado para <strong>aprender mecanografía</strong>.
        </p>
        
        <p style={{
          margin: '0 0 20px 0',
          fontSize: '16px',
          lineHeight: '1.5',
          color: '#ffff00'
        }}>
          El objetivo es mejorar tu velocidad y precisión al escribir en un <strong>teclado físico</strong>.
        </p>
        
        <div style={{
          backgroundColor: '#ff0000',
          color: '#fff',
          padding: '15px 25px',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          margin: '20px 0',
          border: '2px solid #ff6666'
        }}>
          NO DISPONIBLE EN MÓVIL
        </div>
        
        <p style={{
          margin: '0 0 25px 0',
          fontSize: '14px',
          lineHeight: '1.4',
          color: '#cccccc'
        }}>
          El objetivo del juego no tiene sentido con el teclado del movil.
        </p>
        
        <div style={{
          color: '#00cc00',
          padding: '15px 30px',
          borderRadius: '8px',
          fontSize: '16px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          margin: '20px 0',
          border: '2px solid ',
          backgroundColor: 'transparent'
        }}>
        
        Visita el sitio en una computadora
        </div>
        
        <p style={{
          margin: '25px 0 0 0',
          fontSize: '12px',
          color: '#888',
          fontStyle: 'italic',
          lineHeight: '1.3'
        }}>
          Para una experiencia completa de aprendizaje de mecanografía, necesitas un teclado físico real.
        </p>
      </div>
    </div>
  );
};

export default MobileWarning; 