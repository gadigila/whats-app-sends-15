
import type { QrResponse } from './types.ts'

export class QrProcessor {
  processQrResponse(qrData: any): QrResponse {
    console.log('✅ QR data received:', Object.keys(qrData))
    
    // Handle different possible response formats from Manager/Gate API
    let qrCodeUrl = null
    if (qrData.qr_code) {
      qrCodeUrl = qrData.qr_code.startsWith('data:') ? qrData.qr_code : `data:image/png;base64,${qrData.qr_code}`
    } else if (qrData.qr) {
      qrCodeUrl = qrData.qr.startsWith('data:') ? qrData.qr : `data:image/png;base64,${qrData.qr}`
    } else if (qrData.image) {
      qrCodeUrl = qrData.image.startsWith('data:') ? qrData.image : `data:image/png;base64,${qrData.image}`
    } else if (qrData.data && qrData.data.qr_code) {
      qrCodeUrl = qrData.data.qr_code.startsWith('data:') ? qrData.data.qr_code : `data:image/png;base64,${qrData.data.qr_code}`
    } else if (typeof qrData === 'string') {
      // Sometimes the response might be a direct base64 string
      qrCodeUrl = qrData.startsWith('data:') ? qrData : `data:image/png;base64,${qrData}`
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

  createErrorResponse(status: number, errorText: string, instanceId: string): QrResponse {
    return {
      success: false,
      error: 'Failed to get QR code from API',
      details: { status, error: errorText, instanceId }
    }
  }

  createNetworkErrorResponse(error: Error): QrResponse {
    return {
      success: false,
      error: 'Network error connecting to API',
      details: error.message
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
