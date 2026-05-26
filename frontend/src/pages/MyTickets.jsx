import React, { useState, useEffect } from 'react';
import { ticketsApi } from '../api/client.js';

function MyTickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadTickets();
  }, []);

  async function loadTickets() {
    try {
      setLoading(true);
      const data = await ticketsApi.getMyTickets();
      setTickets(data.tickets || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel(ticketId) {
    if (!confirm('정말 티켓을 취소하시겠습니까?')) return;
    try {
      await ticketsApi.cancel(ticketId);
      setMessage({ type: 'success', text: '티켓이 취소되었습니다.' });
      loadTickets();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  const statusBadge = {
    '발급완료': 'badge-issued',
    '입장완료': 'badge-entered',
    '취소': 'badge-cancelled',
  };

  if (loading) return <p>로딩 중...</p>;

  return (
    <div>
      <h1>🎫 내 티켓</h1>

      {message && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      {tickets.length === 0 ? (
        <p>신청한 티켓이 없습니다.</p>
      ) : (
        <div className="grid">
          {tickets.map((ticket) => (
            <div key={ticket.ticketId} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>{ticket.event?.title || '행사 정보 없음'}</h3>
                <span className={`badge ${statusBadge[ticket.status]}`}>{ticket.status}</span>
              </div>
              <p style={{ marginTop: '8px' }}>📍 {ticket.event?.venue}</p>
              <p>📅 {ticket.event?.eventDate ? new Date(ticket.event.eventDate).toLocaleString('ko-KR') : '-'}</p>
              <div style={{ marginTop: '12px', padding: '12px', background: '#f9fafb', borderRadius: '6px', textAlign: 'center' }}>
                <p style={{ fontSize: '12px', color: '#6b7280' }}>티켓 코드</p>
                <p style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '2px', color: '#4f46e5' }}>
                  {ticket.ticketCode}
                </p>
              </div>
              {ticket.status === '발급완료' && (
                <button
                  className="btn btn-danger"
                  style={{ marginTop: '12px', width: '100%' }}
                  onClick={() => handleCancel(ticket.ticketId)}
                >
                  티켓 취소
                </button>
              )}
              {ticket.enteredAt && (
                <p style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280' }}>
                  입장 시간: {new Date(ticket.enteredAt).toLocaleString('ko-KR')}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyTickets;
