BACKTESTER V3.4 MR - PRE-ENTRY ONLY

MEJORA PRINCIPAL
La V3.4 solo permite campos disponibles antes de decidir/ejecutar la entrada.

BLOQUEA:
- profit / resultado / payout / cierre
- estados finales del contrato
- buy / purchase / confirmaciones
- buyConfirmedEpoch
- buyLatencyMs
- manualClickToBuyMs
- proposalId / contractId
- datos de ejecución o transacción
- cualquier campo que pueda aparecer después de la decisión

NUEVA VALIDACIÓN DE ESTABILIDAD
Un subfiltro ya no se considera bueno solo por tener TEST alto.
También debe cumplir:
- mínimo de operaciones TRAIN
- mínimo de operaciones TEST
- exactitud mínima TEST
- peor bloque mínimo
- variación máxima entre bloques
- cobertura de todos los bloques

PRIMERA PRUEBA
R_50
Todas
TRAIN 70%
Mínimo TRAIN regla 30
Mínimo TEST regla 15
Bucket timing 100 ms
Confianza 10 puntos
Mínimo subfiltro TRAIN 18
Mínimo subfiltro TEST 12
Exactitud mínima TEST 58%
Peor bloque mínimo 50%
Variación máxima 20 puntos
4 bloques
Solo finalizadas: sí
