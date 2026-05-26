import { GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, EVENTS_TABLE, TICKETS_TABLE } from '../../lib/dynamodb.js';
import { success, error } from '../../lib/response.js';
import { requireRole } from '../../lib/auth.js';

export const handler = async (event) => {
  const auth = requireRole(event, 'student');
  if (!auth.authorized) return error(auth.message, 403);

  const ticketId = event.pathParameters?.ticketId;
  if (!ticketId) return error('ticketId가 필요합니다.', 400);

  // 1. 티켓 조회
  const ticketResult = await docClient.send(new GetCommand({
    TableName: TICKETS_TABLE,
    Key: { ticketId },
  }));

  if (!ticketResult.Item) return error('티켓을 찾을 수 없습니다.', 404);

  const ticket = ticketResult.Item;

  // 2. 본인 소유 확인
  if (ticket.studentId !== auth.userId) {
    return error('본인의 티켓만 취소할 수 있습니다.', 403);
  }

  // 3. 티켓 상태 확인
  if (ticket.status !== '발급완료') {
    return error(`'${ticket.status}' 상태의 티켓은 취소할 수 없습니다.`, 409);
  }

  // 4. 행사 상태 확인
  const eventResult = await docClient.send(new GetCommand({
    TableName: EVENTS_TABLE,
    Key: { eventId: ticket.eventId },
  }));

  if (!eventResult.Item) return error('행사를 찾을 수 없습니다.', 404);
  if (eventResult.Item.status !== '모집중') {
    return error('모집중인 행사의 티켓만 취소할 수 있습니다.', 409);
  }

  // 5. 트랜잭션으로 취소 처리 + 인원 감소
  const now = new Date().toISOString();

  try {
    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: TICKETS_TABLE,
            Key: { ticketId },
            UpdateExpression: 'SET #status = :cancelled, cancelledAt = :now',
            ConditionExpression: '#status = :issued',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':cancelled': '취소', ':now': now, ':issued': '발급완료' },
          },
        },
        {
          Update: {
            TableName: EVENTS_TABLE,
            Key: { eventId: ticket.eventId },
            UpdateExpression: 'SET currentCount = currentCount - :dec, updatedAt = :now',
            ConditionExpression: 'currentCount > :zero',
            ExpressionAttributeValues: { ':dec': 1, ':now': now, ':zero': 0 },
          },
        },
      ],
    }));
  } catch (err) {
    if (err.name === 'TransactionCanceledException') {
      return error('티켓 취소에 실패했습니다. 상태를 다시 확인해주세요.', 409);
    }
    throw err;
  }

  return success({ message: '티켓이 취소되었습니다.', ticketId, cancelledAt: now });
};
