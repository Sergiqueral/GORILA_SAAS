import buffer from 'node:buffer';

// Node 25+ compatibility polyfill for legacy dependencies (jwa / buffer-equal-constant-time)
if (!buffer.SlowBuffer) {
  buffer.SlowBuffer = buffer.Buffer;
}
if (typeof global !== 'undefined' && !global.SlowBuffer) {
  global.SlowBuffer = buffer.Buffer;
}

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;
