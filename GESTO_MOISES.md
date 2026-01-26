# Gesto "Moisés Abriendo las Aguas" 🙌

## ¿Qué cambió?

Se reemplazó el gesto de **una mano abierta/cerrada** por un gesto de **dos manos juntas/separadas**, inspirado en el movimiento de "Moisés abriendo las aguas".

## Cómo funciona

### Antes
- **Gesto**: Abrir y cerrar una mano (izquierda o derecha)
- **Detección**: Se medía la distancia entre la muñeca y la punta del dedo medio
- **Efecto**: La flor crecía al abrir la mano

### Ahora
- **Gesto**: Juntar ambas manos y luego separarlas horizontalmente
- **Detección**: Se mide la distancia horizontal entre las muñecas de ambas manos
- **Efecto**: La flor crece cuando las manos se separan

## Detalles técnicos

### Cambios en `HandTracker.jsx`
```javascript
// Ahora detectamos DOS manos simultáneamente
if (rightHand && leftHand) {
    // Usamos las muñecas (landmark 0) para medir la distancia
    const leftWrist = leftHand[0];
    const rightWrist = rightHand[0];
    
    // Calculamos la distancia horizontal (eje X)
    const horizontalDist = Math.abs(rightWrist.x - leftWrist.x);
    
    // Normalizamos: 0 = juntas, 1 = muy separadas
    // Rango: 0.05 (juntas) a 0.40 (separadas)
    let separation = (horizontalDist - 0.05) / 0.35;
    separation = Math.max(0, Math.min(1, separation));
}
```

### Parámetros ajustables

En `HandTracker.jsx` (línea ~96):
- **Umbral mínimo**: `0.05` - Distancia cuando las manos están juntas
- **Rango de detección**: `0.35` - Distancia máxima de separación para efecto completo
- **Suavizado**: 
  - `0.1` cuando se separan (suave)
  - `0.4` cuando se juntan (rápido)

## Cómo probar

1. Colócate frente a la cámara
2. Asegúrate de que ambas manos sean visibles
3. Junta las palmas de las manos
4. Separa las manos horizontalmente (como abriendo cortinas)
5. La flor crecerá y los rayos apareceran conforme separas las manos

## Ajustes finos

Si quieres modificar la sensibilidad del gesto, edita estos valores en `HandTracker.jsx`:

```javascript
// Hacer el gesto más sensible (se activa con menor separación)
let separation = (horizontalDist - 0.03) / 0.25; // En lugar de 0.05 y 0.35

// Hacer el gesto menos sensible (requiere más separación)
let separation = (horizontalDist - 0.08) / 0.45; // En lugar de 0.05 y 0.35
```

## Notas

- El gesto **requiere que ambas manos sean visibles** simultáneamente
- Si solo se detecta una mano, el efecto se desactivará gradualmente
- El gesto de **pinza** (índice + pulgar) todavía funciona con la mano derecha para efectos de color
