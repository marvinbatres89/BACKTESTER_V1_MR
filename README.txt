BACKTESTER V1 MR · COMPATIBLE CON BOT FIX14.x

OBJETIVO
- Analizar el TESTLOG histórico generado por el bot.
- No conecta a Deriv y no compra contratos.
- Mide ganadas/perdidas, porcentaje, rachas, mercado, dirección y timing.
- Permite filtrar confianza mínima y rango de timing.

USO EN ANDROID / PC
1. En el BOT, pulse el botón de descargar TESTLOG del panel de memoria.
2. Abra index.html del Backtester V1.
3. Pulse "CARGAR TESTLOG JSON".
4. Seleccione el archivo V14_0_TESTLOG...json / TESTLOG equivalente.
5. Pulse EJECUTAR BACKTEST.
6. Cambie mercado, dirección, confianza o timing y vuelva a ejecutar.

IMPORTANTE
Este V1 es un backtest de TELEMETRÍA/OPERACIONES ya registradas.
No reconstruye ticks que nunca fueron guardados. Para un backtest de replay tick-a-tick,
la siguiente etapa requiere un archivo de ticks históricos con timestamp y quote/último dígito.

BASE DE REFERENCIA: BOT FIX14.9 FAVORABLE ZONE GATE + LOSS PROTECTION.
