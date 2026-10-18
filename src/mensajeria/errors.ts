export class MalformedMessageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MalformedMessageError';
  }
}

export function isMalformedMessageError(
  error: unknown,
): error is MalformedMessageError {
  return error instanceof MalformedMessageError;
}

export function isUniqueViolation(error: unknown): boolean {
  const candidate = error as {
    code?: string;
    driverError?: { code?: string };
  };

  return (
    candidate?.code === '23505' ||
    candidate?.driverError?.code === '23505'
  );
}
