import { GetCommand, ScanCommand, TransactWriteCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, EVENTS_TABLE, TICKETS_TABLE } from '../lib/dynamodb.js';
import { success, error } from '../lib/response.js';
import { requireRole } from '../lib/auth.js';

function generateTicketCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function handleCreateTicket(event) {
  const auth = requireRole(event, 'student');
  if (!auth.authorized) return error(auth.message, 403);

  const eventId = event.pathParameters?.eventId;
  if (!eventId) return error('eventId가 필요합니다.', 400);

  const eventResult = await docClient.send(new GetCommand({ TableName: EVENTS_TABLE, Key: { eventId } }));
  if (!eventResult.Item) return error('행사를 찾을 수 없습니다.', 404);

  const eventItem = eventResult.Item;
  if (eventItem.status !== '모집중') return error('모집중인 행사만 티켓을 신청할 수 있습니다.', 409);
  if (new Date() > new Date(eventItem.registrationDeadline)) return error('신청 마감 시간이 지났습니다.', 409);
  if (eventItem.currentCount >= eventItem.capacity) return error('정원이 초과되었습니다.', 409);

  // 중복 신청 확인 (Scan + Filter)
  const dupCheck = await docClient.send(new ScanCommand({
    TableName: TICKETS_TABLE,
    FilterExpression: 'eventId = :eventId AND studentId = :studentId AND #s <> :cancelled',
    ExpressionAttributeNames: { '#s': 'status' },
    ExpressionAttributeValues: { ':eventId': eventId, ':studentId': auth.userId, ':cancelled': '취소' },
  }));
  if (dupCheck.Items && dupCheck.Items.length > 0) {
    return error('이미 해당 행사에 티켓을 신청했습니다.', 409);
  }

  const ticketId = uuidv4();
  const ticketCode = generateTicketCode();
  const now = new Date().toISOString();

  try {
    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: TICKETS_TABLE,
            Item: { ticketId, ticketCode, eventId, studentId: auth.userId, status: '발급완료', issuedAt: now },
            ConditionExpression: 'attribute_not_exists(ticketId)',
          },
        },
        {
          Update: {
            TableName: EVENTS_TABLE, Key: { eventId },
            UpdateExpression: 'SET #count = #count + :inc, updatedAt = :now',
            ConditionExpression: '#count < #cap AND #status = :recruiting',
            ExpressionAttributeNames: { '#status': 'status', '#count': 'currentCount', '#cap': 'capacity' },
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
}

export async function handleGetMyTickets(event) {
  const auth = requireRole(event, 'student');
  if (!auth.authorized) return error(auth.message, 403);

  const result = await docClient.send(new ScanCommand({
    TableName: TICKETS_TABLE,
    FilterExpression: 'studentId = :studentId',
    ExpressionAttributeValues: { ':studentId': auth.userId },
  }));

  const tickets = result.Items || [];
  if (tickets.length > 0) {
    const eventIds = [...new Set(tickets.map(t => t.eventId))];
    const batchResult = await docClient.send(new BatchGetCommand({
      RequestItems: { [EVENTS_TABLE]: { Keys: eventIds.map(id => ({ eventId: id })) } },
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
}

export async function handleCancelTicket(event) {
  const auth = requireRole(event, 'student');
  if (!auth.authorized) return error(auth.message, 403);

  const ticketId = event.pathParameters?.ticketId;
  if (!ticketId) return error('ticketId가 필요합니다.', 400);

  const ticketResult = await docClient.send(new GetCommand({ TableName: TICKETS_TABLE, Key: { ticketId } }));
  if (!ticketResult.Item) return error('티켓을 찾을 수 없습니다.', 404);

  const ticket = ticketResult.Item;
  if (ticket.studentId !== auth.userId) return error('본인의 티켓만 취소할 수 있습니다.', 403);
  if (ticket.status !== '발급완료') return error(`'${ticket.status}' 상태의 티켓은 취소할 수 없습니다.`, 409);

  const eventResult = await docClient.send(new GetCommand({ TableName: EVENTS_TABLE, Key: { eventId: ticket.eventId } }));
  if (!eventResult.Item) return error('행사를 찾을 수 없습니다.', 404);
  if (eventResult.Item.status !== '모집중') return error('모집중인 행사의 티켓만 취소할 수 있습니다.', 409);

  const now = new Date().toISOString();
  try {
    await docClient.send(new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: TICKETS_TABLE, Key: { ticketId },
            UpdateExpression: 'SET #status = :cancelled, cancelledAt = :now',
            ConditionExpression: '#status = :issued',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':cancelled': '취소', ':now': now, ':issued': '발급완료' },
          },
        },
        {
          Update: {
            TableName: EVENTS_TABLE, Key: { eventId: ticket.eventId },
            UpdateExpression: 'SET #count = #count - :dec, updatedAt = :now',
            ConditionExpression: '#count > :zero',
            ExpressionAttributeNames: { '#count': 'currentCount' },
            ExpressionAttributeValues: { ':dec': 1, ':now': now, ':zero': 0 },
          },
        },
      ],
    }));
  } catch (err) {
    if (err.name === 'TransactionCanceledException') {
      return error('티켓 취소에 실패했습니다.', 409);
    }
    throw err;
  }

  return success({ message: '티켓이 취소되었습니다.', ticketId, cancelledAt: now });
}
