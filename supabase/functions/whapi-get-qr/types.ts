
export interface GetQrRequest {
  userId: string
}

export interface UserProfile {
  instance_id: string | null
  whapi_token: string | null
}

export interface QrResponse {
  success: boolean
  qr_code?: string
  message?: string
  error?: string
  requiresNewInstance?: boolean
  details?: any
}
