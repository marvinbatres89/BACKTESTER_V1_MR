BACKTESTER V3.2 MR
Objetivo: buscar una condición adicional dentro de una regla base validada sin escogerla usando el TEST.

Flujo:
1. Orden cronológico.
2. TRAIN descubre la regla base.
3. TEST valida la regla base.
4. Dentro de esa regla, TRAIN descubre subfiltros de campos disponibles en la telemetría.
5. TEST comprueba esos subfiltros.
6. El mejor subfiltro validado pasa por walk-forward.

Primera prueba recomendada:
R_50 / Todas / TRAIN 70% / mínimo TRAIN 30 / mínimo TEST 15 /
timing 100 ms / confianza 10 / subfiltro TRAIN 12 / subfiltro TEST 8 /
caída máxima 8 / 4 bloques.
