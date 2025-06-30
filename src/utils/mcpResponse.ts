/**
 * Success response helper
 */
export function createSuccessResponse(text: string, metadata?: Record<string, any>): McpResponse {
  return {
    content: [{
      type: "text",
      text
    }],
    _meta: metadata
  };
}

/**
 * JSON response helper
 */
export function createJsonResponse(data: any, otherData: any[]|null=null): McpResponse {
  const result: McpContent[] = [{
    type: "text",
    text: JSON.stringify(data, null, 2)
  } as McpContent];
  if (otherData != null) {
    result.push(...otherData as McpContent[]);
  }
  return {
    content: result
  };
}

/**
 * Error response helper
 */
export function createErrorResponse(errorMessage: string): McpResponse {
  return {
    content: [{
      type: "text",
      text: errorMessage
    }],
    isError: true
  };
}