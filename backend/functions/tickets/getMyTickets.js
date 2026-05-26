import { ScanCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, EVENTS_TABLE, TICKETS_TABLE } from '../../lib/dynamodb.js';
import { success, error } from '../../lib/response.js';
import { requireRole } from '../../lib/auth.js';

export const handler = async (event) => {
  const auth = requireRole(event, 'student');
  if (!auth.authorized) return error(auth.message, 403);

  try {
    // Scan + Filter로 학생별 티켓 조회
    const result = await docClient.send(new ScanCommand({
      TableName: TICKETS_TABLE,
      FilterExpression: 'studentId = :studentId',
      ExpressionAttributeValues: { ':studentId': auth.userId },
    }));

    const tickets = result.Items || [];

    // 행사 정보도 함께 조회
    if (tickets.length > 0) {
      const eventIds = [...new Set(tickets.map(t => t.eventId))];
      const keys = eventIds.map(id => ({ eventId: id }));

      const batchResult = await docClient.send(new BatchGetCommand({
        RequestItems: {
          [EVENTS_TABLE]: { Keys: keys },
        },
      }));

      const eventsMap = {};
      for (const item of (batchResult.Responses?.[EVENTS_TABLE] || [])) {
        eventsMap[item.eventId] = { title: item.title, venue: item.venue, eventDate: item.eventDate, status: item.status };
      }

      for (const ticket of tickets) {
        ticket.event = eventsMap[ticket.eventId] || null;
      }
    }

    return success({ tickets });
  } catch (err) {
    console.error('getMyTickets error:', err);
    return error('티켓 목록 조회에 실패했습니다.', 500);
  }
};
