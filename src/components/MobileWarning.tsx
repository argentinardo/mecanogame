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
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
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
        border: '2px solid #00ff00',
        padding: '30px',
        borderRadius: '10px',
        maxWidth: '400px',
        boxShadow: '0 0 20px rgba(0, 255, 0, 0.5)'
      }}>
        <h2 style={{
          margin: '0 0 20px 0',
          fontSize: '24px',
          textTransform: 'uppercase',
          letterSpacing: '2px'
        }}>
          ⚠️ ADVERTENCIA ⚠️
        </h2>
        
        <p style={{
          margin: '0 0 15px 0',
          fontSize: '16px',
          lineHeight: '1.5'
        }}>
          Este juego está diseñado para <strong>aprender a usar el teclado</strong>.
        </p>
        
        <p style={{
          margin: '0 0 20px 0',
          fontSize: '14px',
          lineHeight: '1.4',
          color: '#ffff00'
        }}>
          No tiene sentido jugarlo en un dispositivo móvil ya que necesitas un teclado físico para practicar la mecanografía.
        </p>
        
        <div style={{
          backgroundColor: '#00ff00',
          color: '#000',
          padding: '10px 20px',
          borderRadius: '5px',
          fontSize: '14px',
          fontWeight: 'bold',
          textTransform: 'uppercase',
          letterSpacing: '1px'
        }}>
          Usa una computadora con teclado
        </div>
        
        <p style={{
          margin: '20px 0 0 0',
          fontSize: '12px',
          color: '#888',
          fontStyle: 'italic'
        }}>
          Si insistes en continuar, la experiencia será limitada
        </p>
      </div>
    </div>
  );
};

export default MobileWarning; 