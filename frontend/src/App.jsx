import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { setCurrentUser, getCurrentUser } from './api/client.js';
import EventList from './pages/EventList.jsx';
import EventDetail from './pages/EventDetail.jsx';
import MyTickets from './pages/MyTickets.jsx';
import OrganizerEvents from './pages/OrganizerEvents.jsx';
import CreateEvent from './pages/CreateEvent.jsx';
import OrganizerEventDetail from './pages/OrganizerEventDetail.jsx';
import GateCheck from './pages/GateCheck.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';

function App() {
  const [user, setUser] = useState(getCurrentUser());

  const handleUserChange = (field, value) => {
    const updated = { ...user, [field]: value };
    setUser(updated);
    setCurrentUser(updated.userId, updated.userRole);
  };

  return (
    <BrowserRouter>
      <nav>
        <Link to="/">🎫 행사 목록</Link>
        <Link to="/my-tickets">내 티켓</Link>
        <Link to="/organizer/events">주최자</Link>
        <Link to="/gate">입장 확인</Link>
        <Link to="/admin">운영자</Link>
        <span className="role-selector">
          | 역할:
          <select
            value={user.userRole}
            onChange={(e) => handleUserChange('userRole', e.target.value)}
          >
            <option value="student">학생</option>
            <option value="organizer">주최자</option>
            <option value="gatekeeper">입장관리자</option>
            <option value="admin">운영자</option>
          </select>
          <input
            type="text"
            value={user.userId}
            onChange={(e) => handleUserChange('userId', e.target.value)}
            placeholder="User ID"
          />
        </span>
      </nav>

      <div className="container">
        <Routes>
          <Route path="/" element={<EventList />} />
          <Route path="/events/:eventId" element={<EventDetail />} />
          <Route path="/my-tickets" element={<MyTickets />} />
          <Route path="/organizer/events" element={<OrganizerEvents />} />
          <Route path="/organizer/events/new" element={<CreateEvent />} />
          <Route path="/organizer/events/:eventId" element={<OrganizerEventDetail />} />
          <Route path="/gate" element={<GateCheck />} />
          <Route path="/admin" element={<AdminDashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
