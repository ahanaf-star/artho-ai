import test from 'node:test';
import assert from 'node:assert/strict';

test('AI Coach User Personalization Test Suite', async (t) => {
  const BASE_URL = 'http://localhost:3000';

  await t.test('1. User A ("Rahim Uddin") receives greeting with User A first name in English', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Hi, can you give me an overview?',
        isBangla: false,
        financialContext: { userName: 'Rahim Uddin' },
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.text.startsWith('Assalamu Alaikum Rahim!'), `Expected greeting to start with 'Assalamu Alaikum Rahim!', got: ${data.text.slice(0, 40)}`);
    assert.ok(!data.text.includes('Ahmed'), 'Response must not contain hardcoded Ahmed');
  });

  await t.test('2. User B ("Karim Chowdhury") receives greeting with User B first name in English', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Hi, can you give me an overview?',
        isBangla: false,
        financialContext: { userName: 'Karim Chowdhury' },
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.text.startsWith('Assalamu Alaikum Karim!'), `Expected greeting to start with 'Assalamu Alaikum Karim!', got: ${data.text.slice(0, 40)}`);
    assert.ok(!data.text.includes('Rahim'), 'User B response must not contain User A name');
    assert.ok(!data.text.includes('Ahmed'), 'Response must not contain hardcoded Ahmed');
  });

  await t.test('3. User C ("Ayesha Siddiqua") receives greeting with User C first name in English', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Hi, can you give me an overview?',
        isBangla: false,
        financialContext: { userName: 'Ayesha Siddiqua' },
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.text.startsWith('Assalamu Alaikum Ayesha!'), `Expected greeting to start with 'Assalamu Alaikum Ayesha!', got: ${data.text.slice(0, 40)}`);
    assert.ok(!data.text.includes('Karim'), 'User C response must not contain User B name');
    assert.ok(!data.text.includes('Ahmed'), 'Response must not contain hardcoded Ahmed');
  });

  await t.test('4. User with missing name receives neutral greeting without any placeholder or random name', async () => {
    const res = await fetch(`${BASE_URL}/api/ai/coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Hi, can you give me an overview?',
        isBangla: false,
        financialContext: { userName: '' },
      }),
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.text.startsWith('Assalamu Alaikum!'), `Expected greeting to start with 'Assalamu Alaikum!', got: ${data.text.slice(0, 40)}`);
    assert.ok(!data.text.includes('Ahmed'), 'Must not contain Ahmed');
    assert.ok(!data.text.includes('User'), 'Must not contain User');
    assert.ok(!data.text.includes('Guest'), 'Must not contain Guest');
    assert.ok(!data.text.includes('there'), 'Must not contain "there" placeholder');
  });

  await t.test('5. Bangla greeting with name ("Rahim") and without name (neutral)', async () => {
    const resNamed = await fetch(`${BASE_URL}/api/ai/coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Hi',
        isBangla: true,
        financialContext: { userName: 'Rahim Uddin' },
      }),
    });
    assert.equal(resNamed.status, 200);
    const dataNamed = await resNamed.json();
    assert.ok(dataNamed.text.startsWith('আসসালামু আলাইকুম Rahim!'), `Expected Bangla greeting with name, got: ${dataNamed.text.slice(0, 40)}`);

    const resNeutral = await fetch(`${BASE_URL}/api/ai/coach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Hi',
        isBangla: true,
        financialContext: { userName: '  ' },
      }),
    });
    assert.equal(resNeutral.status, 200);
    const dataNeutral = await resNeutral.json();
    assert.ok(dataNeutral.text.startsWith('আসসালামু আলাইকুম!'), `Expected neutral Bangla greeting, got: ${dataNeutral.text.slice(0, 40)}`);
    assert.ok(!dataNeutral.text.includes('আহমেদ'), 'Bangla neutral greeting must not contain আহমেদ');
    assert.ok(!dataNeutral.text.includes('গ্রাহক'), 'Bangla neutral greeting must not contain গ্রাহক placeholder');
  });

  await t.test('6. Authenticated JWT token overrides or supplies authenticated user name', async () => {
    // Login as demo user
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ahmed.rahman@arthobachao.ai',
        password: 'ahmed123',
      }),
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.ok(loginData.token, 'Should return JWT token');

    // Call /api/ai/coach with Bearer token without providing userName in financialContext
    const coachRes = await fetch(`${BASE_URL}/api/ai/coach`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${loginData.token}`,
      },
      body: JSON.stringify({
        prompt: 'Overview',
        isBangla: false,
        financialContext: {},
      }),
    });
    assert.equal(coachRes.status, 200);
    const coachData = await coachRes.json();
    // Since login was Ahmed Rahman, the verified JWT attaches Ahmed Rahman
    assert.ok(coachData.text.startsWith('Assalamu Alaikum Ahmed!'), `Expected JWT authenticated name Ahmed, got: ${coachData.text.slice(0, 40)}`);
  });

  await t.test('7. askFinancialCoach client fallback honors custom user names and neutral fallback', async () => {
    const { askFinancialCoach } = await import('../../src/services/aiService');
    
    // Test User A (Rahim)
    const msgRahim = await askFinancialCoach('Hello overview', [], [], 35000, false, 'Rahim Uddin');
    assert.ok(msgRahim.text.includes('Assalamu Alaikum Rahim!'), `Expected greeting with Rahim, got: ${msgRahim.text.slice(0, 40)}`);
    assert.ok(!msgRahim.text.includes('Ahmed'), 'Must not contain Ahmed');

    // Test User with no name (neutral)
    const msgNeutral = await askFinancialCoach('Hello overview', [], [], 35000, false, '');
    assert.ok(msgNeutral.text.startsWith('Assalamu Alaikum!'), `Expected neutral greeting without name, got: ${msgNeutral.text.slice(0, 40)}`);
    assert.ok(!msgNeutral.text.includes('Ahmed'), 'Must not contain Ahmed');
    assert.ok(!msgNeutral.text.includes('there'), 'Must not contain "there"');
    assert.ok(!msgNeutral.text.includes('User'), 'Must not contain "User"');

    // Test Emergency fund question with name
    const msgEmergencyRahim = await askFinancialCoach('Am I on track for emergency fund?', [], [], 35000, false, 'Rahim Uddin');
    assert.ok(msgEmergencyRahim.text.includes('Rahim'), `Expected message to address Rahim, got: ${msgEmergencyRahim.text.slice(0, 40)}`);

    // Test Emergency fund question without name
    const msgEmergencyNeutral = await askFinancialCoach('Am I on track for emergency fund?', [], [], 35000, false, undefined);
    assert.ok(!msgEmergencyNeutral.text.includes('Rahim'), 'Neutral response must not contain Rahim');
    assert.ok(!msgEmergencyNeutral.text.includes('Ahmed'), 'Must not contain Ahmed');
  });
});
