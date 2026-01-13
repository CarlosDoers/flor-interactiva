import React, { createContext, useContext, useState, useRef } from 'react';

const HandContext = createContext({
  handStateRef: { current: 0 }, // Usamos Ref para valores que cambian en cada frame (optimización)
  smileStateRef: { current: 0 }, // 0 = serio, 1 = sonriendo
  isDetected: false,
  setIsDetected: () => {}
});

export const useHandControl = () => useContext(HandContext);

export function HandControlProvider({ children }) {
  const handStateRef = useRef(0); // Valor mutable directo entre 0 y 1
  const smileStateRef = useRef(0); // Valor de sonrisa 0 a 1
  const [isDetected, setIsDetected] = useState(false);

  return (
    <HandContext.Provider value={{ handStateRef, smileStateRef, isDetected, setIsDetected }}>
      {children}
    </HandContext.Provider>
  );
}
