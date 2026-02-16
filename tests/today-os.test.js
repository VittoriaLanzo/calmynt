const assert = require('assert');
const TodayOS = require('../today-os');

function runTests() {
  // triage with time
  const triagedEvent = TodayOS.triageInput('Meet Sam at 14:30', 9 * 60);
  assert.strictEqual(triagedEvent.kind, 'event');
  assert.strictEqual(triagedEvent.start, '14:30');

  const triagedTomorrow = TodayOS.triageInput('Doctor tomorrow 9', 9 * 60);
  assert.strictEqual(triagedTomorrow.kind, 'event');
  assert.strictEqual(triagedTomorrow.start, '09:00');

  const triagedRelative = TodayOS.triageInput('Email in 30m', 9 * 60);
  assert.strictEqual(triagedRelative.kind, 'task');
  assert.strictEqual(triagedRelative.relativeMinutes, 30);

  // triage without time
  const triagedTask = TodayOS.triageInput('Write essay', 9 * 60);
  assert.strictEqual(triagedTask.kind, 'task');

  // duration estimation
  assert.strictEqual(TodayOS.estimateDuration('Study for exam', 'task'), 50);
  assert.strictEqual(TodayOS.estimateDuration('Send email', 'task'), 10);
  assert.strictEqual(TodayOS.estimateDuration('Team call', 'task'), 15);
  assert.strictEqual(TodayOS.estimateDuration('Lunch', 'event'), 30);

  // buffer insertion
  const blocks = [
    { id: 'a', startMinutes: 9 * 60, duration: 30 },
    { id: 'b', startMinutes: 10 * 60, duration: 30 },
  ];
  const withBuffers = TodayOS.insertBuffers(blocks, 5);
  assert.strictEqual(withBuffers.length, 3);
  assert.strictEqual(withBuffers[1].kind, 'buffer');
  assert.strictEqual(withBuffers[1].duration, 5);

  // hard caps
  const tasks = [
    { priority: 'must' },
    { priority: 'must' },
    { priority: 'must' },
    { priority: 'optional' },
  ];
  assert.strictEqual(TodayOS.applyHardCaps(tasks, 'must'), false);
  assert.strictEqual(TodayOS.applyHardCaps(tasks, 'optional'), true);

  // auto-replan with protected block
  const schedule = [
    { id: 'p', startMinutes: 12 * 60, duration: 60, protected: true },
    { id: 'x', startMinutes: 11 * 60, duration: 60, protected: false },
  ];
  const replanned = TodayOS.autoReplan({ nowMinutes: 11 * 60, blocks: schedule, bufferMinutes: 5, dayEndMinutes: 18 * 60 });
  assert.strictEqual(replanned.deferred.length, 1);
  assert.strictEqual(replanned.deferred[0].id, 'x');

  console.log('All Today OS tests passed.');
}

runTests();
