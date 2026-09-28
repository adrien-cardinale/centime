export type ServiceErrorStatus = 400 | 404 | 409

export class ServiceError extends Error {
  constructor(
    message: string,
    readonly status: ServiceErrorStatus = 400,
  ) {
    super(message)
  }
}

export function notFound(message: string): ServiceError {
  return new ServiceError(message, 404)
}
