import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, EVENTS_TABLE } from '../../lib/dynamodb.js';
import { success, error } from '../../lib/response.js';

export const handler = async (event) => {
  const eventId = event.pathParameters?.eventId;
  if (!eventId) return error('eventId가 필요합니다.', 400);

  try {
    const result = await docClient.send(new GetCommand({
      TableName: EVENTS_TABLE,
      Key: { eventId },
    }));

    if (!result.Item) {
      return error('행사를 찾을 수 없습니다.', 404);
    }

    return success(result.Item);
  } catch (err) {
    console.error('getEvent error:', err);
    return error('행사 조회에 실패했습니다.', 500);
  }
};
