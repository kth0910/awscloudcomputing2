import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

export const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

export const EVENTS_TABLE = process.env.EVENTS_TABLE || 'TicketingEvents';
export const TICKETS_TABLE = process.env.TICKETS_TABLE || 'TicketingTickets';
