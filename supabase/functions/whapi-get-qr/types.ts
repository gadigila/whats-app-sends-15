
export interface GetQrRequest {
  userId: string
}

export interface QrResponse {
  success: boolean
  qr_code?: string
  error?: string
  message?: string
  details?: any
  requiresNewInstance?: boolean
  retryable?: boolean
}

export interface UserProfile {
  instance_id: string | null
  whapi_token: string | null
}
