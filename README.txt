BACKTESTER V3.7 MR
ROBUSTEZ ESTADÍSTICA

OBJETIVO
Evaluar si la regla base parece superar al 50% por algo más que variación aleatoria.

INCLUYE
- Intervalo de confianza Wilson.
- Prueba aproximada contra 50%.
- Bootstrap.
- Probabilidad bootstrap de superar 50%.
- Probabilidad bootstrap de superar un umbral elegido.
- Sensibilidad por tamaño de muestra.
- Objetivo de muestra futura.
- Clasificación:
  EVIDENCIA ESTADÍSTICA FAVORABLE
  EVIDENCIA PROMETEDORA, AÚN INSUFICIENTE
  EVIDENCIA ESTADÍSTICA INSUFICIENTE

PRIMERA PRUEBA RECOMENDADA
R_50
Todas
TRAIN 70%
Mínimo TRAIN 30
Mínimo TEST 15
Timing 100 ms
Confianza 10
Nivel estadístico 95%
Bootstrap 3000
Umbral ventaja 55%
Objetivo de muestra 100 operaciones
Solo finalizadas: sí

NOTA
La prueba binomial incluida es una aproximación normal unilateral.
El bootstrap describe incertidumbre sobre este historial; no garantiza resultados futuros.
