import { dev } from 'astro';
import { fileURLToPath } from 'node:url';

// Keep the server in this child process so Q can stop exactly what the menu owns.
// Astro's CLI can otherwise daemonize when launched from an agent environment.
const server = await dev({
  root: fileURLToPath(new URL('../',import.meta.url)),
  server: {host:'127.0.0.1',port:4321},
});
process.on('SIGINT',async()=>{await server.stop();process.exit(0);});
process.on('SIGTERM',async()=>{await server.stop();process.exit(0);});
