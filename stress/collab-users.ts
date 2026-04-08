/**
 * Collab Stress Test — simulated WebSocket user that connects,
 * types random words, and reports metrics.
 */

import * as Y from 'yjs';
import { HocuspocusProvider } from '@hocuspocus/provider';
import WebSocket from 'ws';
import {
  type UserMetrics,
  DOC_ID,
  WS_URL,
  TYPING_MS,
  DURATION_S,
  randomWord,
} from './config.js';

// Polyfill WebSocket for Node.js (HocuspocusProvider expects a browser WebSocket)
Object.assign(globalThis, { WebSocket });

export function spawnUser(userId: number, metrics: UserMetrics[]): Promise<UserMetrics> {
  return new Promise((resolve) => {
    const m: UserMetrics = {
      userId,
      connected: false,
      connectTimeMs: 0,
      charsTyped: 0,
      updatesReceived: 0,
      errors: [],
    };
    metrics.push(m);

    const ydoc = new Y.Doc();
    const connectStart = Date.now();
    let typingInterval: ReturnType<typeof setInterval> | null = null;

    const provider = new HocuspocusProvider({
      url: WS_URL,
      name: DOC_ID,
      document: ydoc,
      token: 'dev',
      onConnect() {
        m.connected = true;
        m.connectTimeMs = Date.now() - connectStart;

        // Start typing random content
        const text = ydoc.getXmlFragment('default');
        typingInterval = setInterval(() => {
          try {
            ydoc.transact(() => {
              const word = randomWord() + ' ';
              const textNode = new Y.XmlText(word);
              const pos = Math.min(text.length, Math.floor(Math.random() * (text.length + 1)));
              text.insert(pos, [textNode]);
              m.charsTyped += word.length;
            });
          } catch (err) {
            m.errors.push(`type error: ${err instanceof Error ? err.message : String(err)}`);
          }
        }, TYPING_MS);
      },
      onDisconnect() {
        if (!m.connected) {
          m.errors.push('disconnected before connecting');
        }
      },
    });

    // Count remote updates
    ydoc.on('update', () => {
      m.updatesReceived++;
    });

    // Stop after duration
    setTimeout(() => {
      if (typingInterval) clearInterval(typingInterval);
      provider.disconnect();
      ydoc.destroy();
      resolve(m);
    }, DURATION_S * 1000);
  });
}
