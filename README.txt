BACKTESTER V3 MR

NOVEDADES
- Separación cronológica TRAIN / TEST configurable (60/40, 70/30, 80/20).
- Descubre reglas solo en TRAIN.
- Valida esas mismas reglas en TEST sin volver a optimizarlas.
- Muestra caída de rendimiento entre TRAIN y TEST.
- Requiere muestra mínima independiente para TRAIN y TEST.
- Walk-forward simple en 4 bloques para comprobar estabilidad temporal.
- Comparación directa:
  * R_50 EVEN 0 ms
  * R_50 EVEN +100 ms
  * R_50 ODD +300 ms
- No conecta a Deriv y no ejecuta operaciones.

PRIMERA PRUEBA RECOMENDADA
Mercado: R_50
Dirección: Todas
TRAIN: 70%
Muestra mínima TRAIN: 30
Muestra mínima TEST: 15
Bucket timing: 100 ms
Confianza: tramos de 10
Top reglas: 15
Caída máxima aceptable: 8 puntos
Solo finalizadas: sí
Solo automático: no
