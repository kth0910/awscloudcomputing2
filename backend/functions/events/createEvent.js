import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, EVENTS_TABLE } from '../../lib/dynamodb.js';
import { success, error } from '../../lib/response.js';
import { requireRole } from '../../lib/auth.js';

export const handler = async (event) => {
  const auth = requireRole(event, 'organizer');
  if (!auth.authorized) return error(auth.message, 403);

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return error('잘못된 요청 형식입니다.', 400);
  }

  const { title, description, venue, eventDate, capacity, registrationDeadline } = body;

  if (!title || !description || !venue || !eventDate || !capacity || !registrationDeadline) {
    return error('필수 필드가 누락되었습니다. (title, description, venue, eventDate, capacity, registrationDeadline)', 400);
  }

  if (typeof capacity !== 'number' || capacity <= 0) {
    return error('정원(capacity)은 1 이상의 숫자여야 합니다.', 400);
  }

  const now = new Date().toISOString();
  const newEvent = {
    eventId: uuidv4(),
    organizerId: auth.userId,
    title,
    description,
    venue,
    eventDate,
    capacity,
    registrationDeadline,
    currentCount: 0,
    status: '모집중',
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({
    TableName: EVENTS_TABLE,
    Item: newEvent,
  }));

  return success(newEvent, 201);
};
