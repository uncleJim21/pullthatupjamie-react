import React, { useState, useRef } from 'react';

/**
 * Test component to debug browser automation issues with React forms.
 * Access at /browser-test
 */
const BrowserTestInput: React.FC = () => {
  // Controlled input state
  const [controlledValue, setControlledValue] = useState('');
  const [controlledResult, setControlledResult] = useState('');
  
  // Uncontrolled input ref
  const uncontrolledRef = useRef<HTMLInputElement>(null);
  const [uncontrolledResult, setUncontrolledResult] = useState('');

  const handleControlledSubmit = () => {
    setControlledResult(`Submitted: "${controlledValue}"`);
  };

  const handleUncontrolledSubmit = () => {
    const value = uncontrolledRef.current?.value || '';
    setUncontrolledResult(`Submitted: "${value}"`);
  };

  return (
    <div style={{ padding: '40px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1>Browser Automation Test</h1>
      
      {/* Controlled Input Test */}
      <div style={{ marginBottom: '40px', padding: '20px', border: '1px solid #333', borderRadius: '8px' }}>
        <h2>Test 1: Controlled Input</h2>
        <p style={{ color: '#888' }}>React manages value via useState</p>
        <input
          id="controlled-input"
          data-testid="controlled-input"
          type="text"
          value={controlledValue}
          onChange={(e) => setControlledValue(e.target.value)}
          placeholder="Type here..."
          style={{ padding: '10px', width: '100%', marginBottom: '10px', boxSizing: 'border-box' }}
        />
        <button
          id="controlled-submit"
          data-testid="controlled-submit"
          onClick={handleControlledSubmit}
          style={{ padding: '10px 20px', cursor: 'pointer' }}
        >
          Submit Controlled
        </button>
        {controlledResult && (
          <div id="controlled-result" style={{ marginTop: '10px', padding: '10px', background: '#1a1a1a', borderRadius: '4px' }}>
            {controlledResult}
          </div>
        )}
      </div>

      {/* Uncontrolled Input Test */}
      <div style={{ padding: '20px', border: '1px solid #333', borderRadius: '8px' }}>
        <h2>Test 2: Uncontrolled Input</h2>
        <p style={{ color: '#888' }}>DOM manages value via ref</p>
        <input
          id="uncontrolled-input"
          data-testid="uncontrolled-input"
          type="text"
          ref={uncontrolledRef}
          defaultValue=""
          placeholder="Type here..."
          style={{ padding: '10px', width: '100%', marginBottom: '10px', boxSizing: 'border-box' }}
        />
        <button
          id="uncontrolled-submit"
          data-testid="uncontrolled-submit"
          onClick={handleUncontrolledSubmit}
          style={{ padding: '10px 20px', cursor: 'pointer' }}
        >
          Submit Uncontrolled
        </button>
        {uncontrolledResult && (
          <div id="uncontrolled-result" style={{ marginTop: '10px', padding: '10px', background: '#1a1a1a', borderRadius: '4px' }}>
            {uncontrolledResult}
          </div>
        )}
      </div>
    </div>
  );
};

export default BrowserTestInput;
