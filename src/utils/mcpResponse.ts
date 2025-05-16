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
export function createJsonResponse(data: any): McpResponse {
  return {
    content: [{
      type: "text",
      text: JSON.stringify(data, null, 2)
    }]
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