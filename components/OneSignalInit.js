'use client'
import { useEffect } from 'react'

export default function OneSignalInit() {
  useEffect(() => {
    const loadOneSignal = async () => {
      try {
        const OneSignal = (await import('react-onesignal')).default
        await OneSignal.init({
          appId: '69ae6789-9fde-4774-9065-a924da6a792b',
          allowLocalhostAsSecureOrigin: true,
          notifyButton: { enable: false },
          promptOptions: {
            slidedown: {
              prompts: [{
                type: 'push',
                autoPrompt: true,
                text: {
                  actionMessage: 'Get daily market updates & breaking financial news from Finance Digest',
                  acceptButton: 'Allow',
                  cancelButton: 'No thanks',
                }
              }]
            }
          }
        })
        console.log('OneSignal initialized')
      } catch (e) {
        console.error('OneSignal failed:', e)
      }
    }
    loadOneSignal()
  }, [])
  return null
}