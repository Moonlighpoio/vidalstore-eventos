import { ConsumeMessage } from 'amqplib';
import { HEADERS } from '../mensajeria/topologia';
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
