BACKTESTER V3.6 MR
VALIDACION TEMPORAL DE LA REGLA BASE

OBJETIVO
Comprobar si la regla base mantiene su rendimiento a través del tiempo.

NUEVO
- Bloques consecutivos.
- Validación acumulativa.
- Ventanas móviles.
- Comparación primera mitad vs segunda mitad.
- Peor bloque.
- Variación entre bloques.
- Número de ventanas por debajo del umbral.
- Clasificación:
  PERSISTENCIA TEMPORAL ACEPTABLE
  PERSISTENCIA PARCIAL
  NO PERSISTENTE

PRIMERA PRUEBA
R_50
Todas
TRAIN 70%
Mínimo TRAIN 30
Mínimo TEST 15
Timing 100 ms
Confianza 10
5 bloques
Muestra mínima por bloque 10
Exactitud mínima estable 55%
Peor bloque mínimo 50%
Variación máxima 20 puntos
Ventana móvil 20 operaciones
Paso 5 operaciones
Solo finalizadas: sí
