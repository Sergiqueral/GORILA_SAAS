import buffer from "node:buffer";

// Polyfill para Node.js 25+ donde Buffer.SlowBuffer fue retirado
// Requerido por buffer-equal-constant-time (dependencia de jsonwebtoken / jwa / firebase-admin)
if (!(buffer as any).SlowBuffer) {
  (buffer as any).SlowBuffer = buffer.Buffer;
}

if (typeof global !== "undefined" && !(global as any).SlowBuffer) {
  (global as any).SlowBuffer = buffer.Buffer;
}
