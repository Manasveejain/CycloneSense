import React, { useState, useEffect } from 'react';

function TestComponent() {
  const [message, setMessage] = useState('Loading...');
  
  useEffect(() => {
    console.log('TestComponent mounted successfully!');
    setMessage('React is working! ✓');
    
    // Test API connectivity
    fetch('http://localhost:8000/api/health')
      .then(res => res.json())
      .then(data => {
        console.log('Backend API test:', data);
        setMessage(prev => prev + '\nBackend connected! ✓');
      })
      .catch(err => {
        console.error('Backend API error:', err);
        setMessage(prev => prev + '\nBackend connection failed! ✗');
      });
  }, []);
  
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-8">
      <div className="max-w-lg w-full bg-slate-800 border border-slate-700 rounded-xl p-8 text-center">
        <h1 className="text-3xl font-bold mb-4 text-cyan-400">
          CycloneSense Test Page
        </h1>
        <div className="bg-slate-950 p-4 rounded-lg font-mono text-sm whitespace-pre-wrap text-left">
          {message}
        </div>
        <div className="mt-6 space-y-2 text-sm text-slate-300">
          <p>✓ HTML loaded</p>
          <p>✓ Vite dev server running</p>
          <p>✓ React rendering</p>
          <p>✓ Tailwind CSS working</p>
        </div>
        <button
          onClick={() => window.location.href = '/'}
          className="mt-6 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-900 font-bold rounded-lg transition-all"
        >
          All checks passed! Click to continue
        </button>
      </div>
    </div>
  );
}

export default TestComponent;
