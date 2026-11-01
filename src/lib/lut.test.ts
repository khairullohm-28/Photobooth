import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseCubeFile, resampleLut3D } from './lut.js';

describe('LUT .cube Parser', () => {
  it('parses valid 3D .cube file with TITLE and RGB data', () => {
    const cubeSample = `
# Wedding Warm LUT
TITLE "Wedding Warmth"
LUT_3D_SIZE 2
0.0 0.0 0.0
1.0 0.0 0.0
0.0 1.0 0.0
1.0 1.0 0.0
0.0 0.0 1.0
1.0 0.0 1.0
0.0 1.0 1.0
1.0 1.0 1.0
`;
    const parsed = parseCubeFile(cubeSample);
    assert.strictEqual(parsed.title, 'Wedding Warmth');
    assert.strictEqual(parsed.size, 2);
    assert.strictEqual(parsed.data.length, 2 * 2 * 2 * 3);
    assert.strictEqual(parsed.data[0], 0.0);
    assert.strictEqual(parsed.data[parsed.data.length - 1], 1.0);
  });

  it('rejects LUT_1D_SIZE with explicit error message', () => {
    const cube1D = `
# 1D LUT
TITLE "Simple Curves"
LUT_1D_SIZE 256
0.0 0.0 0.0
1.0 1.0 1.0
`;
    assert.throws(
      () => {
        parseCubeFile(cube1D);
      },
      (err: any) => {
        assert.ok(err.message.includes('File ini LUT 1D, hanya LUT 3D yang didukung'));
        return true;
      }
    );
  });

  it('rejects LUT_3D_SIZE out of bounds (> 65 or < 2)', () => {
    const invalidSize = `
LUT_3D_SIZE 128
`;
    assert.throws(
      () => {
        parseCubeFile(invalidSize);
      },
      (err: any) => {
        assert.ok(err.message.includes('Ukuran LUT tidak valid'));
        return true;
      }
    );
  });

  it('rejects file when data row count does not match N^3', () => {
    const incomplete = `
LUT_3D_SIZE 2
0.0 0.0 0.0
1.0 0.0 0.0
`;
    assert.throws(
      () => {
        parseCubeFile(incomplete);
      },
      (err: any) => {
        assert.ok(err.message.includes('Jumlah baris data tidak sesuai'));
        return true;
      }
    );
  });

  it('normalizes RGB values according to DOMAIN_MIN and DOMAIN_MAX', () => {
    const cubeWithDomain = `
TITLE "Extended Range"
LUT_3D_SIZE 2
DOMAIN_MIN 0.0 0.0 0.0
DOMAIN_MAX 2.0 2.0 2.0
0.0 0.0 0.0
2.0 0.0 0.0
0.0 2.0 0.0
2.0 2.0 0.0
0.0 0.0 2.0
2.0 0.0 2.0
0.0 2.0 2.0
2.0 2.0 2.0
`;
    const parsed = parseCubeFile(cubeWithDomain);
    assert.strictEqual(parsed.data[3], 1.0); // 2.0 / 2.0 = 1.0
    assert.strictEqual(parsed.data[parsed.data.length - 1], 1.0);
  });

  it('correctly resamples 3D data grid when downsampling', () => {
    // 3x3x3 grid
    const size3 = 3;
    const data3 = new Float32Array(size3 * size3 * size3 * 3);
    for (let i = 0; i < data3.length; i++) {
      data3[i] = 0.5;
    }

    const resampled = resampleLut3D(data3, 3, 2);
    assert.strictEqual(resampled.length, 2 * 2 * 2 * 3);
    assert.strictEqual(resampled[0], 0.5);
  });
});
