# AGENTS.md — Memoria del proyecto

## Qué es esto
- **Portal del Sada F.C. A Nosa Viña (Veteranos)**: web estática + Node (`server.js`) con convocatoria, actas, clasificación y estadísticas.
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
- Faltas/corners: **1º ★Bernardo · 2º Miguel Boo o Miguel Amor** · César al remate.
- **Corners (ataque)**: suben Roibás, Alfonso y César; **★M.Amor queda de CIERRE atrás**.
- **Corners en contra**: dentro Caamaño, Roibás (ancla), Lata (1er palo), Alfonso (2º palo), César (marca), ★Bernardo (rebotes). **★M.Amor cierra FUERA** con Albarracin; ★Pepe suelto de contra. No cierran: Vizoso, Sergio.

### Rotación
- **~30-35' (1ª)**: sale ★Bernardo → ★Marcos baja a su sitio → entra **Yuyi** (Bernardo fresco para la 2ª).
- **Descanso**: sale Lata → Alfonso (o Graña). Ferro: decisión del staff. Si Yuyi cansado → Toni.
- **~60'**: Toni → Sergio (solo medio ~20' máx). **~80'**: Boo → Charlie.
- Roibás no se cambia (sin central de recambio tras salir Lata).

## Comandos útiles
- Verificar API en vivo: `curl -s https://sada-cf-portal.onrender.com/api/init | head -c 300`
- Consultar Turso: `node -e "const db=require('./db.js'); db.execute({sql:'...'}).then(r=>console.log(r.rows))"`
- Estado servidor móvil: `pgrep -lf "opencode web"`
