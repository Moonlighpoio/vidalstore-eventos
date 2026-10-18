# vidalstore-eventos

Servicio consumidor del caso EP2 **VidalStore** (DSY1107). Escucha los eventos
del broker, guarda la auditoría, genera avisos, simula el envío de correos y
registra los mensajes que terminan en las colas de mensajes muertos (DLQ).

Puerto: **3010**. Su único endpoint HTTP es `GET /salud`.

## Qué consume

| Cola        | Routing key(s)                                   | Qué hace                                            |
| ----------- | ------------------------------------------------ | --------------------------------------------------- |
| `avisos`    | `licencia.revocada`, `compra.realizada`          | Publica `correo.enviar` a `vidalstore.comandos`     |
| `auditoria` | `#` (todo `vidalstore.eventos`)                  | Inserta en `eventos.eventos_auditoria` (idempotente)|
| `correos`   | `correo.enviar`                                  | Loguea el envío e inserta en `notificaciones`       |
| `reprocesos`| `dlq.reprocesar`                                 | Republica un mensaje muerto y marca la fila (4.9)   |
| `*.dlq`     | cola origen                                      | Inserta en `mensajes_muertos`                        |

## Reglas de mensajería

- Contenido `application/json`; cabeceras `x-evento-id` y `x-emitido-en`.
- Mensajes y colas durables; publicaciones `persistent: true`.
- Toda cola de trabajo apunta a `vidalstore.dlx` con la DLQ del mismo nombre.
- Idempotencia de la auditoría por `UNIQUE(evento_id)` en `eventos_auditoria`
  (código `23505`); idempotencia del aviso por `UNIQUE(evento_id, asunto)` en
  `notificaciones`.
- Mensaje mal formado (`MalformedMessageError`) va a la DLQ de inmediato; los
  errores transitorios se reintentan un número acotado de veces y luego van a la
  DLQ.

## Reproceso de un mensaje muerto (punto 4.9, grupos de 3)

El consumidor `reprocesos` lee el comando `dlq.reprocesar` que publica
`vidalstore-admin` con `{ mensajeMuertoId, payloadCorregido?, solicitadoPor }`.
Carga la fila de `mensajes_muertos`, republica el payload (el corregido, si
vino) en su exchange y routing key originales con el `x-evento-id` original —o
uno generado y persistido si faltaba— y marca la fila con `reprocesado_en` y
`reprocesado_por`. Como conserva el `x-evento-id`, el reproceso no duplica la
auditoría ni el aviso.

## Variables de entorno

Ver `.env.example`. Claves: `RABBITMQ_URLS` (lista separada por comas para el
clúster), `RABBITMQ_PREFETCH`, `RABBITMQ_TRANSIENT_RETRIES`,
`RABBITMQ_TRANSIENT_RETRY_MS`, `DB_*` y `PORT`.

## Mensaje envenenado

```bash
npm run publicar-mensaje-malo
```

Publica un `licencia.revocada` sin `usuarioSub`; el log muestra el aviso y el
mensaje aparece en `avisos.dlq` y en la tabla `eventos.mensajes_muertos`.
