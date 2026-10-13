import test from 'node:test';
import assert from 'node:assert/strict';
import { firebaseConfig, OperationType, handleFirestoreError } from '../src/firebase.js';

test('Firebase configuration contains all required project identifiers', () => {
  assert.equal(firebaseConfig.projectId, 'gen-lang-client-0818748893');
  assert.ok(firebaseConfig.apiKey, 'API key must be present');
  assert.ok(firebaseConfig.authDomain, 'authDomain must be present');
  assert.ok(firebaseConfig.firestoreDatabaseId, 'firestoreDatabaseId must be present');
});

test('OperationType covers all standard CRUD operations', () => {
  assert.equal(OperationType.CREATE, 'create');
  assert.equal(OperationType.UPDATE, 'update');
  assert.equal(OperationType.DELETE, 'delete');
  assert.equal(OperationType.LIST, 'list');
  assert.equal(OperationType.GET, 'get');
  assert.equal(OperationType.WRITE, 'write');
});

test('handleFirestoreError formats structured error JSON conforming to specification', () => {
  let thrownError = null;
  try {
    handleFirestoreError(new Error('Missing or insufficient permissions.'), OperationType.CREATE, 'users/user123/sessions/sess456');
  } catch (err) {
    thrownError = err;
  }
  assert.ok(thrownError, 'Must throw error');
  const parsed = JSON.parse(thrownError.message);
  assert.equal(parsed.operationType, 'create');
  assert.equal(parsed.path, 'users/user123/sessions/sess456');
  assert.equal(parsed.error, 'Missing or insufficient permissions.');
  assert.ok('authInfo' in parsed, 'Must include authInfo');
});
