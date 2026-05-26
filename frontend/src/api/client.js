const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/prod';

let currentUser = {
  userId: 'student-001',
  userRole: 'student',
};

export function setCurrentUser(userId, userRole) {
  currentUser = { userId, userRole };
}

export function getCurrentUser() {
  return { ...currentUser };
}

async function request(method, path, body = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': currentUser.userId,
      'X-User-Role': currentUser.userRole,
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${API_URL}${path}`, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

// Events API
export const eventsApi = {
  list: () => request('GET', '/events'),
  get: (eventId) => request('GET', `/events/${eventId}`),
  create: (data) => request('POST', '/events', data),
  update: (eventId, data) => request('PUT', `/events/${eventId}`, data),
  updateStatus: (eventId, status) => request('PATCH', `/events/${eventId}/status`, { status }),
  getApplicants: (eventId) => request('GET', `/events/${eventId}/applicants`),
  getStats: (eventId) => request('GET', `/events/${eventId}/stats`),
};

// Tickets API
export const ticketsApi = {
  create: (eventId) => request('POST', `/events/${eventId}/tickets`),
  getMyTickets: () => request('GET', '/tickets/my'),
  cancel: (ticketId) => request('DELETE', `/tickets/${ticketId}`),
};

// Admission API
export const admissionApi = {
  verify: (ticketCode) => request('GET', `/admission/verify/${ticketCode}`),
  enter: (ticketCode) => request('POST', `/admission/enter/${ticketCode}`),
};

// Admin API
export const adminApi = {
  getDashboard: () => request('GET', '/admin/dashboard'),
};
