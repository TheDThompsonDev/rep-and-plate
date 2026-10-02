export class AccountAccessError extends Error {
  constructor(public readonly reason: 'signin' | 'setup', message: string) {
    super(message);
    this.name = 'AccountAccessError';
  }
}
