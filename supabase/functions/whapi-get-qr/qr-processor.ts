
import type { QrResponse } from './types.ts'

export class QrProcessor {
  processQrResponse(qrData: any): QrResponse {
    console.log('✅ QR data received:', Object.keys(qrData))
    console.log('📋 QR response structure:', JSON.stringify(qrData, null, 2))
    
    // Handle different possible response formats from WHAPI loginuser endpoints
    let qrCodeUrl = null
    
    // Check for direct QR code in various formats
    if (qrData.qrCode) {
      qrCodeUrl = this.formatQrCode(qrData.qrCode)
    } else if (qrData.qr_code) {
      qrCodeUrl = this.formatQrCode(qrData.qr_code)
    } else if (qrData.qr) {
      qrCodeUrl = this.formatQrCode(qrData.qr)
    } else if (qrData.image) {
      qrCodeUrl = this.formatQrCode(qrData.image)
    } else if (qrData.data?.qrCode) {
      qrCodeUrl = this.formatQrCode(qrData.data.qrCode)
    } else if (qrData.data?.qr_code) {
      qrCodeUrl = this.formatQrCode(qrData.data.qr_code)
    } else if (qrData.data?.qr) {
      qrCodeUrl = this.formatQrCode(qrData.data.qr)
    } else if (qrData.result?.qrCode) {
      qrCodeUrl = this.formatQrCode(qrData.result.qrCode)
    } else if (typeof qrData === 'string') {
      // Sometimes the response might be a direct base64 string
      qrCodeUrl = this.formatQrCode(qrData)
    }
    
    if (qrCodeUrl) {
      console.log('✅ QR code processed successfully')
      return {
        success: true,
        qr_code: qrCodeUrl,
        message: 'QR code retrieved successfully'
      }
    } else {
      console.error('⚠️ No QR code found in API response:', qrData)
      return {
        success: false,
        error: 'No QR code in API response',
        details: { responseKeys: Object.keys(qrData), response: qrData }
      }
    }
  }

  private formatQrCode(qrCode: string): string {
    if (!qrCode) return ''
    
    // If it's already a data URL, return as is
    if (qrCode.startsWith('data:image/')) {
      return qrCode
    }
    
    // If it's a base64 string, format it as data URL
    if (qrCode.match(/^[A-Za-z0-9+/]+=*$/)) {
      return `data:image/png;base64,${qrCode}`
    }
    
    // If it's a URL, return as is
    if (qrCode.startsWith('http')) {
      return qrCode
    }
    
    // Default: assume it's base64
    return `data:image/png;base64,${qrCode}`
  }

  createErrorResponse(status: number, errorText: string, instanceId: string): QrResponse {
    // Enhanced error handling for WHAPI specific errors
    const isChannelNotReady = status === 503 || 
                               status === 400 ||
                               errorText.includes('Service Temporary Unavailable') ||
                               errorText.includes('temporarily unavailable') ||
                               errorText.includes('not ready') ||
                               errorText.includes('unauthorized')
    
    const isChannelNotFound = status === 404 ||
                              errorText.includes('not found') ||
                              errorText.includes('channel not found')
    
    if (isChannelNotFound) {
      return {
        success: false,
        error: 'Channel not found',
        requiresNewInstance: true,
        details: { status, error: errorText, instanceId }
      }
    }
    
    if (isChannelNotReady) {
      return {
        success: false,
        error: 'Channel not ready for QR generation yet',
        details: { status, error: errorText, instanceId },
        retryable: true
      }
    }
    
    return {
      success: false,
      error: 'Failed to get QR code from API',
      details: { status, error: errorText, instanceId },
      retryable: status >= 500 && status < 600 // 5xx errors are generally retryable
    }
  }

  createNetworkErrorResponse(error: Error): QrResponse {
    return {
      success: false,
      error: 'Network error connecting to API',
      details: error.message,
      retryable: true
    }
  }

  createMissingInstanceResponse(): QrResponse {
    return {
      success: false,
      error: 'WhatsApp instance not found',
      requiresNewInstance: true
    }
  }
}
