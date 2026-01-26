# Guía Completa de Gestos - Flor Interactiva 🌸✨

## Resumen de todos los gestos disponibles

### 1. 🙌 Separar las Manos (Gesto "Moisés")
**Cómo hacerlo:**
- Junta las palmas de ambas manos
- Separa las manos horizontalmente (como abriendo cortinas)

**Efecto:**
- La flor **crece** y se hace más grande
- Aparecen **rayos prismáticos** brillantes
- La flor **gira más rápido**

**Rango:** 
- Manos juntas = Flor pequeña, sin rayos
- Manos separadas = Flor grande (15% más), rayos brillantes

---

### 2. ✋ Levantar Mano Izquierda
**Cómo hacerlo:**
- Levanta tu mano izquierda verticalmente

**Efecto:**
- La **luz naranja** (izquierda) se intensifica
- Cambia de color: `#ffc8aa` → `#ff6b35` (naranja brillante)
- Intensidad: `2` → `8` (4x más brillante)

**Rango:**
- Mano abajo = Luz naranja suave
- Mano arriba = Luz naranja intensa

---

### 3. ✋ Levantar Mano Derecha
**Cómo hacerlo:**
- Levanta tu mano derecha verticalmente

**Efecto:**
- La **luz morada** (derecha) se intensifica
- Cambia de color: `#b0aaff` → `#7b2cbf` (morado profundo)
- Intensidad: `1.5` → `7` (casi 5x más brillante)

**Rango:**
- Mano abajo = Luz morada suave
- Mano arriba = Luz morada intensa

---

### 4. 🤏 Pinza (Índice + Pulgar)
**Cómo hacerlo:**
- Con la **mano derecha**, junta el dedo índice y el pulgar

**Efecto:**
- La flor cambia a **color violeta neón** (`#bc13fe`)
- Efecto de **emisión** (brillo propio)

**Rango:**
- Dedos separados = Color normal
- Dedos juntos = Violeta brillante

---

### 5. 😊 Sonreír
**Cómo hacerlo:**
- Sonríe ampliamente frente a la cámara

**Efecto:**
- La flor cambia a **color rojo intenso** (`#ff0033`)
- Intensidad de emisión aumenta

**Rango:**
- Cara neutra = Color base
- Sonrisa amplia = Rojo brillante

---

### 6. 😲 Levantar Cejas (Sorpresa)
**Cómo hacerlo:**
- Levanta las cejas (expresión de sorpresa)

**Efecto:**
- La flor cambia a **color azul cian** (`#00bfff`)
- Efecto de energía/sorpresa

**Rango:**
- Cejas normales = Color base
- Cejas levantadas = Azul brillante

---

## Combinaciones de Gestos 🎭

Puedes **combinar múltiples gestos** para efectos compuestos:

### Combo 1: "Explosión de Luz"
- Separa las manos (flor grande + rayos)
- Levanta ambas manos (ambas luces intensas)
- Resultado: Escena completamente iluminada

### Combo 2: "Contraste Asimétrico"
- Separa las manos
- Levanta solo una mano (luz unilateral)
- Resultado: Iluminación dramática lateral

### Combo 3: "Color + Crecimiento"
- Separa las manos (flor crece)
- Sonríe (flor roja)
- Resultado: Flor grande y roja brillante

### Combo 4: "Full Package"
- Separa las manos
- Levanta ambas manos
- Sonríe
- Resultado: ¡Explosión total de luz y color! 🎆

---

## Prioridad de Colores

Cuando hay **múltiples gestos de color** activos, se mezclan en este orden:

1. **Color base** (del modelo 3D original)
2. **Pinza** → Violeta neón
3. **Sonrisa** → Rojo intenso
4. **Sorpresa** → Azul cian

Ejemplo: Si haces pinza + sonrisa + sorpresa, verás una **mezcla de violeta, rojo y azul**.

---

## Requisitos Técnicos

### Para gestos de manos:
- ✅ **Ambas manos deben ser visibles** en la cámara
- ✅ Buena iluminación ambiental
- ✅ Contraste claro entre manos y fondo

### Para gestos faciales:
- ✅ Rostro visible y bien iluminado
- ✅ Cámara a la altura de los ojos
- ✅ Sin obstrucciones (gafas de sol, mascarilla, etc.)

---

## Vista Debug

En la **esquina inferior derecha** verás:
- Video de la cámara
- Overlay del tracking (skeleton de manos y cara)
- Puntos de tracking en tiempo real

Colores del overlay:
- 🔵 **Cyan**: Conexiones entre puntos (manos)
- 🔴 **Rojo**: Puntos de tracking
- ⚪ **Gris**: Malla facial

---

## Tips para la Mejor Experiencia

1. **Posiciónate bien**: Mantén tus manos y cara visibles
2. **Movimientos suaves**: Los gestos tienen suavizado para evitar saltos bruscos
3. **Experimenta**: Prueba diferentes combinaciones
4. **Distancia**: Colócate a ~1 metro de la cámara
5. **Fondo**: Un fondo uniforme mejora el tracking

---

## Archivos de Configuración

- **Gestos de manos**: `src/components/HandTracker.jsx`
- **Control de luces**: `src/components/DynamicLights.jsx`
- **Configuración de flor**: `src/components/Flower.jsx`
- **Configuración de rayos**: `src/components/PrismaticBeams.jsx`

¡Disfruta explorando todas las posibilidades! 🎨✨
