import { QueryCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, EVENTS_TABLE, TICKETS_TABLE } from '../../lib/dynamodb.js';
import { success, error } from '../../lib/response.js';
import { requireRole } from '../../lib/auth.js';

export const handler = async (event) => {
  const auth = requireRole(event, 'gatekeeper');
  if (!auth.authorized) return error(auth.message, 403);

  const ticketCode = event.pathParameters?.ticketCode;
  if (!ticketCode) return error('ticketCode가 필요합니다.', 400);

  // 1. 티켓 코드로 조회
  const ticketResult = await docClient.send(new QueryCommand({
    TableName: TICKETS_TABLE,
    IndexName: 'ticketCode-index',
    KeyConditionExpression: 'ticketCode = :ticketCode',
    ExpressionAttributeValues: { ':ticketCode': ticketCode },
  }));

  if (!ticketResult.Items || ticketResult.Items.length === 0) {
    return success({ valid: false, reason: '존재하지 않는 티켓 코드입니다.' });
  }

  const ticket = ticketResult.Items[0];

  // 2. 티켓 상태 확인
  if (ticket.status === '취소') {
    return success({ valid: false, reason: '취소된 티켓입니다.', ticketInfo: { ticketCode, status: ticket.status } });
  }

  if (ticket.status === '입장완료') {
    return success({ valid: false, reason: '이미 입장 처리된 티켓입니다.', ticketInfo: { ticketCode, status: ticket.status, enteredAt: ticket.enteredAt } });
  }

  // 3. 행사 상태 확인
  const eventResult = await docClient.send(new GetCommand({
    TableName: EVENTS_TABLE,
    Key: { eventId: ticket.eventId },
  }));

  if (!eventResult.Item) {
    return success({ valid: false, reason: '행사 정보를 찾을 수 없습니다.' });
  }

  if (eventResult.Item.status === '취소') {
    return success({ valid: false, reason: '취소된 행사의 티켓입니다.', ticketInfo: { ticketCode, eventTitle: eventResult.Item.title } });
  }

  // 4. 유효한 티켓
  return success({
    valid: true,
    reason: '입장 가능합니다.',
    ticketInfo: {
      ticketCode,
      ticketId: ticket.ticketId,
      studentId: ticket.studentId,
      eventId: ticket.eventId,
      eventTitle: eventResult.Item.title,
      venue: eventResult.Item.venue,
      status: ticket.status,
    },
  });
};
