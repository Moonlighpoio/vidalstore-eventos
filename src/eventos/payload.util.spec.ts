import { MalformedMessageError } from '../mensajeria/errors';
import { readEventHeaders, requireString } from './payload.util';

describe('payload.util', () => {
  describe('requireString', () => {
    it('devuelve el valor cuando el campo es una cadena no vacía', () => {
      expect(requireString({ usuarioSub: 'u-1' }, 'usuarioSub')).toBe('u-1');
    });

    it('lanza MalformedMessageError cuando el campo falta', () => {
      expect(() => requireString({}, 'usuarioSub')).toThrow(
        MalformedMessageError,
      );
    });

    it('lanza MalformedMessageError cuando el campo es una cadena vacía', () => {
      expect(() => requireString({ juegoId: '' }, 'juegoId')).toThrow(
        MalformedMessageError,
      );
    });

    it('lanza MalformedMessageError cuando el campo no es una cadena', () => {
      expect(() => requireString({ juegoId: 42 }, 'juegoId')).toThrow(
        MalformedMessageError,
      );
    });
  });

  describe('readEventHeaders', () => {
    it('lee x-evento-id y x-emitido-en', () => {
      const message = {
        properties: {
          headers: {
            'x-evento-id': 'id-1',
            'x-emitido-en': '2026-01-01T00:00:00.000Z',
          },
        },
      } as never;

      expect(readEventHeaders(message)).toEqual({
        eventoId: 'id-1',
        emitidoEn: '2026-01-01T00:00:00.000Z',
      });
    });

    it('devuelve cadenas vacías cuando no hay cabeceras', () => {
      const message = { properties: {} } as never;

      expect(readEventHeaders(message)).toEqual({
        eventoId: '',
        emitidoEn: '',
      });
    });
  });
});
