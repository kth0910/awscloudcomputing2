import { GetCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, EVENTS_TABLE, TICKETS_TABLE } from '../../lib/dynamodb.js';
import { success, error } from '../../lib/response.js';
import { requireRole } from '../../lib/auth.js';

function generateTicketCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export const handler = async (event) => {
  const auth = requireRole(event, 'student');
  if (!auth.authorized) return error(auth.message, 403);

  const eventId = event.pathParameters?.eventId;
  if (!eventId) return error('eventId가 필요합니다.', 400);

  // 1. 행사 조회
  const eventResult = await docClient.send(new GetCommand({
    TableName: EVENTS_TABLE,
    Key: { eventId },
  }));

  if (!eventResult.Item) return error('행사를 찾을 수 없습니다.', 404);

  const eventItem = eventResult.Item;

  // 2. 모집중 확인
  if (eventItem.status !== '모집중') {
    return error('모집중인 행사만 티켓을 신청할 수 있습니다.', 409);
  }

  // 3. 마감 시간 확인
  if (new Date() > new Date(eventItem.registrationDeadline)) {
    return error('신청 마감 시간이 지났습니다.', 409);
  }

  // 4. 정원 확인
  if (eventItem.currentCount >= eventItem.capacity) {
    return error('정원이 초과되었습니다.', 409);
  }

  // 5. 중복 신청 확인 (Scan + Filter)
  const duplicateCheck = await docClient.send(new ScanCommand({
    TableName: TICKETS_TABLE,
    FilterExpression: 'eventId = :eventId AND studentId = :studentId AND #status <> :cancelled',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':eventId': eventId, ':studentId': auth.userId, ':cancelled': '취소' },
  }));

  if (duplicateCheck.Items && duplicateCheck.Items.length > 0) {
    return error('이미 해당 행사에 티켓을 신청했습니다.', 409);
  }

  // 6. 트랜잭션으로 티켓 생성 + 인원 증가
  const ticketId = uuidv4();
  const ticketCode = generateTicketCode();
  const now = new Date().toISOString();

  try {
    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TICKETS_TABLE,
            Item: {
              ticketId,
              ticketCode,
              eventId,
              studentId: auth.userId,
              status: '발급완료',
              issuedAt: now,
            },
            ConditionExpression: 'attribute_not_exists(ticketId)',
          },
        },
        {
          Update: {
            TableName: EVENTS_TABLE,
            Key: { eventId },
            UpdateExpression: 'SET currentCount = currentCount + :inc, updatedAt = :now',
            ConditionExpression: 'currentCount < capacity AND #status = :recruiting',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':inc': 1, ':now': now, ':recruiting': '모집중' },
          },
        },
      ],
    }));
  } catch (err) {
    if (err.name === 'TransactionCanceledException') {
      return error('정원이 초과되었거나 행사 상태가 변경되었습니다.', 409);
    }
    throw err;
  }

  return success({ ticketId, ticketCode, eventId, status: '발급완료', issuedAt: now }, 201);
};
