BACKTESTER V3.1 MR

MEJORA PRINCIPAL
El walk-forward ya no usa solo dirección + timing.
Ahora conserva exactamente la regla validada:
- mercado
- dirección
- timing
- tramo de confianza
- clasificación histórica

Incluye:
- TRAIN / TEST cronológico.
- Validación fuera de muestra.
- Walk-forward exacto de 4, 5 o 6 bloques.
- Ranking de estabilidad.
- Promedio por bloques.
- Peor bloque.
- Variación entre bloques.
- Cobertura temporal.

PRIMERA PRUEBA
Mercado R_50
Dirección Todas
TRAIN 70%
Mínimo TRAIN 30
Mínimo TEST 15
Bucket 100 ms
Confianza 10 puntos
4 bloques
Caída máxima 8
Solo finalizadas sí
Solo automático no
