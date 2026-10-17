export const EXCHANGES = {
  eventos: 'vidalstore.eventos',
  comandos: 'vidalstore.comandos',
  dlx: 'vidalstore.dlx',
} as const;

export const EXCHANGE_TYPES = {
  eventos: 'topic',
  comandos: 'direct',
  dlx: 'direct',
} as const;

export const ROUTING_KEYS = {
  compraRealizada: 'compra.realizada',
  licenciaRevocada: 'licencia.revocada',
  juegoPublicado: 'juego.publicado',
  correoEnviar: 'correo.enviar',
  dlqReprocesar: 'dlq.reprocesar',
} as const;

export const QUEUES = {
  avisos: 'avisos',
  auditoria: 'auditoria',
  correos: 'correos',
  reprocesos: 'reprocesos',
  avisosDlq: 'avisos.dlq',
  auditoriaDlq: 'auditoria.dlq',
  correosDlq: 'correos.dlq',
  reprocesosDlq: 'reprocesos.dlq',
} as const;

export const WORK_QUEUES = [
  QUEUES.avisos,
  QUEUES.auditoria,
  QUEUES.correos,
  QUEUES.reprocesos,
] as const;

export const DEAD_LETTER_QUEUES = {
  [QUEUES.avisos]: QUEUES.avisosDlq,
  [QUEUES.auditoria]: QUEUES.auditoriaDlq,
  [QUEUES.correos]: QUEUES.correosDlq,
  [QUEUES.reprocesos]: QUEUES.reprocesosDlq,
} as const;

export interface Binding {
  exchange: string;
  queue: string;
  routingKey: string;
}

// Índice de avisos: qué eventos ameritan aviso al jugador (mínimo licencia.revocada).
export const AVISOS_BINDINGS: string[] = [
  ROUTING_KEYS.licenciaRevocada,
  ROUTING_KEYS.compraRealizada,
];

export const BINDINGS: Binding[] = [
  ...AVISOS_BINDINGS.map((routingKey) => ({
    exchange: EXCHANGES.eventos,
    queue: QUEUES.avisos,
    routingKey,
  })),
  { exchange: EXCHANGES.eventos, queue: QUEUES.auditoria, routingKey: '#' },
  { exchange: EXCHANGES.comandos, queue: QUEUES.correos, routingKey: ROUTING_KEYS.correoEnviar },
  { exchange: EXCHANGES.comandos, queue: QUEUES.reprocesos, routingKey: ROUTING_KEYS.dlqReprocesar },
  { exchange: EXCHANGES.dlx, queue: QUEUES.avisosDlq, routingKey: QUEUES.avisos },
  { exchange: EXCHANGES.dlx, queue: QUEUES.auditoriaDlq, routingKey: QUEUES.auditoria },
  { exchange: EXCHANGES.dlx, queue: QUEUES.correosDlq, routingKey: QUEUES.correos },
  { exchange: EXCHANGES.dlx, queue: QUEUES.reprocesosDlq, routingKey: QUEUES.reprocesos },
];

// Políticas de retención declaradas en el repositorio (no en la interfaz).
export const MAX_MESSAGE_TTL_MS = 86_400_000; // 1 día
export const WORK_QUEUE_MAX_LENGTH = 10_000;

export const WORK_QUEUE_ARGUMENTS = {
  'x-max-length': WORK_QUEUE_MAX_LENGTH,
  'x-message-ttl': MAX_MESSAGE_TTL_MS,
  'x-overflow': 'reject-publish',
} as const;

export const HEADERS = {
  eventoId: 'x-evento-id',
  emitidoEn: 'x-emitido-en',
} as const;

export const DEFAULT_EXCHANGE = '';
export const EVENTO_CONTENT_TYPE = 'application/json';
