import { GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, EVENTS_TABLE, TICKETS_TABLE } from '../../lib/dynamodb.js';
import { success, error } from '../../lib/response.js';
import { requireRole } from '../../lib/auth.js';

export const handler = async (event) => {
  const auth = requireRole(event, 'organizer');
  if (!auth.authorized) return error(auth.message, 403);

  const eventId = event.pathParameters?.eventId;
  if (!eventId) return error('eventId가 필요합니다.', 400);

  // 행사 소유자 확인
  const eventResult = await docClient.send(new GetCommand({
    TableName: EVENTS_TABLE,
    Key: { eventId },
  }));

  if (!eventResult.Item) return error('행사를 찾을 수 없습니다.', 404);
  if (eventResult.Item.organizerId !== auth.userId) {
    return error('본인의 행사만 조회할 수 있습니다.', 403);
  }

  // Scan + Filter로 해당 행사의 티켓 조회
  const ticketResult = await docClient.send(new ScanCommand({
    TableName: TICKETS_TABLE,
    FilterExpression: 'eventId = :eventId',
    ExpressionAttributeValues: { ':eventId': eventId },
  }));

  const applicants = (ticketResult.Items || []).map(t => ({
    ticketId: t.ticketId,
    studentId: t.studentId,
    ticketCode: t.ticketCode,
    status: t.status,
    issuedAt: t.issuedAt,
    enteredAt: t.enteredAt,
    cancelledAt: t.cancelledAt,
  }));

  return success({ eventId, eventTitle: eventResult.Item.title, applicants });
};
