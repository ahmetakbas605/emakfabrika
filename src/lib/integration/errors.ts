export class IntegrationError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}
