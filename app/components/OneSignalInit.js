'use client'
import { useEffect } from 'react'

export default function OneSignalInit() {
  useEffect(() => {
    // Load OneSignal CDN script directly
    const script = document.createElement('script')
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
    script.defer = true
    script.onload = () => {
      window.OneSignalDeferred = window.OneSignalDeferred || []
      window.OneSignalDeferred.push(async function(OneSignal) {
        try {
          await OneSignal.init({
            appId: '69ae6789-9fde-4774-9065-a924da6a792b',
            notifyButton: { enable: true },
            promptOptions: {
              slidedown: {
                prompts: [{
                  type: 'push',
                  autoPrompt: true,
                  text: {
                    actionMessage: 'Get daily market updates from Finance Digest',
                    acceptButton: 'Allow',
                    cancelButton: 'No thanks',
                  }
                }]
              }
            }
          })
          console.log('OneSignal loaded!')
        } catch(e) {
          console.error('OneSignal init error:', e)
        }
      })
    }
    document.head.appendChild(script)
  }, [])
  return null
}
