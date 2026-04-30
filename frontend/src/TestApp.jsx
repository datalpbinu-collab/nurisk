import React, { useState, useEffect } from 'react';

function TestApp() {
  const [count, setCount] = useState(0);
  console.log('[TESTAPP v7] rendered, count=', count);

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
      <header style={{ background: '#006432', color: 'white', padding: 20, flexShrink: 0 }}>
        <h1>Test App v7 - Click to increment: {count}</h1>
        <button onClick={() => setCount(c => c + 1)} style={{ marginTop: 10, padding: '10px 20px' }}>
          INCREMENT
        </button>
      </header>
      <main style={{ flex: 1, overflowY: 'auto', background: '#f0f0f0' }}>
        <div style={{ padding: 20 }}>
          <p>SCROLL TEST AREA</p>
          {Array.from({ length: 50 }, (_, i) => (
            <div key={i} style={{ background: 'white', padding: 15, marginBottom: 10, borderRadius: 5 }}>
              Item #{i + 1} - coba scroll ke bawah
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default TestApp;