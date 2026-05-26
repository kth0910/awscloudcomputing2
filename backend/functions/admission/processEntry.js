import { QueryCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
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
    return error('존재하지 않는 티켓 코드입니다.', 404);
  }

  const ticket = ticketResult.Items[0];

  // 2. 티켓 상태 확인
  if (ticket.status === '취소') {
    return error('취소된 티켓은 입장할 수 없습니다.', 409);
  }

  if (ticket.status === '입장완료') {
    return error('이미 입장 처리된 티켓입니다.', 409);
  }

  // 3. 행사 상태 확인
  const eventResult = await docClient.send(new GetCommand({
    TableName: EVENTS_TABLE,
    Key: { eventId: ticket.eventId },
  }));

  if (!eventResult.Item) {
    return error('행사 정보를 찾을 수 없습니다.', 404);
  }

  if (eventResult.Item.status === '취소') {
    return error('취소된 행사에는 입장할 수 없습니다.', 409);
  }

  // 4. 입장 처리
  const now = new Date().toISOString();

  try {
    await docClient.send(new UpdateCommand({
      TableName: TICKETS_TABLE,
      Key: { ticketId: ticket.ticketId },
      UpdateExpression: 'SET #status = :entered, enteredAt = :now',
      ConditionExpression: '#status = :issued',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':entered': '입장완료', ':now': now, ':issued': '발급완료' },
    }));
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return error('티켓 상태가 변경되어 입장 처리할 수 없습니다.', 409);
    }
    throw err;
  }

  return success({
    message: '입장 처리가 완료되었습니다.',
    ticketCode,
    studentId: ticket.studentId,
    eventTitle: eventResult.Item.title,
    enteredAt: now,
  });
};
