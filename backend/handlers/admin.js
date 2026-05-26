import { GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, EVENTS_TABLE, TICKETS_TABLE } from '../lib/dynamodb.js';
import { success, error } from '../lib/response.js';
import { requireRole } from '../lib/auth.js';

export async function handleGetApplicants(event) {
  const auth = requireRole(event, 'organizer');
  if (!auth.authorized) return error(auth.message, 403);

  const eventId = event.pathParameters?.eventId;
  if (!eventId) return error('eventId가 필요합니다.', 400);

  const eventResult = await docClient.send(new GetCommand({ TableName: EVENTS_TABLE, Key: { eventId } }));
  if (!eventResult.Item) return error('행사를 찾을 수 없습니다.', 404);
  if (eventResult.Item.organizerId !== auth.userId) return error('본인의 행사만 조회할 수 있습니다.', 403);

  const ticketResult = await docClient.send(new ScanCommand({
    TableName: TICKETS_TABLE,
    FilterExpression: 'eventId = :eventId',
    ExpressionAttributeValues: { ':eventId': eventId },
  }));

  const applicants = (ticketResult.Items || []).map(t => ({
    ticketId: t.ticketId, studentId: t.studentId, ticketCode: t.ticketCode,
    status: t.status, issuedAt: t.issuedAt, enteredAt: t.enteredAt, cancelledAt: t.cancelledAt,
  }));

  return success({ eventId, eventTitle: eventResult.Item.title, applicants });
}

export async function handleGetEventStats(event) {
  const auth = requireRole(event, 'organizer');
  if (!auth.authorized) return error(auth.message, 403);

  const eventId = event.pathParameters?.eventId;
  if (!eventId) return error('eventId가 필요합니다.', 400);

  const eventResult = await docClient.send(new GetCommand({ TableName: EVENTS_TABLE, Key: { eventId } }));
  if (!eventResult.Item) return error('행사를 찾을 수 없습니다.', 404);
  if (eventResult.Item.organizerId !== auth.userId) return error('본인의 행사만 조회할 수 있습니다.', 403);

  const ticketResult = await docClient.send(new ScanCommand({
    TableName: TICKETS_TABLE,
    FilterExpression: 'eventId = :eventId',
    ExpressionAttributeValues: { ':eventId': eventId },
  }));

  const tickets = ticketResult.Items || [];
  const stats = {
    total: tickets.length,
    issued: tickets.filter(t => t.status === '발급완료').length,
    entered: tickets.filter(t => t.status === '입장완료').length,
    cancelled: tickets.filter(t => t.status === '취소').length,
  };

  return success({ eventId, eventTitle: eventResult.Item.title, capacity: eventResult.Item.capacity, currentCount: eventResult.Item.currentCount, stats });
}

export async function handleGetDashboard(event) {
  const auth = requireRole(event, 'admin');
  if (!auth.authorized) return error(auth.message, 403);

  const eventsResult = await docClient.send(new ScanCommand({ TableName: EVENTS_TABLE }));
  const events = eventsResult.Items || [];

  const ticketsResult = await docClient.send(new ScanCommand({
    TableName: TICKETS_TABLE,
    ProjectionExpression: '#s, eventId',
    ExpressionAttributeNames: { '#s': 'status' },
  }));
  const tickets = ticketsResult.Items || [];

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

  const eventList = events.map(e => ({
    eventId: e.eventId, title: e.title, status: e.status,
    capacity: e.capacity, currentCount: e.currentCount, eventDate: e.eventDate,
  }));

  return success({ summary, events: eventList });
}
