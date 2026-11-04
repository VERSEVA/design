// Live activity logic (react/activity-state.ts). Node strips the types on import.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DONE_LEAVE_MS, ACTIVITY_LABELS,
  activityState, clampProgress, percent, currentStep, ringOffset,
  leadActivity, moreCount, failedCount,
  trackDone, leaveExpired, nextLeaveIn, pruneLeft, visibleActivities,
  activityEvents, announcement,
} from '../react/activity-state.ts';

const job = (id, progress, extra = {}) => ({ id, name: `Job ${id}`, progress, ...extra });

describe('state and progress', () => {
  test('error wins over done, done over running; unknown progress is pending', () => {
    assert.equal(activityState(job('a', 0.4)), 'running');
    assert.equal(activityState(job('a', 1, { done: true })), 'done');
    assert.equal(activityState(job('a', 0.4, { error: 'Timed out' })), 'error');
    assert.equal(activityState(job('a', 1, { done: true, error: true })), 'error');
    for (const p of [undefined, null, Number.NaN]) assert.equal(activityState(job('a', p)), 'pending');
    assert.equal(activityState(job('a', 0.2, { error: '' })), 'running', 'an empty error string is no error');
  });
  test('progress clamps to 0..1; non-numbers are null', () => {
    assert.equal(clampProgress(-1), 0);
    assert.equal(clampProgress(2), 1);
    assert.equal(clampProgress(0.5), 0.5);
    assert.equal(clampProgress('0.5'), null);
    assert.equal(clampProgress(Number.POSITIVE_INFINITY), null);
  });
  test('percent never reads 100 before done', () => {
    assert.equal(percent(job('a', 0.999)), 99);
    assert.equal(percent(job('a', 1)), 99);
    assert.equal(percent(job('a', 0.256)), 25);
    assert.equal(percent(job('a', 0.4, { done: true })), 100);
    assert.equal(percent(job('a', null)), 0);
  });
  test('the step follows progress; done and pending have none', () => {
    const steps = ['Install', 'Build', 'Upload', 'Promote'];
    assert.equal(currentStep(job('a', 0, { steps })), 'Install');
    assert.equal(currentStep(job('a', 0.5, { steps })), 'Upload');
    assert.equal(currentStep(job('a', 1, { steps })), 'Promote');
    assert.equal(currentStep(job('a', 1, { steps, done: true })), null);
    assert.equal(currentStep(job('a', null, { steps })), null);
    assert.equal(currentStep(job('a', 0.5)), null);
  });
  test('ring offset empties at 0 and fills at 1', () => {
    assert.equal(ringOffset(0, 50), 50);
    assert.equal(ringOffset(1, 50), 0);
    assert.equal(ringOffset(null, 50), 50);
  });
});

describe('lead and +n', () => {
  test('the lead is the running job closest to done', () => {
    const list = [job('a', 0.2), job('b', 0.7), job('c', 0.5), job('d', 1, { done: true })];
    assert.equal(leadActivity(list).id, 'b');
  });
  test('a known progress beats a pending job; ties keep list order', () => {
    assert.equal(leadActivity([job('a', null), job('b', 0)]).id, 'b');
    assert.equal(leadActivity([job('a', 0.3), job('b', 0.3)]).id, 'a');
    assert.equal(leadActivity([job('a', null)]).id, 'a');
  });
  test('with nothing running the error leads, then the done job; empty is null', () => {
    assert.equal(leadActivity([job('a', 1, { done: true }), job('b', 0.4, { error: 'x' })]).id, 'b');
    assert.equal(leadActivity([job('a', 1, { done: true })]).id, 'a');
    assert.equal(leadActivity([]), null);
    assert.equal(leadActivity(undefined), null);
  });
  test('+n counts running jobs only, never the lead, done or errors', () => {
    assert.equal(moreCount([job('a', 0.2), job('b', 0.7), job('c', null)]), 2);
    assert.equal(moreCount([job('a', 0.2), job('b', 1, { done: true }), job('c', 0.1, { error: 'x' })]), 0);
    assert.equal(moreCount([job('b', 1, { done: true }), job('c', 0.1, { error: 'x' })]), 0);
    assert.equal(moreCount([]), 0);
    assert.equal(failedCount([job('a', 0.2), job('c', 0.1, { error: 'x' })]), 1);
  });
});

describe('done leaves, errors stay', () => {
  test('the default delay is 6 seconds', () => {
    assert.equal(DONE_LEAVE_MS, 6000);
  });
  test('trackDone stamps newly done jobs once and forgets jobs that are gone or running again', () => {
    let s = trackDone({}, [job('a', 1, { done: true }), job('b', 0.5)], 1000);
    assert.deepEqual(s, { a: 1000 });
    s = trackDone(s, [job('a', 1, { done: true }), job('b', 1, { done: true })], 3000);
    assert.deepEqual(s, { a: 1000, b: 3000 });
    s = trackDone(s, [job('b', 0.1)], 4000);
    assert.deepEqual(s, {});
  });
  test('done leaves after the delay, not before', () => {
    const list = [job('a', 1, { done: true })];
    const stamps = { a: 1000 };
    assert.deepEqual([...leaveExpired(list, stamps, new Set(), 1000 + DONE_LEAVE_MS - 1, false)], []);
    assert.deepEqual([...leaveExpired(list, stamps, new Set(), 1000 + DONE_LEAVE_MS, false)], ['a']);
  });
  test('done never leaves while the panel is open, and leaves once it closes', () => {
    const list = [job('a', 1, { done: true })];
    const stamps = { a: 0 };
    assert.deepEqual([...leaveExpired(list, stamps, new Set(), 60000, true)], []);
    assert.equal(nextLeaveIn(list, stamps, new Set(), 60000, true), null);
    assert.equal(nextLeaveIn(list, stamps, new Set(), 60000, false), 0);
  });
  test('an error never auto-leaves', () => {
    const list = [job('a', 0.3, { error: 'Build failed' })];
    assert.deepEqual([...leaveExpired(list, { a: 0 }, new Set(), 1e9, false)], []);
    assert.equal(nextLeaveIn(list, { a: 0 }, new Set(), 1e9, false), null);
  });
  test('nextLeaveIn is the wait for the earliest done job still showing', () => {
    const list = [job('a', 1, { done: true }), job('b', 1, { done: true }), job('c', 0.4)];
    assert.equal(nextLeaveIn(list, { a: 1000, b: 500 }, new Set(), 2000, false), DONE_LEAVE_MS - 1500);
    assert.equal(nextLeaveIn(list, { a: 1000, b: 500 }, new Set(['b']), 2000, false), DONE_LEAVE_MS - 1000);
    assert.equal(nextLeaveIn(list, { a: 1000 }, new Set(), 2000, false, 500), 0, 'a custom delay');
  });
  test('a left job comes back when it runs again; visible drops only left done jobs', () => {
    const left = new Set(['a', 'gone']);
    assert.deepEqual([...pruneLeft(left, [job('a', 0.2)])], []);
    assert.deepEqual([...pruneLeft(left, [job('a', 1, { done: true })])], ['a']);
    const list = [job('a', 1, { done: true }), job('b', 0.2)];
    assert.deepEqual(visibleActivities(list, new Set(['a'])).map((a) => a.id), ['b']);
    assert.deepEqual(visibleActivities(list, new Set()).map((a) => a.id), ['a', 'b']);
  });
});

describe('announcements', () => {
  const types = (prev, next) => activityEvents(prev, next).map((e) => `${e.type}:${e.id}${e.step ? `:${e.step}` : ''}:${e.politeness}`);
  test('start, done and cancel are polite status messages', () => {
    assert.deepEqual(types([], [job('a', 0)]), ['start:a:status']);
    assert.deepEqual(types([job('a', 0.9)], [job('a', 1, { done: true })]), ['done:a:status']);
    assert.deepEqual(types([job('a', 0.4)], []), ['cancel:a:status']);
  });
  test('progress speaks at 25% steps only, once per step', () => {
    assert.deepEqual(types([job('a', 0.1)], [job('a', 0.2)]), []);
    assert.deepEqual(types([job('a', 0.2)], [job('a', 0.26)]), ['progress:a:25:status']);
    assert.deepEqual(types([job('a', 0.26)], [job('a', 0.4)]), []);
    assert.deepEqual(types([job('a', 0.4)], [job('a', 0.8)]), ['progress:a:75:status'], 'a jump speaks the highest step crossed');
    assert.deepEqual(types([job('a', 0.8)], [job('a', 1)]), [], '100% is not a step; done speaks instead');
    assert.deepEqual(types([job('a', null)], [job('a', 0.3)]), ['progress:a:25:status']);
  });
  test('an error is an alert; a retry speaks as a start', () => {
    assert.deepEqual(types([job('a', 0.4)], [job('a', 0.4, { error: 'Timed out' })]), ['error:a:alert']);
    assert.deepEqual(types([], [job('a', 0.4, { error: 'Timed out' })]), ['error:a:alert']);
    assert.deepEqual(types([job('a', 0.4, { error: 'Timed out' })], [job('a', 0)]), ['start:a:status']);
  });
  test('a done or failed job leaving is silent; an unchanged list is silent', () => {
    assert.deepEqual(types([job('a', 1, { done: true }), job('b', 0.1, { error: 'x' })], []), []);
    const list = [job('a', 0.3), job('b', 1, { done: true })];
    assert.deepEqual(types(list, list), []);
  });
  test('announcement text', () => {
    const L = ACTIVITY_LABELS;
    const say = (prev, next) => activityEvents(prev, next).map((e) => announcement(e, L));
    assert.deepEqual(say([], [job('a', 0)]), ['Job a started']);
    assert.deepEqual(say([job('a', 0.2)], [job('a', 0.5)]), ['Job a 50%']);
    assert.deepEqual(say([job('a', 0.9)], [job('a', 1, { done: true })]), ['Job a done']);
    assert.deepEqual(say([job('a', 0.2)], []), ['Job a cancelled']);
    assert.deepEqual(say([job('a', 0.2)], [job('a', 0.2, { error: 'Timed out' })]), ['Job a failed: Timed out']);
    assert.deepEqual(say([job('a', 0.2)], [job('a', 0.2, { error: true })]), ['Job a failed']);
  });
});
