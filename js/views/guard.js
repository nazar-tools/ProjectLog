// Timer guard: speaks up when a running timer is probably counting time that wasn't work.
// Three cases, one card at a time at the top of every page:
//   the laptop slept while the timer ran (noticed in app.js from a jump in the clock),
//   the timer has run longer than Settings' "long timer" hours without a check,
//   it's past the end of your day and the timer is still going.

function guardHtml() {
  const t = state.timer;
  if (!t) return '';
  const name = esc(t.pid === 'OH' ? 'Overhead' : pidLabel(t.pid));

  if (ui.sleep && ui.sleep.pid === t.pid) {
    const mins = Math.round((ui.sleep.to - ui.sleep.from) / 60000);
    return guardCard('moon', `Your laptop slept ${clock(ui.sleep.from)} – ${clock(ui.sleep.to)}`,
      `The ${name} timer kept counting through it. Take that time out?`,
      `<button class="btn pri" data-a="guardSleepRemove">Remove ${fmtDuration(mins)}</button>
       <button class="btn" data-a="guardSleepKeep">Keep it</button>`);
  }

  const ran = (Date.now() - t.start) / 60000;
  const stopAt = `
    <label class="row tight stopat">
      <span class="sub">It ended at</span>
      <input type="time" class="inp" id="guard-at" value="${timeValue(guessStop())}" aria-label="Stop time">
    </label>
    <button class="btn" data-a="guardStopAt">Stop at that time</button>`;

  if (!t.askedEnd && pastDayEnd()) {
    return guardCard('clock', `It’s ${clock(Date.now())} and ${name} is still running`,
      `Started ${clock(t.start)}. If you forgot it, stop it when you actually finished.`,
      `${stopAt}
       <button class="btn" data-a="guardStopNow">Stop now</button>
       <button class="btn ghost" data-a="guardEndKeep">Still working</button>`);
  }

  if (!t.askedLong && ran >= (parseFloat(state.settings.longTimerHours) || 3) * 60) {
    return guardCard('alert', `Still on ${name}?`,
      `This timer has run ${fmtDuration(ran)} without a break.`,
      `<button class="btn pri" data-a="guardLongKeep">Yes, keep going</button>${stopAt}`);
  }
  return '';
}

function guardCard(icon, title, text, buttons) {
  return `
    <section class="card guard" role="alert">
      <div class="row top">
        ${ic(icon)}
        <div class="stack gap1"><b>${title}</b><span class="sub">${text}</span></div>
      </div>
      <div class="row wrap tight">${buttons}</div>
    </section>`;
}

// Today's end-of-day time from Settings, as a timestamp.
function dayEndToday() {
  return atTime(S.today(), state.settings.dayEnd || '18:00');
}

function pastDayEnd() {
  return Date.now() >= dayEndToday() && state.timer.start < dayEndToday();
}

// Best guess for when work actually stopped: your last click in the app, if that's after the
// timer started, else the end of your day.
function guessStop() {
  const t = state.timer;
  const end = Math.min(Date.now(), Math.max(t.start, dayEndToday()));
  const last = lastActivity > t.start ? lastActivity : end;
  return Math.round(last / 300000) * 300000;
}
