# Control de Luces Dinámicas con Gestos 💡✨

## ¿Qué hace?

Las dos luces de escena (`pointLight`) ahora **reaccionan a la altura de cada mano**:

- **Mano Izquierda** 🤚 → Controla la **luz naranja** (posición izquierda)
- **Mano Derecha** 🤚 → Controla la **luz morada** (posición derecha)

Al **levantar cada mano**, su luz correspondiente:
1. **Cambia de color** (de suave a intenso)
2. **Aumenta su intensidad** (brilla más fuerte)

## Cómo funciona

### Detección de altura

En `HandTracker.jsx`, después de detectar ambas manos, se calcula la altura de cada muñeca:

```javascript
// La coordenada Y en MediaPipe: 0 = arriba, 1 = abajo
// La invertimos para que sea intuitivo: 0 = abajo, 1 = arriba
let leftHeight = 1 - leftWrist.y;

// Normalizamos al rango visible típico (0.3 - 0.7)
leftHeight = (leftHeight - 0.3) / 0.4;
leftHeight = Math.max(0, Math.min(1, leftHeight));
```

### Componente DynamicLights.jsx

Este nuevo componente reemplaza las luces estáticas y las hace reactivas:

```javascript
// En cada frame
useFrame(() => {
  const leftHeight = leftHandHeightRef.current;
  const rightHeight = rightHandHeightRef.current;
  
  // Interpolar color e intensidad según altura
  leftLightRef.current.color.lerp(activeColor, leftHeight);
  leftLightRef.current.intensity = baseIntensity + (leftHeight * range);
});
```

## Configuración de colores

En `DynamicLights.jsx`, puedes ajustar los colores y efectos:

```javascript
const LIGHT_CONFIG = {
  left: {
    position: [-4, 2, -3],
    baseColor: '#ffc8aa',      // Naranja suave (mano abajo)
    activeColor: '#ff6b35',    // Naranja intenso (mano arriba)
    baseIntensity: 2,
    maxIntensity: 8,
  },
  right: {
    position: [4, 2, 3],
    baseColor: '#b0aaff',      // Morado suave (mano abajo)
    activeColor: '#7b2cbf',    // Morado intenso (mano arriba)
    baseIntensity: 1.5,
    maxIntensity: 7,
  }
};
```

## Parámetros ajustables

### Sensibilidad de altura

En `HandTracker.jsx` (líneas ~107-118):

```javascript
// Rango de normalización
leftHeight = (leftHeight - 0.3) / 0.4;
//                         ^      ^
//                     mínimo   rango
```

- **Mínimo** (`0.3`): Altura mínima para que empiece el efecto
- **Rango** (`0.4`): Distancia vertical para alcanzar el máximo

**Hacer más sensible** (se activa con menos movimiento):
```javascript
leftHeight = (leftHeight - 0.2) / 0.3;
```

**Hacer menos sensible** (requiere más movimiento):
```javascript
leftHeight = (leftHeight - 0.4) / 0.5;
```

### Suavizado

En `HandTracker.jsx` (línea ~115):
```javascript
leftHandHeightRef.current = currentLeftHeight + (leftHeight - currentLeftHeight) * 0.2;
//                                                                                   ^
//                                                                         velocidad de suavizado
```

- **Más rápido**: `0.3` o `0.4` (respuesta inmediata)
- **Más suave**: `0.1` o `0.15` (animación fluida)

### Intensidad de luz

En `DynamicLights.jsx` (línea ~15):
```javascript
maxIntensity: 8,  // Brillo máximo cuando la mano está arriba
```

- Aumentar para luz más intensa
- Disminuir para efecto más sutil

### Velocidad de transición de luz

En `DynamicLights.jsx` (línea ~56):
```javascript
leftLightRef.current.intensity = THREE.MathUtils.lerp(
  leftLightRef.current.intensity,
  targetIntensity,
  0.15  // ← Velocidad de transición
);
```

- **Más rápido**: `0.25` - `0.35`
- **Más suave**: `0.05` - `0.10`

## Cómo probar

1. Asegúrate de que **ambas manos sean visibles** en la cámara
2. **Levanta la mano izquierda** → La luz naranja (izquierda) se intensificará y cambiará a naranja brillante
3. **Levanta la mano derecha** → La luz morada (derecha) se intensificará y cambiará a morado intenso
4. Prueba a **mover ambas manos arriba y abajo** para ver el efecto dinámico

## Combinación de gestos

Ahora tienes **3 gestos activos simultáneamente**:

1. **Separar las manos** (horizontal) → La flor crece y aparecen rayos
2. **Levantar mano izquierda** (vertical) → Cambio de luz naranja
3. **Levantar mano derecha** (vertical) → Cambio de luz morada

Puedes combinarlos: por ejemplo, **separar las manos mientras levantas la derecha** para un efecto completo.

## Troubleshooting

### Las luces no responden
- Verifica que ambas manos sean visibles en el preview de la cámara
- Asegúrate de que el tracking esté funcionando (mira el canvas de debug)

### El efecto es muy rápido/lento
- Ajusta el parámetro de suavizado en `HandTracker.jsx` (línea ~115)
- Ajusta la velocidad de transición en `DynamicLights.jsx` (línea ~56)

### El efecto es muy sutil
- Aumenta `maxIntensity` en `LIGHT_CONFIG`
- Ajusta los colores `activeColor` a tonos más saturados

### El efecto se activa con las manos muy bajas
- Aumenta el valor mínimo en la normalización (de `0.3` a `0.4`)

## Archivos modificados

1. **`HandContext.jsx`**: Agregados `leftHandHeightRef` y `rightHandHeightRef`
2. **`HandTracker.jsx`**: Detección de altura de cada mano
3. **`DynamicLights.jsx`**: Nuevo componente para luces reactivas
4. **`App.jsx`**: Integración del componente DynamicLights
