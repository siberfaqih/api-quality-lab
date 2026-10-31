import { createInventoryServer } from "./app.ts";

const portRaw = process.env["PORT"] ?? "3000";
const port = Number(portRaw);
if (!Number.isInteger(port) || port < 0 || port > 65_535) {
  console.error(`Invalid PORT value: ${portRaw}`);
  process.exit(1);
}

const { server } = createInventoryServer();

server.listen(port, "127.0.0.1", () => {
  console.log(`inventory sut listening on http://127.0.0.1:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => {
      process.exit(0);
    });
  });
}
