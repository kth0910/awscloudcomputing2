import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsApi, ticketsApi } from '../api/client.js';

function EventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    loadEvent();
  }, [eventId]);

  async function loadEvent() {
    try {
      const data = await eventsApi.get(eventId);
      setEvent(data);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleApply() {
    try {
      setApplying(true);
      const result = await ticketsApi.create(eventId);
      setMessage({ type: 'success', text: `티켓이 발급되었습니다! 코드: ${result.ticketCode}` });
      loadEvent();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setApplying(false);
    }
  }

  if (loading) return <p>로딩 중...</p>;
  if (!event) return <div className="alert alert-error">행사를 찾을 수 없습니다.</div>;

  const statusBadge = {
    '모집중': 'badge-recruiting',
    '모집마감': 'badge-closed',
    '행사종료': 'badge-ended',
    '취소': 'badge-cancelled',
  };

  return (
    <div>
      <button onClick={() => navigate(-1)} style={{ marginBottom: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#4f46e5' }}>
        ← 뒤로가기
      </button>

      {message && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1>{event.title}</h1>
          <span className={`badge ${statusBadge[event.status]}`}>{event.status}</span>
        </div>

        <p style={{ margin: '12px 0', color: '#6b7280' }}>{event.description}</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '16px' }}>
          <div><strong>📍 장소:</strong> {event.venue}</div>
          <div><strong>📅 일시:</strong> {new Date(event.eventDate).toLocaleString('ko-KR')}</div>
          <div><strong>👥 인원:</strong> {event.currentCount} / {event.capacity}명</div>
          <div><strong>⏰ 마감:</strong> {new Date(event.registrationDeadline).toLocaleString('ko-KR')}</div>
        </div>

        {event.status === '모집중' && (
          <div style={{ marginTop: '24px' }}>
            <button
              className="btn btn-primary"
              onClick={handleApply}
              disabled={applying || event.currentCount >= event.capacity}
            >
              {applying ? '신청 중...' : event.currentCount >= event.capacity ? '정원 마감' : '🎫 티켓 신청'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default EventDetail;
