# AGENTS.md — Memoria del proyecto

## Qué es esto
- **Portal del Sada F.C. A Nosa Viña**: web estática + Node (`server.js`) con convocatoria, actas, clasificación y estadísticas.
- **DB**: Turso (cloud) vía `@libsql/client` — ver `db.js` + `.env` (`TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`). **NO** usar `sada.db` local (obsoleto).
- **Deploy**: `git push` a `github.com:fnaveira/sada-cf-portal` → Render auto-despliega en https://sada-cf-portal.onrender.com/
- **API clave**: `GET /api/init` (todo el estado), `PUT /api/convocatoria` (marcar pendingConfirm).

## App "Ficha del Partido" (macOS)
- Fuentes: `FichaPartido/` (`main.swift`, `index.html`, `Info.plist`) — WKWebView que carga `index.html` e inyecta JSON de `https://sada-cf-portal.onrender.com/api/init` en el placeholder `/*__LIVE__*/null`.
- Reconstruir tras tocar `index.html`:
  ```bash
  cd FichaPartido
  cp index.html "Ficha Partido.app/Contents/Resources/index.html"
  codesign --force -s - "Ficha Partido.app"
  rm -rf "/Applications/Ficha Partido.app" && cp -R "Ficha Partido.app" /Applications/
  osascript -e 'quit app "FichaPartido"'; open "/Applications/Ficha Partido.app"
  ```
- Re-compilar binario (solo si cambia `main.swift`):
  ```bash
  swiftc -O main.swift -o FichaPartido -framework WebKit
  ```
- Texto imprimible del partido: `instrucciones_portazgo.txt`.

## Consultar la IA desde el móvil (partido)
- `./opencode-movil.sh` → arranca `opencode web` en `0.0.0.0:4096` (caffeinate, el Mac no duerme) + URL.
- **Tailscale** instalado en el Mac (IP `100.105.114.89`); en el móvil: app Tailscale + misma Apple ID.
  - URL: `http://100.105.114.89:4096` · usuario `opencode` · contraseña en el script.
- Fallback: túnel Cloudflare (`trycloudflare.com`) si Tailscale no está logueado.
- Firewall: `/opt/homebrew/bin/opencode` ya tiene "Allow incoming connections".

## Partido: Portazgo S.D. (id=4)
- **27/09/2026 · 12:00 · A Lavandeira (Culleredo) · visitantes** (`home=0`).
- **Convocatoria: 18/18 confirmados** (pendingConfirm = []). IDs: 1,4,5,7,9,10,12,13,14,15,16,18,19,20,21,24,25,100.
- Yuyi = id 100, dorsal 3, `centrocampista,defensa` (prioridad MEDIO CENTRO).

### Reglas fijas del vestuario (TODOS los partidos)
- **Pepe**: titular siempre. **★Gonzalo (Ferro)**: delantero y ESTRELLA, titular — si sale o no, lo decide el staff en el partido. **NADIE juega 90' fijos.**
- **Miguel Amor**: titular (lateral izq.) — cambio posible por **Alfonso** o **Lata**. **Albarracin: SOLO derecha.**
- **Lata**: defensa — sale al descanso (entra Alfonso/Graña).
- **César**: anclado en el MEDIO — NUNCA de delantero.
- **Sergio**: SOLO centrocampista, pocos minutos (pretemporada) — NUNCA de defensa.
- **Vizoso**: NUNCA titular, NUNCA lateral, NUNCA de cierre (sin fuerza física) — recambio para gente cansada (igual que Charlie).
- **Yuyi**: bien físicamente — prioridad MEDIO CENTRO (también zaga si hace falta).
- **Graña**: centro o delantero si Ferro no está. **Charlie**: recambio, confirmado.
- **Alfonso**: defensa central (3º zaga / cierre por Lata); `delantero,defensa`.

### Balones parados y corners
- Faltas/corners: **1º ★Bernardo · 2º Miguel Boo o Miguel Amor** · César al remate. **★Miguel Amor NO centra córners: es el CIERRE.**
- **Corners (ataque)**: **suben a rematar César, Alfonso y Roibás**; **cierran ★Lata y ★Miguel Amor**.
- **Corners en contra**: dentro Caamaño, Roibás (ancla), Lata (1er palo), Alfonso (2º palo), César (marca), ★Bernardo (rebotes). **★M.Amor cierra FUERA** con Albarracin; ★Pepe suelto de contra. No cierran: Vizoso, Sergio.

### Rotación
- **~30-35' (1ª)**: sale ★Bernardo → ★Marcos baja a su sitio → entra **Yuyi** (Bernardo fresco para la 2ª).
- **Descanso**: sale Lata → Alfonso (o Graña). Ferro: decisión del staff. Si Yuyi cansado → Toni.
- **~60'**: Toni → Sergio (solo medio ~20' máx). **~80'**: Boo → Charlie.
- Roibás no se cambia (sin central de recambio tras salir Lata).

## Partido: Liceo de Monelos S.D. (id=5) — J4
- **04/10/2026 (domingo) · 12:00 · O Loureiro (Oza dos Ríos) · LOCALES** (`home=1`, así lo lista FGF: "SADA vs LICEO"; la FGF pone la jornada en sábado 03, el partido es el domingo).
  - **Somos locales pero jugamos en el campo de Oza dos Ríos — "O Loureiro", Loureiro 3, 15380 (mismo campo que J13 vs Oza): el campo del Sada (As Mariñas/Carnoedo) está en obras** → los próximos partidos en casa pueden cambiar de sede; preguntar al mister.
- **Convocatoria: 18** (`pendingConfirm = []`). IDs: 3,4,5,7,9,10,13,14,15,16,17,18,19,20,21,25,26,100.
  - Fuera: **Caamaño (`no_disponible`)**, Cabana (`baja`), Garea/Santi/Julio (`lesionado`), Pirulo, Sergio, Albarracin.
  - "Miguel B" = **Miguel Boo** (id 10) ✓ confirmado por el mister. Mourelo (3) y Durán (17) pasan a `disponible` (estaban `no_disponible`).
  - `formation` = **4-3-3 J4, 11 titulares montados** (ids): POR Mourelo(3) · Roibás(18) Lata(21) Alfonso(4) Miguel(7) · César(16) Bernardo(13) Damián(26) · Pepe(14) Ferro(9) Boo(10). Suplentes (7): Yuyi, Toni, Graña, Vizoso, Marcos, Durán, Charlie.
  - **Plan (`MATCH_PLAN` en app.js → alimenta la "Hoja de Partido")**: Mourelo en portería la **1ª parte** (en la 2ª se decide en el vestuario: Vizoso o Graña); **Damián y Lata salen al descanso**; zaga titular Roibás-Lata-Alfonso-Miguel Amor; nadie juega 90'.

### Dorsales — fuente oficial
- `players.number` **NO** eran dorsales: eran los números de calle del campo "Número" de las fichas de licencia `NFG_GC_VisLicencia` (por eso había duplicados: Mourelo/César 10, etc.).
- Dorsales reales = columna `Nº` de `NFG_CMP_Alineacion_Resultados` (actas de J1/J2/J3 y Copa). **24/26 confirmados y ya aplicados** (commit `479d6f0`): Caamaño 1 · Garea 2 · Mourelo 3 · Alfonso 4 · Charlie 5 · Miguel 7 · Pirulo 9 · Ferro 10 · Boo 11 · **Durán 12 (asignado por indicación del usuario)** · Julio 13 · Santi 14 · Sergio 15 · Bernardo 16 · Yuyi 18 · Pepe 19 · Toni 21 · Damián 22 · César 23 · Roibás 25 · Graña 26 · Vizoso 27 · Marcos 28 · Lata 30.
- **Sin dorsal confirmado: Albarracin (id24), Cabana (id6)** → preguntar al mister o mirar actas futuras.

### Tarjetas — fuente oficial
- Las **actas solo listan las tarjetas del equipo local** → no sirven para contar las nuestras fuera de casa. No usar `NFG_CmpPartido` para tarjetas.
- Fuente correcta: **ficha de sanciones** `NFG_ShwSancionesJugSnc?CodTemporada=22&CodParticipante=<id>&cod_primaria=1000129` (ids en los enlaces `NFG_EQ_VisSanciones_jugador` de la plantilla `NFG_VisEquipos?cod_primaria=1000102&Codigo_Equipo=4261861`).
- **Recuento (03/10/2026)**: 🟨 Miguel 1 (J1 Narón) · 🟨 Graña 1 (J1 Narón) · 🟨 Yuyi 1 (J3 Portazgo) · 🟨 Julio 1 (Copa Larín) · 🟥 0 → **nadie suspendido**.
- Sync: `node -r dotenv/config scrape-futgal.js sanciones` → reconstruye `match_cards` + `players.yellowCards/redCards` (respeta los minutos ya guardados).

## Comandos útiles
- Verificar API en vivo: `curl -s https://sada-cf-portal.onrender.com/api/init | head -c 300`
- Consultar Turso: `node -e "const db=require('./db.js'); db.execute({sql:'...'}).then(r=>console.log(r.rows))"`
- Estado servidor móvil: `pgrep -lf "opencode web"`
