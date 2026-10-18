import { connect } from 'amqplib';
import { EXCHANGES, ROUTING_KEYS } from '../src/mensajeria/topologia';

/**
 * Publica a propósito un mensaje mal formado (sin usuarioSub) en
 * licencia.revocada para demostrar el recorrido completo:
 * entra -> falla -> cae a la DLQ -> queda en el log y en mensajes_muertos.
 */
async function main(): Promise<void> {
  const url = process.env.RABBITMQ_URL ?? 'amqp://localhost:5672';
  const connection = await connect(url);
  const channel = await connection.createChannel();

  const payload = {
    licenciaId: 'malo-001',
    juegoId: 'ftg-540',
    // usuarioSub ausente a propósito: el mensaje está mal formado.
    revocadaPor: 'admin-001',
    motivo: 'mensaje envenenado de prueba',
  };

  channel.publish(
    EXCHANGES.eventos,
    ROUTING_KEYS.licenciaRevocada,
    Buffer.from(JSON.stringify(payload)),
    {
      persistent: true,
      contentType: 'application/json',
      headers: {
        'x-evento-id': '00000000-0000-4000-8000-000000000000',
        'x-emitido-en': new Date().toISOString(),
      },
    },
  );

  console.log('Mensaje envenenado publicado en licencia.revocada');

  await channel.close();
  await connection.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
