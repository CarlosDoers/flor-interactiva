
import React, { useRef, useEffect, useState } from 'react';
import { useHandControl } from './HandContext';

const BUTTON_SIZE = 80;
const PADDING = 20;
const ACTIVATION_TIME = 1000; // 1 second to activate

export function ModeSwitcher({ currentMode, onSwitch }) {
  const { cursorRef, isDetected } = useHandControl();
  const buttonRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const startTimeRef = useRef(null);
  const requestRef = useRef(null);

  useEffect(() => {
    const checkCollision = () => {
      if (!buttonRef.current || !cursorRef.current || !isDetected) {
        setProgress(0);
        setIsHovered(false);
        startTimeRef.current = null;
        requestRef.current = requestAnimationFrame(checkCollision);
        return;
      }

      const rect = buttonRef.current.getBoundingClientRect();
      const cursorX = cursorRef.current.x * window.innerWidth;
      const cursorY = cursorRef.current.y * window.innerHeight;

      // Simple AABB collision
      const isInside = 
        cursorX >= rect.left && 
        cursorX <= rect.right && 
        cursorY >= rect.top && 
        cursorY <= rect.bottom;

      if (isInside) {
        setIsHovered(true);
        if (!startTimeRef.current) {
          startTimeRef.current = performance.now();
        }
        
        const elapsed = performance.now() - startTimeRef.current;
        const newProgress = Math.min(elapsed / ACTIVATION_TIME, 1);
        setProgress(newProgress);

        if (newProgress >= 1) {
          onSwitch(currentMode === 'flower' ? 'doers' : 'flower');
          startTimeRef.current = null; // Reset to prevent multiple triggers
          setProgress(0);
        }
      } else {
        setIsHovered(false);
        setProgress(0);
        startTimeRef.current = null;
      }

      requestRef.current = requestAnimationFrame(checkCollision);
    };

    requestRef.current = requestAnimationFrame(checkCollision);
    
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [currentMode, onSwitch, isDetected]);

  const buttonStyle = {
    position: 'fixed',
    top: PADDING,
    right: PADDING,
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: '50%',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    border: '2px solid rgba(255, 255, 255, 0.3)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    zIndex: 1000,
    overflow: 'hidden',
    transition: 'transform 0.2s',
    transform: isHovered ? 'scale(1.1)' : 'scale(1)',
    backdropFilter: 'blur(5px)'
  };

  const ringStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '4px solid #00ffee',
    borderTopColor: 'transparent',
    transform: `rotate(${progress * 360}deg)`,
    opacity: progress > 0 ? 1 : 0,
    transition: 'transform 0.1s linear, opacity 0.2s'
  };

  return (
    <div ref={buttonRef} style={buttonStyle}>
       {/* Background fill based on progress */}
       <div style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: `${progress * 100}%`,
          backgroundColor: 'rgba(0, 255, 238, 0.2)',
          transition: 'height 0.1s linear'
       }} />
       
       {/* SVG Icon */}
       <div style={{ zIndex: 2, color: 'white', fontSize: '12px', textAlign: 'center' }}>
          {currentMode === 'flower' ? 'DOERS' : 'FLOR'}
       </div>
    </div>
  );
}
