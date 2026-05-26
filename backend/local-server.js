import http from 'http';
import { v4 as uuidv4 } from 'uuid';

// In-memory storage
const events = [];
const tickets = [];

function generateTicketCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

function respond(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,X-User-Id,X-User-Role',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return respond(res, 200, {});
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace('/prod', '');
  const method = req.method;
  const userId = req.headers['x-user-id'] || '';
  const userRole = req.headers['x-user-role'] || '';

  console.log(`${method} ${path} [${userRole}:${userId}]`);

  try {
    // GET /events
    if (method === 'GET' && path === '/events') {
      const recruiting = events.filter(e => e.status === '모집중');
      return respond(res, 200, { events: recruiting });
    }

    // POST /events
    if (method === 'POST' && path === '/events') {
      if (userRole !== 'organizer') return respond(res, 403, { error: '권한이 없습니다.' });
      const body = await parseBody(req);
      const { title, description, venue, eventDate, capacity, registrationDeadline } = body;
      if (!title || !description || !venue || !eventDate || !capacity || !registrationDeadline) {
        return respond(res, 400, { error: '필수 필드가 누락되었습니다.' });
      }
      const newEvent = {
        eventId: uuidv4(),
        organizerId: userId,
        title, description, venue, eventDate,
        capacity: Number(capacity),
        registrationDeadline,
        currentCount: 0,
        status: '모집중',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      events.push(newEvent);
      return respond(res, 201, newEvent);
    }

    // GET /events/:eventId
    const eventMatch = path.match(/^\/events\/([^/]+)$/);
    if (method === 'GET' && eventMatch) {
      const event = events.find(e => e.eventId === eventMatch[1]);
      if (!event) return respond(res, 404, { error: '행사를 찾을 수 없습니다.' });
      return respond(res, 200, event);
    }

    // PUT /events/:eventId
    if (method === 'PUT' && eventMatch) {
      const event = events.find(e => e.eventId === eventMatch[1]);
      if (!event) return respond(res, 404, { error: '행사를 찾을 수 없습니다.' });
      if (event.organizerId !== userId) return respond(res, 403, { error: '본인의 행사만 수정할 수 있습니다.' });
      if (event.status !== '모집중') return respond(res, 409, { error: '모집중인 행사만 수정할 수 있습니다.' });
      const body = await parseBody(req);
      if (body.description !== undefined) event.description = body.description;
      if (body.venue !== undefined) event.venue = body.venue;
      if (body.capacity !== undefined) event.capacity = Number(body.capacity);
      if (body.registrationDeadline !== undefined) event.registrationDeadline = body.registrationDeadline;
      event.updatedAt = new Date().toISOString();
      return respond(res, 200, event);
    }

    // PATCH /events/:eventId/status
    const statusMatch = path.match(/^\/events\/([^/]+)\/status$/);
    if (method === 'PATCH' && statusMatch) {
      const event = events.find(e => e.eventId === statusMatch[1]);
      if (!event) return respond(res, 404, { error: '행사를 찾을 수 없습니다.' });
      if (event.organizerId !== userId) return respond(res, 403, { error: '본인의 행사만 변경할 수 있습니다.' });
      const body = await parseBody(req);
      const transitions = { '모집중': ['모집마감', '취소'], '모집마감': ['행사종료', '취소'] };
      const allowed = transitions[event.status] || [];
      if (!allowed.includes(body.status)) {
        return respond(res, 409, { error: `'${event.status}'에서 '${body.status}'로 변경할 수 없습니다.` });
      }
      event.status = body.status;
      event.updatedAt = new Date().toISOString();
      return respond(res, 200, event);
    }

    // GET /events/:eventId/applicants
    const applicantsMatch = path.match(/^\/events\/([^/]+)\/applicants$/);
    if (method === 'GET' && applicantsMatch) {
      const event = events.find(e => e.eventId === applicantsMatch[1]);
      if (!event) return respond(res, 404, { error: '행사를 찾을 수 없습니다.' });
      const applicants = tickets.filter(t => t.eventId === applicantsMatch[1]);
      return respond(res, 200, { eventId: event.eventId, eventTitle: event.title, applicants });
    }

    // GET /events/:eventId/stats
    const statsMatch = path.match(/^\/events\/([^/]+)\/stats$/);
    if (method === 'GET' && statsMatch) {
      const event = events.find(e => e.eventId === statsMatch[1]);
      if (!event) return respond(res, 404, { error: '행사를 찾을 수 없습니다.' });
      const eventTickets = tickets.filter(t => t.eventId === statsMatch[1]);
      const stats = {
        total: eventTickets.length,
        issued: eventTickets.filter(t => t.status === '발급완료').length,
        entered: eventTickets.filter(t => t.status === '입장완료').length,
        cancelled: eventTickets.filter(t => t.status === '취소').length,
      };
      return respond(res, 200, { eventId: event.eventId, eventTitle: event.title, capacity: event.capacity, currentCount: event.currentCount, stats });
    }

    // POST /events/:eventId/tickets
    const ticketCreateMatch = path.match(/^\/events\/([^/]+)\/tickets$/);
    if (method === 'POST' && ticketCreateMatch) {
      if (userRole !== 'student') return respond(res, 403, { error: '권한이 없습니다.' });
      const eventId = ticketCreateMatch[1];
      const event = events.find(e => e.eventId === eventId);
      if (!event) return respond(res, 404, { error: '행사를 찾을 수 없습니다.' });
      if (event.status !== '모집중') return respond(res, 409, { error: '모집중인 행사만 티켓을 신청할 수 있습니다.' });
      if (new Date() > new Date(event.registrationDeadline)) return respond(res, 409, { error: '신청 마감 시간이 지났습니다.' });
      if (event.currentCount >= event.capacity) return respond(res, 409, { error: '정원이 초과되었습니다.' });
      const existing = tickets.find(t => t.eventId === eventId && t.studentId === userId && t.status !== '취소');
      if (existing) return respond(res, 409, { error: '이미 해당 행사에 티켓을 신청했습니다.' });

      const ticket = {
        ticketId: uuidv4(),
        ticketCode: generateTicketCode(),
        eventId,
        studentId: userId,
        status: '발급완료',
        issuedAt: new Date().toISOString(),
      };
      tickets.push(ticket);
      event.currentCount++;
      event.updatedAt = new Date().toISOString();
      return respond(res, 201, ticket);
    }

    // GET /tickets/my
    if (method === 'GET' && path === '/tickets/my') {
      if (userRole !== 'student') return respond(res, 403, { error: '권한이 없습니다.' });
      const myTickets = tickets.filter(t => t.studentId === userId).map(t => {
        const event = events.find(e => e.eventId === t.eventId);
        return { ...t, event: event ? { title: event.title, venue: event.venue, eventDate: event.eventDate, status: event.status } : null };
      });
      return respond(res, 200, { tickets: myTickets });
    }

    // DELETE /tickets/:ticketId
    const cancelMatch = path.match(/^\/tickets\/([^/]+)$/);
    if (method === 'DELETE' && cancelMatch) {
      if (userRole !== 'student') return respond(res, 403, { error: '권한이 없습니다.' });
      const ticket = tickets.find(t => t.ticketId === cancelMatch[1]);
      if (!ticket) return respond(res, 404, { error: '티켓을 찾을 수 없습니다.' });
      if (ticket.studentId !== userId) return respond(res, 403, { error: '본인의 티켓만 취소할 수 있습니다.' });
      if (ticket.status !== '발급완료') return respond(res, 409, { error: `'${ticket.status}' 상태의 티켓은 취소할 수 없습니다.` });
      const event = events.find(e => e.eventId === ticket.eventId);
      if (event && event.status !== '모집중') return respond(res, 409, { error: '모집중인 행사의 티켓만 취소할 수 있습니다.' });
      ticket.status = '취소';
      ticket.cancelledAt = new Date().toISOString();
      if (event) event.currentCount--;
      return respond(res, 200, { message: '티켓이 취소되었습니다.', ticketId: ticket.ticketId, cancelledAt: ticket.cancelledAt });
    }

    // GET /admission/verify/:ticketCode
    const verifyMatch = path.match(/^\/admission\/verify\/([^/]+)$/);
    if (method === 'GET' && verifyMatch) {
      if (userRole !== 'gatekeeper') return respond(res, 403, { error: '권한이 없습니다.' });
      const ticket = tickets.find(t => t.ticketCode === verifyMatch[1]);
      if (!ticket) return respond(res, 200, { valid: false, reason: '존재하지 않는 티켓 코드입니다.' });
      if (ticket.status === '취소') return respond(res, 200, { valid: false, reason: '취소된 티켓입니다.' });
      if (ticket.status === '입장완료') return respond(res, 200, { valid: false, reason: '이미 입장 처리된 티켓입니다.' });
      const event = events.find(e => e.eventId === ticket.eventId);
      if (event && event.status === '취소') return respond(res, 200, { valid: false, reason: '취소된 행사의 티켓입니다.' });
      return respond(res, 200, {
        valid: true,
        reason: '입장 가능합니다.',
        ticketInfo: { ticketCode: ticket.ticketCode, ticketId: ticket.ticketId, studentId: ticket.studentId, eventId: ticket.eventId, eventTitle: event?.title, venue: event?.venue, status: ticket.status },
      });
    }

    // POST /admission/enter/:ticketCode
    const enterMatch = path.match(/^\/admission\/enter\/([^/]+)$/);
    if (method === 'POST' && enterMatch) {
      if (userRole !== 'gatekeeper') return respond(res, 403, { error: '권한이 없습니다.' });
      const ticket = tickets.find(t => t.ticketCode === enterMatch[1]);
      if (!ticket) return respond(res, 404, { error: '존재하지 않는 티켓 코드입니다.' });
      if (ticket.status === '취소') return respond(res, 409, { error: '취소된 티켓은 입장할 수 없습니다.' });
      if (ticket.status === '입장완료') return respond(res, 409, { error: '이미 입장 처리된 티켓입니다.' });
      const event = events.find(e => e.eventId === ticket.eventId);
      if (event && event.status === '취소') return respond(res, 409, { error: '취소된 행사에는 입장할 수 없습니다.' });
      ticket.status = '입장완료';
      ticket.enteredAt = new Date().toISOString();
      return respond(res, 200, { message: '입장 처리가 완료되었습니다.', ticketCode: ticket.ticketCode, studentId: ticket.studentId, eventTitle: event?.title, enteredAt: ticket.enteredAt });
    }

    // GET /admin/dashboard
    if (method === 'GET' && path === '/admin/dashboard') {
      if (userRole !== 'admin') return respond(res, 403, { error: '권한이 없습니다.' });
      const summary = {
        totalEvents: events.length,
        eventsByStatus: {
          '모집중': events.filter(e => e.status === '모집중').length,
          '모집마감': events.filter(e => e.status === '모집마감').length,
          '행사종료': events.filter(e => e.status === '행사종료').length,
          '취소': events.filter(e => e.status === '취소').length,
        },
        totalTickets: tickets.length,
        ticketsByStatus: {
          '발급완료': tickets.filter(t => t.status === '발급완료').length,
          '입장완료': tickets.filter(t => t.status === '입장완료').length,
          '취소': tickets.filter(t => t.status === '취소').length,
        },
      };
      const eventList = events.map(e => ({ eventId: e.eventId, title: e.title, status: e.status, capacity: e.capacity, currentCount: e.currentCount, eventDate: e.eventDate }));
      return respond(res, 200, { summary, events: eventList });
    }

    respond(res, 404, { error: 'Not Found' });
  } catch (err) {
    console.error(err);
    respond(res, 500, { error: 'Internal Server Error' });
  }
});

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`\n🚀 Local API Server running at http://localhost:${PORT}/prod`);
  console.log('   Endpoints mirror the SAM template API Gateway\n');
});
