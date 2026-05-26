import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, EVENTS_TABLE, TICKETS_TABLE } from '../../lib/dynamodb.js';
import { success, error } from '../../lib/response.js';
import { requireRole } from '../../lib/auth.js';

export const handler = async (event) => {
  const auth = requireRole(event, 'admin');
  if (!auth.authorized) return error(auth.message, 403);

  try {
    // 전체 행사 조회
    const eventsResult = await docClient.send(new ScanCommand({
      TableName: EVENTS_TABLE,
    }));

    const events = eventsResult.Items || [];

    // 전체 티켓 통계
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
      eventId: e.eventId,
      title: e.title,
      status: e.status,
      capacity: e.capacity,
      currentCount: e.currentCount,
      eventDate: e.eventDate,
    }));

    return success({ summary, events: eventList });
  } catch (err) {
    console.error('getDashboard error:', err);
    return error('대시보드 조회에 실패했습니다.', 500);
  }
};
