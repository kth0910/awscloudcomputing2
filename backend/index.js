import { handleCreateEvent, handleGetEvents, handleGetEvent, handleUpdateEvent, handleUpdateEventStatus } from './handlers/events.js';
import { handleCreateTicket, handleGetMyTickets, handleCancelTicket } from './handlers/tickets.js';
import { handleVerifyTicket, handleProcessEntry } from './handlers/admission.js';
import { handleGetApplicants, handleGetEventStats, handleGetDashboard } from './handlers/admin.js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,X-User-Id,X-User-Role',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

function respond(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

export const handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return respond(200, {});
  }

  const method = event.httpMethod;
  const path = event.resource; // API Gateway resource path pattern

  try {
    // Events
    if (method === 'POST' && path === '/events') return await handleCreateEvent(event);
    if (method === 'GET' && path === '/events') return await handleGetEvents(event);
    if (method === 'GET' && path === '/events/{eventId}') return await handleGetEvent(event);
    if (method === 'PUT' && path === '/events/{eventId}') return await handleUpdateEvent(event);
    if (method === 'PATCH' && path === '/events/{eventId}/status') return await handleUpdateEventStatus(event);

    // Tickets
    if (method === 'POST' && path === '/events/{eventId}/tickets') return await handleCreateTicket(event);
    if (method === 'GET' && path === '/tickets/my') return await handleGetMyTickets(event);
    if (method === 'DELETE' && path === '/tickets/{ticketId}') return await handleCancelTicket(event);

    // Admission
    if (method === 'GET' && path === '/admission/verify/{ticketCode}') return await handleVerifyTicket(event);
    if (method === 'POST' && path === '/admission/enter/{ticketCode}') return await handleProcessEntry(event);

    // Admin
    if (method === 'GET' && path === '/events/{eventId}/applicants') return await handleGetApplicants(event);
    if (method === 'GET' && path === '/events/{eventId}/stats') return await handleGetEventStats(event);
    if (method === 'GET' && path === '/admin/dashboard') return await handleGetDashboard(event);

    return respond(404, { error: 'Not Found' });
  } catch (err) {
    console.error('Unhandled error:', err);
    return respond(500, { error: '서버 내부 오류가 발생했습니다.' });
  }
};
