export default class EnhancedError extends Error {
  private cause: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.cause = cause;
  }
}
