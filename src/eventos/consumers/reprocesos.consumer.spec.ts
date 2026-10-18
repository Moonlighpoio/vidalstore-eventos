import { MalformedMessageError } from '../../mensajeria/errors';
import { QUEUES } from '../../mensajeria/topologia';
import { MensajeMuerto } from '../entities/mensaje-muerto.entity';
import { ReprocesosConsumer } from './reprocesos.consumer';

type Handler = (payload: unknown, raw: string, message: unknown) => Promise<void>;

function crear(fila: Partial<MensajeMuerto> | null) {
  const rabbit = {
    consume: jest.fn(),
    publish: jest.fn().mockResolvedValue(undefined),
  };
  const repository = {
    findOne: jest.fn().mockResolvedValue(fila),
    save: jest.fn().mockResolvedValue(undefined),
  };

  const consumer = new ReprocesosConsumer(
    rabbit as never,
    repository as never,
  );

  const [, handler] = rabbit.consume.mock.calls[0] as [string, Handler];

  return { rabbit, repository, handler, consumer };
}

const UUID_VALIDO = '11111111-2222-4333-8444-555555555555';

describe('ReprocesosConsumer', () => {
  it('se suscribe a la cola de reprocesos', () => {
    const { rabbit } = crear(null);
    expect(rabbit.consume).toHaveBeenCalledWith(
      QUEUES.reprocesos,
      expect.any(Function),
    );
  });

  it('republica el evento original con el mismo x-evento-id', async () => {
    const fila = {
      id: 'muerto-1',
      exchangeOrigen: 'vidalstore.eventos',
      routingKey: 'licencia.revocada',
      eventoId: UUID_VALIDO,
      payload: '{"licenciaId":"l-1","usuarioSub":"u-1"}',
    };
    const { rabbit, repository, handler } = crear(fila);

    await handler(
      {
        mensajeMuertoId: 'muerto-1',
        solicitadoPor: 'admin-1',
      },
      '',
      {},
    );

    expect(rabbit.publish).toHaveBeenCalledWith(
      'vidalstore.eventos',
      'licencia.revocada',
      { licenciaId: 'l-1', usuarioSub: 'u-1' },
      UUID_VALIDO,
    );
    expect(repository.save).toHaveBeenCalledTimes(2);
  });

  it('genera y persiste un x-evento-id cuando falta o es inválido', async () => {
    const fila = {
      id: 'muerto-2',
      exchangeOrigen: 'vidalstore.eventos',
      routingKey: 'licencia.revocada',
      eventoId: null as string | null,
      payload: '{"usuarioSub":"u-2"}',
    };
    const { rabbit, handler } = crear(fila);

    await handler(
      { mensajeMuertoId: 'muerto-2', solicitadoPor: 'admin-2' },
      '',
      {},
    );

    const eventoIdPublicado = rabbit.publish.mock.calls[0][3] as string;
    expect(eventoIdPublicado).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(fila.eventoId).toBe(eventoIdPublicado);
  });

  it('usa el payload corregido cuando viene', async () => {
    const fila = {
      id: 'muerto-3',
      exchangeOrigen: 'vidalstore.eventos',
      routingKey: 'licencia.revocada',
      eventoId: UUID_VALIDO,
      payload: 'no es json',
    };
    const { rabbit, handler } = crear(fila);

    await handler(
      {
        mensajeMuertoId: 'muerto-3',
        solicitadoPor: 'admin-3',
        payloadCorregido: { usuarioSub: 'corregido' },
      },
      '',
      {},
    );

    expect(rabbit.publish).toHaveBeenCalledWith(
      'vidalstore.eventos',
      'licencia.revocada',
      { usuarioSub: 'corregido' },
      UUID_VALIDO,
    );
  });

  it('falla como mal formado si el payload original no es JSON y no hay corrección', async () => {
    const fila = {
      id: 'muerto-4',
      exchangeOrigen: 'vidalstore.eventos',
      routingKey: 'licencia.revocada',
      eventoId: UUID_VALIDO,
      payload: 'no es json',
    };
    const { handler } = crear(fila);

    await expect(
      handler(
        { mensajeMuertoId: 'muerto-4', solicitadoPor: 'admin-4' },
        '',
        {},
      ),
    ).rejects.toThrow(MalformedMessageError);
  });

  it('falla como mal formado si la fila no existe', async () => {
    const { handler } = crear(null);

    await expect(
      handler(
        { mensajeMuertoId: 'inexistente', solicitadoPor: 'admin-5' },
        '',
        {},
      ),
    ).rejects.toThrow(MalformedMessageError);
  });

  it('exige solicitadoPor', async () => {
    const { handler } = crear({ id: 'x' } as MensajeMuerto);

    await expect(
      handler({ mensajeMuertoId: 'x' }, '', {}),
    ).rejects.toThrow(MalformedMessageError);
  });
});
