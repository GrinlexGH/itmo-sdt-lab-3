import { test } from 'node:test';
import * as assert from 'node:assert';
import { cyclomaticComplexity, hasBody, stripCommentsAndStrings } from '../complexity';

test('straight-line function = 1', () => {
  assert.strictEqual(cyclomaticComplexity('int f() { return 1; }'), 1);
});

test('if + && + for = 4', () => {
  const code = 'void f(){ if (a && b) { } for (int i=0;i<n;i++) {} }';
  assert.strictEqual(cyclomaticComplexity(code), 4);
});

test('else if counted once, plain else not counted', () => {
  assert.strictEqual(cyclomaticComplexity('void f(){ if(a){} else if(b){} else {} }'), 3);
});

test('switch: each case counts, default does not', () => {
  const code = 'void f(){ switch(x){ case 1: break; case 2: break; default: break; } }';
  assert.strictEqual(cyclomaticComplexity(code), 3);
});

test('do-while counted once; catch, ternary and || counted', () => {
  assert.strictEqual(cyclomaticComplexity('void f(){ do { } while (x); }'), 2);
  assert.strictEqual(cyclomaticComplexity('int f(){ try{}catch(...){} return a?1:2; }'), 3);
  assert.strictEqual(cyclomaticComplexity('bool f(){ return a || b; }'), 2);
});

test('keywords in comments and strings are ignored', () => {
  const code = [
    'void f() {',
    '  // if (x) while (y)',
    '  /* for && || ? */',
    '  const char* s = "if (a && b) ? \\" while";',
    '  char c = \'?\';',
    '  auto r = R"x(if while && )x";',
    '}'
  ].join('\n');
  assert.strictEqual(cyclomaticComplexity(code), 1);
});

test('identifiers containing keywords are not counted', () => {
  assert.strictEqual(cyclomaticComplexity('int f(){ int notif = 0; int format = 1; return notif; }'), 1);
});

test('strip keeps line structure', () => {
  const src = 'a // x\nb /* y\nz */ c';
  assert.strictEqual(stripCommentsAndStrings(src).split('\n').length, 3);
});

test('hasBody distinguishes declaration from definition', () => {
  assert.strictEqual(hasBody('int f(int a);'), false);
  assert.strictEqual(hasBody('int f(int a) { return a; }'), true);
});
