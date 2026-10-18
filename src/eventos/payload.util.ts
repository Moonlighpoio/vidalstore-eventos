import { ConsumeMessage } from 'amqplib';
import { HEADERS, ROUTING_KEYS } from '../mensajeria/topologia';
import { MalformedMessageError } from '../mensajeria/errors';

export interface EventoMessage {
  routingKey: string;
  eventoId: string;
  emitidoEn: string;
  payload: Record<string, unknown>;
}

export function requireString(
  payload: Record<string, unknown>,
  field: string,
): string {
  const value = payload[field];

  if (typeof value !== 'string' || value.length === 0) {
    throw new MalformedMessageError(
      `Falta el campo obligatorio "${field}"`,
    );
  }

  return value;
}

export function readEventHeaders(
  message: ConsumeMessage,
): { eventoId: string; emitidoEn: string } {
  const headers = message.properties.headers ?? {};
  const eventoId = headers[HEADERS.eventoId];
  const emitidoEn = headers[HEADERS.emitidoEn];

  return {
    eventoId: typeof eventoId === 'string' ? eventoId : '',
    emitidoEn: typeof emitidoEn === 'string' ? emitidoEn : '',
  };
}

// Campo obligatorio por routing key (punto 4.3): un compra.realizada o un
// licencia.revicada sin usuarioSub es un mensaje mal formado y va a la DLQ.
// juego.publicado y correo.enviar no llevan usuarioSub.
const CAMPOS_OBLIGATORIOS: Record<string, string[]> = {
  [ROUTING_KEYS.compraRealizada]: ['usuarioSub'],
  [ROUTING_KEYS.licenciaRevocada]: ['usuarioSub'],
};

export function assertRequiredFields(
  routingKey: string,
  payload: Record<string, unknown>,
): void {
  for (const field of CAMPOS_OBLIGATORIOS[routingKey] ?? []) {
    requireString(payload, field);
  }
}
