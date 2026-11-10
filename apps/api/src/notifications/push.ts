import { Injectable, Logger } from '@nestjs/common';

/**
 * Sends push notifications through Firebase Cloud Messaging.
 * Set FIREBASE_SERVICE_ACCOUNT_JSON (the service account key as one line of JSON) and run `npm i firebase-admin` in apps/api.
 * Without the key it runs in dev mode: nothing is sent, the message is only logged.
 */
@Injectable()
export class PushSender {
  private readonly log = new Logger('Push');
  private messaging: any | null | undefined;

  private async init() {
    if (this.messaging !== undefined) return this.messaging;
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (!raw) {
      this.log.warn('FIREBASE_SERVICE_ACCOUNT_JSON is not set: push runs in dev mode (logged only)');
      return (this.messaging = null);
    }
    try {
      const name = 'firebase-admin';
      const admin: any = (await import(name)).default;
      const app = admin.apps.length ? admin.app() : admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
      return (this.messaging = app.messaging());
    } catch (e) {
      this.log.error(`Could not start Firebase (is firebase-admin installed?): ${(e as Error).message}`);
      return (this.messaging = null);
    }
  }

  /** Returns the tokens Firebase says are no longer valid, so they can be removed. */
  async send(tokens: string[], title: string, body: string, data: Record<string, string> = {}): Promise<string[]> {
    if (tokens.length === 0) return [];
    const messaging = await this.init();
    if (!messaging) {
      this.log.log(`[dev] push to ${tokens.length} device(s): ${title} - ${body}`);
      return [];
    }
    const res = await messaging.sendEachForMulticast({ tokens, notification: { title, body }, data });
    const dead: string[] = [];
    res.responses.forEach((r: any, i: number) => {
      const code = r.error?.code as string | undefined;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') dead.push(tokens[i]!);
    });
    return dead;
  }
}
