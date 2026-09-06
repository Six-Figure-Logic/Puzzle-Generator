Ctrl+Shift+J    (console window)

==========================================
**Reset rating to 1000+/-350:**

localStorage.removeItem('sfl\_rating\_v1');
==========================================


==========================================
**To manually set rating:**

localStorage.setItem('sfl_rating_v1', JSON.stringify({
  rating: ####,
  rd: ###
}));
==========================================

**Reset daily puzzle status:**

(function() {
  const key = 'sfl_daily_v2';
  const store = JSON.parse(localStorage.getItem(key) || '{}');
  const today = window.SFLDaily.getDateString();
  
  if (store[today]) {
    delete store[today]; // Remove today's completion records
    localStorage.setItem(key, JSON.stringify(store));
    console.log(`%c Daily states reset for ${today}! Keep testing.`, 'color: #00e5a0; font-weight: bold;');
    
    // Force the popup UI to update instantly if it's currently open
    if (typeof refreshDailyCards === 'function') refreshDailyCards();
  } else {
    console.log('No daily records found for today to clear.');
  }
})();
==========================================

** Clear daily saved puzzle memory **

// Clear today's (and all cached) daily puzzle records + cached puzzle objects
Object.keys(localStorage)
  .filter(k => k === 'sfl_daily_v2' || k.startsWith('sfl_daily_puzzle_'))
  .forEach(k => localStorage.removeItem(k));

// Clear the in-progress session (live grid/answers/timer state)
localStorage.removeItem('sfl_session_v1');

location.reload();
==========================================

** Global Reset (rating, history, puzzle sessions)

Object.keys(localStorage)
  .filter(k => k.startsWith('sfl_'))
  .forEach(k => localStorage.removeItem(k));
location.reload();
==========================================

** Selectable clue text**

document.querySelectorAll('#cluesList, #cluesList *').forEach(el => {
  el.style.userSelect = 'text';
  el.style.webkitUserSelect = 'text';
  el.style.webkitTouchCallout = 'default';
});
==========================================
