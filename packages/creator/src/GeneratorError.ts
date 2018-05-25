export default class GeneratorError extends Error {
  public name: string;

  constructor(message: string) {
    super(message);
    this.name = 'GeneratorError';
  }
}
