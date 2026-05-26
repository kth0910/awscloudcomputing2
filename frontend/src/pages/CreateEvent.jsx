import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsApi } from '../api/client.js';

function CreateEvent() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    venue: '',
    eventDate: '',
    capacity: '',
    registrationDeadline: '',
  });
  const [message, setMessage] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    try {
      const payload = {
        ...form,
        capacity: parseInt(form.capacity, 10),
        eventDate: new Date(form.eventDate).toISOString(),
        registrationDeadline: new Date(form.registrationDeadline).toISOString(),
      };
      await eventsApi.create(payload);
      setMessage({ type: 'success', text: '행사가 등록되었습니다!' });
      setTimeout(() => navigate('/organizer/events'), 1500);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>📝 행사 등록</h1>

      {message && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      <form onSubmit={handleSubmit} className="card">
        <label>행사명</label>
        <input name="title" value={form.title} onChange={handleChange} required placeholder="예: 2026 봄 축제" />

        <label>설명</label>
        <textarea name="description" value={form.description} onChange={handleChange} required rows="3" placeholder="행사에 대한 설명을 입력하세요" />

        <label>장소</label>
        <input name="venue" value={form.venue} onChange={handleChange} required placeholder="예: 학생회관 대강당" />

        <label>행사 일시</label>
        <input name="eventDate" type="datetime-local" value={form.eventDate} onChange={handleChange} required />

        <label>모집 정원</label>
        <input name="capacity" type="number" min="1" value={form.capacity} onChange={handleChange} required placeholder="예: 100" />

        <label>신청 마감 시간</label>
        <input name="registrationDeadline" type="datetime-local" value={form.registrationDeadline} onChange={handleChange} required />

        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ marginTop: '12px' }}>
          {submitting ? '등록 중...' : '행사 등록'}
        </button>
      </form>
    </div>
  );
}

export default CreateEvent;
