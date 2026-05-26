import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, EVENTS_TABLE } from '../../lib/dynamodb.js';
import { success, error } from '../../lib/response.js';
import { requireRole } from '../../lib/auth.js';

const VALID_TRANSITIONS = {
  '모집중': ['모집마감', '취소'],
  '모집마감': ['행사종료', '취소'],
  '행사종료': [],
  '취소': [],
};

export const handler = async (event) => {
  const auth = requireRole(event, 'organizer');
  if (!auth.authorized) return error(auth.message, 403);

  const eventId = event.pathParameters?.eventId;
  if (!eventId) return error('eventId가 필요합니다.', 400);

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return error('잘못된 요청 형식입니다.', 400);
  }

  const { status: newStatus } = body;
  if (!newStatus) return error('변경할 상태(status)가 필요합니다.', 400);

  const existing = await docClient.send(new GetCommand({
    TableName: EVENTS_TABLE,
    Key: { eventId },
  }));

  if (!existing.Item) return error('행사를 찾을 수 없습니다.', 404);
  if (existing.Item.organizerId !== auth.userId) return error('본인의 행사만 변경할 수 있습니다.', 403);

  const currentStatus = existing.Item.status;
  const allowed = VALID_TRANSITIONS[currentStatus] || [];

  if (!allowed.includes(newStatus)) {
    return error(`'${currentStatus}' 상태에서 '${newStatus}'로 변경할 수 없습니다.`, 409);
  }

  const result = await docClient.send(new UpdateCommand({
    TableName: EVENTS_TABLE,
    Key: { eventId },
    UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
    ExpressionAttributeNames: { '#status': 'status', '#updatedAt': 'updatedAt' },
    ExpressionAttributeValues: { ':status': newStatus, ':updatedAt': new Date().toISOString() },
    ReturnValues: 'ALL_NEW',
  }));

  return success(result.Attributes);
};
