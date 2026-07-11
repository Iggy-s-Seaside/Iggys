import { describe, it, expect } from 'vitest';
import { cardFlags } from './usePipeline';
import type { Party } from '../types';

// Minimal fixtures — only the fields cardFlags reads.
const party = (over: Partial<Party>) =>
  ({ status: 'inquiry', event_date: null, follow_up_date: null, payment_status: null, ...over } as unknown as Party);

const TODAY = '2026-07-10';

describe('cardFlags — pipeline actionability against the business day', () => {
  it('confirmed + unpaid with a future event → deposit owed', () => {
    const f = cardFlags(party({ status: 'confirmed', payment_status: 'unpaid', event_date: '2026-09-22' }), TODAY);
    expect(f).toEqual({ followUpDue: false, depositOwed: true, balanceOwed: false, eventPassed: false });
  });

  it('confirmed + unpaid with no event date → deposit owed (never "passed")', () => {
    const f = cardFlags(party({ status: 'confirmed', payment_status: 'unpaid' }), TODAY);
    expect(f.depositOwed).toBe(true);
    expect(f.eventPassed).toBe(false);
  });

  it('confirmed + unpaid past its date → close-out signal ON TOP of the deposit flag (money stays visible on the owner strip)', () => {
    const f = cardFlags(party({ status: 'confirmed', payment_status: 'unpaid', event_date: '2026-06-15' }), TODAY);
    expect(f).toEqual({ followUpDue: false, depositOwed: true, balanceOwed: false, eventPassed: true });
  });

  it('confirmed + partial past its date → balance still owed, plus the close-out signal', () => {
    const f = cardFlags(party({ status: 'confirmed', payment_status: 'partial', event_date: '2026-06-15' }), TODAY);
    expect(f.balanceOwed).toBe(true);
    expect(f.eventPassed).toBe(true);
  });

  it('fully paid past party → nothing to flag', () => {
    const f = cardFlags(party({ status: 'confirmed', payment_status: 'paid', event_date: '2026-06-15' }), TODAY);
    expect(f).toEqual({ followUpDue: false, depositOwed: false, balanceOwed: false, eventPassed: false });
  });

  it('event dated today is NOT passed (strict less-than)', () => {
    const f = cardFlags(party({ status: 'confirmed', payment_status: 'unpaid', event_date: TODAY }), TODAY);
    expect(f.eventPassed).toBe(false);
    expect(f.depositOwed).toBe(true);
  });

  it('inquiry follow-up due today fires; a passed event silences it', () => {
    const due = cardFlags(party({ follow_up_date: TODAY }), TODAY);
    expect(due.followUpDue).toBe(true);
    const passed = cardFlags(party({ follow_up_date: TODAY, event_date: '2026-06-01' }), TODAY);
    expect(passed.followUpDue).toBe(false);
    expect(passed.eventPassed).toBe(true);
  });

  it('cancelled parties never flag as passed', () => {
    const f = cardFlags(party({ status: 'cancelled', event_date: '2026-06-15' }), TODAY);
    expect(f.eventPassed).toBe(false);
  });
});
