/** Runtime declarations for the optional DynamoDB adapter. */
declare module '@aws-sdk/client-dynamodb' {
  export class DynamoDBClient {
    constructor(config?: unknown);
  }
}

declare module '@aws-sdk/lib-dynamodb' {
  export class DynamoDBDocumentClient {
    static from(client: unknown, config?: unknown): DynamoDBDocumentClient;
    send(command: unknown): Promise<any>;
  }
  export class QueryCommand { constructor(input: any); }
  export class GetCommand { constructor(input: any); }
  export class PutCommand { constructor(input: any); }
  export class DeleteCommand { constructor(input: any); }
}
