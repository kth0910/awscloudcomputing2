import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, EVENTS_TABLE } from '../../lib/dynamodb.js';
import { success, error } from '../../lib/response.js';
import { requireRole } from '../../lib/auth.js';

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

  // 행사 조회
  const existing = await docClient.send(new GetCommand({
    TableName: EVENTS_TABLE,
    Key: { eventId },
  }));

  if (!existing.Item) return error('행사를 찾을 수 없습니다.', 404);
  if (existing.Item.organizerId !== auth.userId) return error('본인의 행사만 수정할 수 있습니다.', 403);
  if (existing.Item.status !== '모집중') return error('모집중인 행사만 수정할 수 있습니다.', 409);

  // 수정 가능 필드
  const allowedFields = ['description', 'venue', 'capacity', 'registrationDeadline'];
  const updates = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return error('수정할 필드가 없습니다.', 400);
  }

  updates.updatedAt = new Date().toISOString();

  const expressionParts = [];
  const expressionValues = {};
  const expressionNames = {};

  for (const [key, value] of Object.entries(updates)) {
    expressionParts.push(`#${key} = :${key}`);
    expressionValues[`:${key}`] = value;
    expressionNames[`#${key}`] = key;
  }

  const result = await docClient.send(new UpdateCommand({
    TableName: EVENTS_TABLE,
    Key: { eventId },
    UpdateExpression: `SET ${expressionParts.join(', ')}`,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: expressionValues,
    ReturnValues: 'ALL_NEW',
  }));

  return success(result.Attributes);
};
