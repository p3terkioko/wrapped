// Local development database: Postgres (PGlite, WebAssembly) served over a
// normal Postgres socket so Prisma can connect with a postgres:// URL.
// Data persists in .devdb/ (gitignored). Never used in production.
//
//   npm run dev:db          start on 127.0.0.1:5433
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, '.devdb');
const port = Number(process.env.DEV_DB_PORT || 5433);

const db = await PGlite.create(dataDir);
// The socket server multiplexes several client connections over PGlite's
// single session (Prisma, scripts and the dev server can share it).
const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 10 });
await server.start();
console.log(`dev db ready on postgresql://postgres:postgres@127.0.0.1:${port}/postgres (data: .devdb/)`);

const stop = async () => { await server.stop(); await db.close(); process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
