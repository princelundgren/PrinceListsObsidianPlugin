import { describe, expect, test } from 'vitest';
import { WriteEchoes } from '../../src/core/write-echoes';

describe('WriteEchoes', () => {
	test('a report of a write that a later write followed is still that write', () => {
		const echoes = new WriteEchoes();
		echoes.wrote('two');
		echoes.wrote('three');
		expect(echoes.isEcho('two')).toBe(true);
		expect(echoes.isEcho('three')).toBe(true);
	});

	test('each write is reported once', () => {
		const echoes = new WriteEchoes();
		echoes.wrote('two');
		expect(echoes.isEcho('two')).toBe(true);
		expect(echoes.isEcho('two')).toBe(false);
	});

	test('a report of a later write ends the wait for earlier ones', () => {
		const echoes = new WriteEchoes();
		echoes.wrote('two');
		echoes.wrote('three');
		expect(echoes.isEcho('three')).toBe(true);
		expect(echoes.isEcho('two')).toBe(false);
	});

	test('text no write made is an outside change, and ends the wait', () => {
		const echoes = new WriteEchoes();
		echoes.wrote('two');
		expect(echoes.isEcho('typed elsewhere')).toBe(false);
		expect(echoes.isEcho('two')).toBe(false);
	});
});
