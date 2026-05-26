import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, EVENTS_TABLE } from '../../lib/dynamodb.js';
import { success, error } from '../../lib/response.js';

export const handler = async (event) => {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: EVENTS_TABLE,
      IndexName: 'status-index',
      KeyConditionExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': '모집중' },
    }));

    return success({ events: result.Items || [] });
  } catch (err) {
    console.error('getEvents error:', err);
    return error('행사 목록 조회에 실패했습니다.', 500);
  }
};
