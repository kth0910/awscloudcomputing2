import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { eventsApi } from '../api/client.js';

function OrganizerEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    try {
      const data = await eventsApi.list();
      setEvents(data.events || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p>로딩 중...</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1>📋 행사 관리</h1>
        <Link to="/organizer/events/new" className="btn btn-primary">+ 행사 등록</Link>
      </div>

      {events.length === 0 ? (
        <p>등록된 행사가 없습니다.</p>
      ) : (
        <div className="grid">
          {events.map((event) => (
            <div key={event.eventId} className="card">
              <h3>{event.title}</h3>
              <p>👥 {event.currentCount} / {event.capacity}명</p>
              <p>📅 {new Date(event.eventDate).toLocaleString('ko-KR')}</p>
              <Link to={`/organizer/events/${event.eventId}`} className="btn btn-primary" style={{ marginTop: '12px' }}>
                관리
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default OrganizerEvents;
