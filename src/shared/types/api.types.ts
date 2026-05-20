export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

/** Error payload — `message` is user-facing; `developerMessage` is for debugging */
export interface ApiErrorResponse {
  success: false;
  message: string;
  developerMessage: string;
  errors?: Record<string, string[] | undefined>;
}
