import { describe, it } from 'node:test';
import assert from 'node:assert';
import { slugify, generateInitialsPrefix } from './eventService.js';

describe('Event Service Utilities', () => {
  it('slugify converts titles into clean URL-safe kebab-case', () => {
    assert.strictEqual(slugify('Wedding Monika & David!'), 'wedding-monika-david');
    assert.strictEqual(slugify('  Khai   &   Lila  '), 'khai-lila');
    assert.strictEqual(slugify('Special_Wedding-Party 2026'), 'special-wedding-party-2026');
  });

  it('generateInitialsPrefix generates 2 to 4 uppercase letters', () => {
    assert.strictEqual(generateInitialsPrefix('Monika & David'), 'MD');
    assert.strictEqual(generateInitialsPrefix('Khai & Lila Wedding'), 'KLW');
    assert.strictEqual(generateInitialsPrefix('Alexander Benjamin Christopher David'), 'ABCD');
    assert.strictEqual(generateInitialsPrefix('Samantha'), 'SAM');
  });
});
