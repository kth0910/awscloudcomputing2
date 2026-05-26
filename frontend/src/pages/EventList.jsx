import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { eventsApi } from '../api/client.js';

function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    try {
      setLoading(true);
      const data = await eventsApi.list();
      setEvents(data.events || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p>로딩 중...</p>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <h1>🎉 모집중인 행사</h1>
      {events.length === 0 ? (
        <p>현재 모집중인 행사가 없습니다.</p>
      ) : (
        <div className="grid">
          {events.map((event) => (
            <div key={event.eventId} className="card">
              <h3>{event.title}</h3>
              <p style={{ color: '#6b7280', fontSize: '14px', marginBottom: '8px' }}>
                {event.description}
              </p>
              <p>📍 {event.venue}</p>
              <p>📅 {new Date(event.eventDate).toLocaleString('ko-KR')}</p>
              <p>👥 {event.currentCount} / {event.capacity}명</p>
              <p style={{ fontSize: '13px', color: '#6b7280' }}>
                마감: {new Date(event.registrationDeadline).toLocaleString('ko-KR')}
              </p>
              <Link to={`/events/${event.eventId}`} className="btn btn-primary" style={{ marginTop: '12px' }}>
                상세보기 / 신청
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default EventList;
