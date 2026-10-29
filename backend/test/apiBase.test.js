import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveApiBase} from '../../frontend/src/services/apiBase.js';
test('local API follows the browser loopback alias without changing port or credentials policy',()=>{
  assert.equal(resolveApiBase('http://127.0.0.1:5000','http://localhost:5173/#/account'),'http://localhost:5000');
  assert.equal(resolveApiBase('http://localhost:5001/','http://127.0.0.1:5173'),'http://127.0.0.1:5001');
  assert.equal(resolveApiBase(undefined,'http://localhost:5173'),'http://localhost:5000');
  assert.equal(resolveApiBase('http://127.0.0.1:5000','http://[::1]:5173'),'http://127.0.0.1:5000');
  assert.equal(resolveApiBase('https://api.example.test','https://books.example.test'),'https://api.example.test');
  assert.equal(resolveApiBase('http://127.0.0.1:5000','http://192.168.1.5:5173'),'http://127.0.0.1:5000');
  assert.equal(resolveApiBase('http://127.0.0.1:5000','https://localhost:5173'),'http://127.0.0.1:5000');
});
