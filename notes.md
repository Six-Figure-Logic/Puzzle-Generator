Ctrl+Shift+J

(console window)



**Reset rating to 1000+/-350:**



localStorage.removeItem('sfl\_rating\_v1');





**To manually set rating:**



localStorage.setItem('sfl\_rating\_v1', JSON.stringify({

&#x20; rating: \[*FILL HERE*],

&#x20; rd: \[*FILL HERE*],

}));



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
