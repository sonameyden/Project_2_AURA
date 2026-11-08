/**
 * @jest-environment node
 */
import { describe, expect, it } from '@jest/globals';

import { AURA_SKSL } from '../lib/aura-shader';

// Skia's WebAssembly build, which ships with @shopify/react-native-skia (for web).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CanvasKitInit = require('canvaskit-wasm/bin/canvaskit.js');

describe('login aurora shader', () => {
  it('compiles with Skia and takes the uniforms the background passes', async () => {
    // Jest runs from the project folder (the app has no Node type definitions, hence the cast).
    const cwd = (globalThis as unknown as { process: { cwd(): string } }).process.cwd();
    const binDir = `${cwd}/node_modules/canvaskit-wasm/bin`;
    const CanvasKit = await CanvasKitInit({ locateFile: (file: string) => `${binDir}/${file}` });
    const errors: string[] = [];
    const effect = CanvasKit.RuntimeEffect.Make(AURA_SKSL, (error: string) => errors.push(error));
    expect(errors).toEqual([]);
    expect(effect).not.toBeNull();
    // resolution (float2) + time + glow
    expect(effect.getUniformFloatCount()).toBe(4);
  }, 30000);
});
