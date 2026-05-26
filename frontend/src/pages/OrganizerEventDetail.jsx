import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsApi } from '../api/client.js';

function OrganizerEventDetail() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    loadData();
  }, [eventId]);

  async function loadData() {
    try {
      const [eventData, applicantsData, statsData] = await Promise.all([
        eventsApi.get(eventId),
        eventsApi.getApplicants(eventId).catch(() => ({ applicants: [] })),
        eventsApi.getStats(eventId).catch(() => null),
      ]);
      setEvent(eventData);
      setApplicants(applicantsData.applicants || []);
      setStats(statsData);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(newStatus) {
    if (!confirm(`행사 상태를 '${newStatus}'로 변경하시겠습니까?`)) return;
    try {
      await eventsApi.updateStatus(eventId, newStatus);
      setMessage({ type: 'success', text: `상태가 '${newStatus}'로 변경되었습니다.` });
      loadData();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  }

  if (loading) return <p>로딩 중...</p>;
  if (!event) return <div className="alert alert-error">행사를 찾을 수 없습니다.</div>;

  return (
    <div>
      <button onClick={() => navigate('/organizer/events')} style={{ marginBottom: '16px', background: 'none', border: 'none', cursor: 'pointer', color: '#4f46e5' }}>
        ← 목록으로
      </button>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="card">
        <h1>{event.title}</h1>
        <p style={{ color: '#6b7280' }}>상태: <strong>{event.status}</strong></p>

        <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
          {event.status === '모집중' && (
            <>
              <button className="btn btn-primary" onClick={() => handleStatusChange('모집마감')}>모집 마감</button>
              <button className="btn btn-danger" onClick={() => handleStatusChange('취소')}>행사 취소</button>
            </>
          )}
          {event.status === '모집마감' && (
            <>
              <button className="btn btn-primary" onClick={() => handleStatusChange('행사종료')}>행사 종료</button>
              <button className="btn btn-danger" onClick={() => handleStatusChange('취소')}>행사 취소</button>
            </>
          )}
        </div>
      </div>

      {stats && (
        <div className="card">
          <h2>📊 통계</h2>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="number">{stats.stats.issued}</div>
              <div className="label">발급완료</div>
            </div>
            <div className="stat-card">
              <div className="number">{stats.stats.entered}</div>
              <div className="label">입장완료</div>
            </div>
            <div className="stat-card">
              <div className="number">{stats.stats.cancelled}</div>
              <div className="label">취소</div>
            </div>
            <div className="stat-card">
              <div className="number">{event.currentCount}/{event.capacity}</div>
              <div className="label">신청/정원</div>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <h2>👥 신청자 목록 ({applicants.length}명)</h2>
        {applicants.length === 0 ? (
          <p>신청자가 없습니다.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '8px' }}>학생 ID</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>티켓 코드</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>상태</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>발급일</th>
              </tr>
            </thead>
            <tbody>
              {applicants.map((a) => (
                <tr key={a.ticketId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px' }}>{a.studentId}</td>
                  <td style={{ padding: '8px', fontFamily: 'monospace' }}>{a.ticketCode}</td>
                  <td style={{ padding: '8px' }}>{a.status}</td>
                  <td style={{ padding: '8px', fontSize: '13px' }}>{a.issuedAt ? new Date(a.issuedAt).toLocaleString('ko-KR') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default OrganizerEventDetail;
