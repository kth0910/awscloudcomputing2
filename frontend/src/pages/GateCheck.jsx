import React, { useState } from 'react';
import { admissionApi } from '../api/client.js';

function GateCheck() {
  const [ticketCode, setTicketCode] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  async function handleVerify(e) {
    e.preventDefault();
    if (!ticketCode.trim()) return;
    setLoading(true);
    setResult(null);
    setMessage(null);

    try {
      const data = await admissionApi.verify(ticketCode.trim());
      setResult(data);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleEntry() {
    setLoading(true);
    setMessage(null);

    try {
      const data = await admissionApi.enter(ticketCode.trim());
      setMessage({ type: 'success', text: `✅ ${data.message}` });
      setResult(null);
      setTicketCode('');
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>🚪 입장 확인</h1>

      <div className="card">
        <form onSubmit={handleVerify}>
          <label>티켓 코드 입력</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              value={ticketCode}
              onChange={(e) => setTicketCode(e.target.value.toUpperCase())}
              placeholder="8자리 티켓 코드"
              maxLength={8}
              style={{ fontSize: '20px', letterSpacing: '3px', textAlign: 'center', fontFamily: 'monospace' }}
            />
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ whiteSpace: 'nowrap' }}>
              {loading ? '확인 중...' : '확인'}
            </button>
          </div>
        </form>
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      {result && (
        <div className="card">
          <div style={{ textAlign: 'center', padding: '20px' }}>
            {result.valid ? (
              <>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>✅</div>
                <h2 style={{ color: '#16a34a' }}>입장 가능</h2>
                <p style={{ marginTop: '8px' }}>행사: {result.ticketInfo?.eventTitle}</p>
                <p>학생 ID: {result.ticketInfo?.studentId}</p>
                <button
                  className="btn btn-success"
                  onClick={handleEntry}
                  disabled={loading}
                  style={{ marginTop: '16px', fontSize: '18px', padding: '14px 32px' }}
                >
                  🎫 입장 처리
                </button>
              </>
            ) : (
              <>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>❌</div>
                <h2 style={{ color: '#dc2626' }}>입장 불가</h2>
                <p style={{ marginTop: '8px', color: '#6b7280' }}>{result.reason}</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default GateCheck;
