import { PutCommand, QueryCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, EVENTS_TABLE } from '../lib/dynamodb.js';
import { success, error } from '../lib/response.js';
import { requireRole } from '../lib/auth.js';

export async function handleCreateEvent(event) {
  const auth = requireRole(event, 'organizer');
  if (!auth.authorized) return error(auth.message, 403);

  let body;
  try { body = JSON.parse(event.body); } catch { return error('잘못된 요청 형식입니다.', 400); }

  const { title, description, venue, eventDate, capacity, registrationDeadline } = body;
  if (!title || !description || !venue || !eventDate || !capacity || !registrationDeadline) {
    return error('필수 필드가 누락되었습니다.', 400);
  }
  if (typeof capacity !== 'number' || capacity <= 0) {
    return error('정원(capacity)은 1 이상의 숫자여야 합니다.', 400);
  }

  const now = new Date().toISOString();
  const newEvent = {
    eventId: uuidv4(), organizerId: auth.userId,
    title, description, venue, eventDate,
    capacity, registrationDeadline,
    currentCount: 0, status: '모집중',
    createdAt: now, updatedAt: now,
  };

  await docClient.send(new PutCommand({ TableName: EVENTS_TABLE, Item: newEvent }));
  return success(newEvent, 201);
}

export async function handleGetEvents(event) {
  const result = await docClient.send(new QueryCommand({
    TableName: EVENTS_TABLE,
    IndexName: 'status-index',
    KeyConditionExpression: '#status = :status',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': '모집중' },
  }));
  return success({ events: result.Items || [] });
}

export async function handleGetEvent(event) {
  const eventId = event.pathParameters?.eventId;
  if (!eventId) return error('eventId가 필요합니다.', 400);

  const result = await docClient.send(new GetCommand({ TableName: EVENTS_TABLE, Key: { eventId } }));
  if (!result.Item) return error('행사를 찾을 수 없습니다.', 404);
  return success(result.Item);
}

export async function handleUpdateEvent(event) {
  const auth = requireRole(event, 'organizer');
  if (!auth.authorized) return error(auth.message, 403);

  const eventId = event.pathParameters?.eventId;
  if (!eventId) return error('eventId가 필요합니다.', 400);

  let body;
  try { body = JSON.parse(event.body); } catch { return error('잘못된 요청 형식입니다.', 400); }

  const existing = await docClient.send(new GetCommand({ TableName: EVENTS_TABLE, Key: { eventId } }));
  if (!existing.Item) return error('행사를 찾을 수 없습니다.', 404);
  if (existing.Item.organizerId !== auth.userId) return error('본인의 행사만 수정할 수 있습니다.', 403);
  if (existing.Item.status !== '모집중') return error('모집중인 행사만 수정할 수 있습니다.', 409);

  const allowedFields = ['description', 'venue', 'capacity', 'registrationDeadline'];
  const updates = {};
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field];
  }
  if (Object.keys(updates).length === 0) return error('수정할 필드가 없습니다.', 400);

  updates.updatedAt = new Date().toISOString();
  const parts = [], values = {}, names = {};
  for (const [key, value] of Object.entries(updates)) {
    parts.push(`#${key} = :${key}`);
    values[`:${key}`] = value;
    names[`#${key}`] = key;
  }

  const result = await docClient.send(new UpdateCommand({
    TableName: EVENTS_TABLE, Key: { eventId },
    UpdateExpression: `SET ${parts.join(', ')}`,
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW',
  }));
  return success(result.Attributes);
}

export async function handleUpdateEventStatus(event) {
  const auth = requireRole(event, 'organizer');
  if (!auth.authorized) return error(auth.message, 403);

  const eventId = event.pathParameters?.eventId;
  if (!eventId) return error('eventId가 필요합니다.', 400);

  let body;
  try { body = JSON.parse(event.body); } catch { return error('잘못된 요청 형식입니다.', 400); }

  const { status: newStatus } = body;
  if (!newStatus) return error('변경할 상태(status)가 필요합니다.', 400);

  const existing = await docClient.send(new GetCommand({ TableName: EVENTS_TABLE, Key: { eventId } }));
  if (!existing.Item) return error('행사를 찾을 수 없습니다.', 404);
  if (existing.Item.organizerId !== auth.userId) return error('본인의 행사만 변경할 수 있습니다.', 403);

  const transitions = { '모집중': ['모집마감', '취소'], '모집마감': ['행사종료', '취소'], '행사종료': [], '취소': [] };
  const allowed = transitions[existing.Item.status] || [];
  if (!allowed.includes(newStatus)) {
    return error(`'${existing.Item.status}'에서 '${newStatus}'로 변경할 수 없습니다.`, 409);
  }

  const result = await docClient.send(new UpdateCommand({
    TableName: EVENTS_TABLE, Key: { eventId },
    UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
    ExpressionAttributeNames: { '#status': 'status', '#updatedAt': 'updatedAt' },
    ExpressionAttributeValues: { ':status': newStatus, ':updatedAt': new Date().toISOString() },
    ReturnValues: 'ALL_NEW',
  }));
  return success(result.Attributes);
}
