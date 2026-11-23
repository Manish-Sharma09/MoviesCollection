'use client';
// Under a film's headline figure while it is in cinemas: the next round milestone, a progress bar from the last
// one, and how far there is to go. While a live estimate runs, the live model (src/lib/live.ts) adds the day it
// expects the film to get there. Milestones are round amounts in the film's own currency (₹ crore for Indian
// films, US$ for the rest), like trade reports.
import { formatMoney, type Currency } from '@/lib/format';
import { DAY, estimate, istMidnight, liveState } from '@/lib/live';
import type { LiveInfo, Money } from '@/lib/types';
import { useLang, useLiveStep } from '../hooks';

const ETA_LIMIT = 45; // beyond this, no "around Day N"

export function MilestoneStrip({ native, gross, live, step: size, release }: {
  native: Currency; gross: Money; live: LiveInfo | null; step: number; release: string;
}) {
  const lang = useLang();
  const step = useLiveStep();
  const state = live && step !== null ? liveState({ ...gross, ...live }, step) : null;
  const v = (m: Money) => (native === 'INR' ? m.inr : m.usd);
  const fmt = (n: number) => formatMoney({ usd: n, inr: n }, native, lang);
  const current = state ? v(state) : v(gross);
  const passed = Math.floor(current / size) * size;
  const next = passed + size;
  const progress = Math.min(1, Math.max(0, (current - passed) / size));

  let eta: number | null = null;
  if (live && state && step !== null) {
    const base = native === 'INR' ? live.base.inr : live.base.usd;
    const start = istMidnight(release);
    const today = Math.floor((step - start) / DAY);
    for (let k = today; k < today + ETA_LIMIT; k++) {
      const total = v(gross) + estimate({ base, coveredThrough: live.coveredThrough }, start + (k + 1) * DAY).total;
      if (total >= next) { eta = k + 1; break; }
    }
  }

  return (
    <div className="ms-strip">
      <div className="ms-row"><span>Next stop</span><b className="m">{fmt(next)}</b></div>
      <div className="ms-bar" role="progressbar" aria-label={`Progress to ${fmt(next)}`}
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        <i style={{ transform: `scaleX(${progress})` }} />
      </div>
      <p className="ms-foot">
        <span className="m">{fmt(Math.max(0, next - current))}</span> away{eta ? ` · likely by Day ${eta}` : ''}
      </p>
    </div>
  );
}
