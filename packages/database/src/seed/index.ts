// W2: Runtime seed entrypoints consumed by apps/api-core DemoDataService.
// The demo pipeline itself remains unchanged (seed-demo.ts is the source of
// truth); this barrel only exposes it for server-side invocation.
export { seedDemo } from './seed-demo';
