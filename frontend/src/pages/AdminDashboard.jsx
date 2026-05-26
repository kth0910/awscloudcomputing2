import React, { useState, useEffect } from 'react';
import { adminApi } from '../api/client.js';

function AdminDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const data = await adminApi.getDashboard();
      setDashboard(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <p>로딩 중...</p>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!dashboard) return null;

  const { summary, events } = dashboard;

  return (
    <div>
      <h1>📊 운영자 대시보드</h1>

      <div className="card">
        <h2>전체 현황</h2>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="number">{summary.totalEvents}</div>
            <div className="label">전체 행사</div>
          </div>
          <div className="stat-card">
            <div className="number">{summary.eventsByStatus['모집중']}</div>
            <div className="label">모집중</div>
          </div>
          <div className="stat-card">
            <div className="number">{summary.totalTickets}</div>
            <div className="label">전체 티켓</div>
          </div>
          <div className="stat-card">
            <div className="number">{summary.ticketsByStatus['입장완료']}</div>
            <div className="label">입장완료</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>행사 목록</h2>
        {events.length === 0 ? (
          <p>등록된 행사가 없습니다.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ textAlign: 'left', padding: '8px' }}>행사명</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>상태</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>신청/정원</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>행사일</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.eventId} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '8px' }}>{e.title}</td>
                  <td style={{ padding: '8px' }}>{e.status}</td>
                  <td style={{ padding: '8px' }}>{e.currentCount}/{e.capacity}</td>
                  <td style={{ padding: '8px', fontSize: '13px' }}>{new Date(e.eventDate).toLocaleString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default AdminDashboard;
