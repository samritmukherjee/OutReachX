'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useCampaign } from '../CampaignContext'

interface Contact {
  name: string
  phone: string
}

interface ContactsSummary {
  count: number
  items: Contact[]
}

export default function ContactsPage() {
  const router = useRouter()
  const { campaign, updateCampaign } = useCampaign()
  const [contacts, setContacts] = useState<Contact[]>(campaign.contacts)
  const [dragActive, setDragActive] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [contactsFile, setContactsFile] = useState<File | null>(null)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [contactsSummary, setContactsSummary] = useState<ContactsSummary | null>(null)
  const [showContacts, setShowContacts] = useState(false)
  const [loadingContactsSummary, setLoadingContactsSummary] = useState(false)

  const parseCSV = (text: string): Contact[] => {
    const lines = text.trim().split('\n')
    const result: Contact[] = []

    lines.forEach((line, idx) => {
      if (idx === 0) return // Skip header
      const [name, phone] = line.split(',').map((s) => s.trim())
      if (name && phone) {
        result.push({ name, phone })
      }
    })

    return result
  }

  const parseExcel = (arrayBuffer: ArrayBuffer): Contact[] => {
    // Simple Excel parsing - looking for Name and Phone columns
    const result: Contact[] = []
    try {
      // For now, we'll treat Excel similar to CSV by converting to string
      const view = new Uint8Array(arrayBuffer)
      const text = String.fromCharCode.apply(null, Array.from(view))
      return parseCSV(text)
    } catch {
      return []
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(e.type === 'dragenter' || e.type === 'dragover')
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = Array.from(e.dataTransfer.files).filter((file) =>
      file.type === 'text/csv' || file.name.endsWith('.csv') || file.name.endsWith('.xlsx')
    )

    if (files.length === 0) {
      setError('Please drop a CSV or Excel file')
      return
    }

    const file = files[0]
    setContactsFile(file)
    setContactsSummary(null)
    setError('')
    setIsExtracting(true)

    try {
      let cid = campaignId

      // Create campaign if it doesn't exist yet
      if (!cid) {
        console.log('📝 Creating campaign first...')
        const createRes = await fetch('/api/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: campaign.title,
            description: campaign.description,
            channels: campaign.channels,
            toneOfVoice: campaign.toneOfVoice,
          }),
        })

        if (!createRes.ok) {
          throw new Error('Failed to create campaign')
        }

        const { id: newCampaignId } = await createRes.json()
        cid = newCampaignId
        setCampaignId(newCampaignId)
        updateCampaign({ campaignId: newCampaignId })
        console.log('✅ Campaign created:', newCampaignId)
      }

      // 1) Upload file via /files route
      console.log('📤 Uploading contacts file:', file.name)
      const formData = new FormData()
      formData.append('contactsFile', file)

      const uploadRes = await fetch(`/api/campaigns/${cid}/files`, {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) {
        throw new Error('Failed to upload contacts file')
      }

      console.log('✅ File uploaded')

      // 2) Trigger extraction
      console.log('📞 Extracting contacts...')
      const extractRes = await fetch(`/api/campaigns/${cid}/contacts`, {
        method: 'POST',
      })

      if (!extractRes.ok) {
        throw new Error('Failed to extract contacts')
      }

      console.log('✅ Contacts extracted')

      // 3) Fetch updated campaign to get contactsSummary
      console.log('🔄 Fetching updated campaign...')
      const campaignRes = await fetch(`/api/campaigns/${cid}`)
      if (campaignRes.ok) {
        const campaignData = await campaignRes.json()
        setContactsSummary(campaignData.campaign.contactsSummary || null)
        console.log('✅ Summary loaded:', campaignData.campaign.contactsSummary?.count, 'contacts')
      }
    } catch (err) {
      console.error('Error extracting contacts:', err)
      setError(err instanceof Error ? err.message : 'Failed to process contacts file')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setContactsFile(file)
    setContactsSummary(null)
    setError('')
    setIsExtracting(true)

    try {
      let cid = campaignId

      // Create campaign if it doesn't exist yet
      if (!cid) {
        console.log('📝 Creating campaign first...')
        const createRes = await fetch('/api/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: campaign.title,
            description: campaign.description,
            channels: campaign.channels,
            toneOfVoice: campaign.toneOfVoice,
          }),
        })

        if (!createRes.ok) {
          throw new Error('Failed to create campaign')
        }

        const { id: newCampaignId } = await createRes.json()
        cid = newCampaignId
        setCampaignId(newCampaignId)
        updateCampaign({ campaignId: newCampaignId })
        console.log('✅ Campaign created:', newCampaignId)
      }

      // 1) Upload file via /files route
      console.log('📤 Uploading contacts file:', file.name)
      const formData = new FormData()
      formData.append('contactsFile', file)

      const uploadRes = await fetch(`/api/campaigns/${cid}/files`, {
        method: 'POST',
        body: formData,
      })

      if (!uploadRes.ok) {
        throw new Error('Failed to upload contacts file')
      }

      console.log('✅ File uploaded')

      // 2) Trigger extraction
      console.log('📞 Extracting contacts...')
      const extractRes = await fetch(`/api/campaigns/${cid}/contacts`, {
        method: 'POST',
      })

      if (!extractRes.ok) {
        throw new Error('Failed to extract contacts')
      }

      console.log('✅ Contacts extracted')

      // 3) Fetch updated campaign to get contactsSummary
      console.log('🔄 Fetching updated campaign...')
      const campaignRes = await fetch(`/api/campaigns/${cid}`)
      if (campaignRes.ok) {
        const campaignData = await campaignRes.json()
        setContactsSummary(campaignData.campaign.contactsSummary || null)
        console.log('✅ Summary loaded:', campaignData.campaign.contactsSummary?.count, 'contacts')
      }
    } catch (err) {
      console.error('Error extracting contacts:', err)
      setError(err instanceof Error ? err.message : 'Failed to process contacts file')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleContinue = async () => {
    if (!campaignId) {
      setError('Campaign ID not found')
      return
    }

    if (!contactsSummary || contactsSummary.count === 0) {
      setError('Please upload and extract contacts first')
      return
    }

    // Just navigate to preview - extraction already happened
    router.push(`/campaign/preview?campaignId=${campaignId}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl  text-white mb-2">Upload contacts</h1>
        <p className="text-slate-400">Import a CSV file with Name and Phone columns</p>
      </div>

      {/* Drag and drop area */}
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-3xl p-8 text-center transition ${
          dragActive
            ? 'border-white/60 bg-white/10'
            : 'border-white/20 bg-black/30 hover:border-white/30'
        }`}
      >
        <div className="space-y-3">
          <div className="text-4xl">📊</div>
          <div>
            <p className="text-white">Drag CSV or Excel file here or</p>
            <label className="text-white/80 cursor-pointer hover:text-white">
              click to browse
              <input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileInput}
                className="hidden"
              />
            </label>
          </div>
          <p className="text-xs text-white/50">CSV or Excel format: Name, Phone</p>
        </div>
      </div>

      {/* Show filename when selected */}
      {contactsFile && (
        <div className="px-4 py-2.5 rounded-lg bg-blue-900/40 border border-blue-500/40 text-blue-200 text-sm">
          ✓ Selected: <span className="font-medium">{contactsFile.name}</span>
        </div>
      )}

      {/* Contacts summary */}
      <div className="space-y-3">
        {contactsSummary && contactsSummary.count > 0 ? (
          <>
            <button
              onClick={() => setShowContacts((v) => !v)}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-slate-800/60 hover:bg-slate-700/60 text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              {showContacts
                ? `Hide contacts (${contactsSummary.count} detected)`
                : `Show contacts (${contactsSummary.count} detected)`}
            </button>

            {showContacts && (
              <div className="border border-slate-700 rounded-lg p-3 bg-black/40 max-h-64 overflow-y-auto">
                <ul className="space-y-2">
                  {contactsSummary.items.map((c, idx) => (
                    <li
                      key={`${c.name}-${c.phone}-${idx}`}
                      className="flex justify-between gap-3 px-2 py-1.5 text-xs bg-black/30 rounded hover:bg-black/50 transition"
                    >
                      <span className="text-white/80">{c.name}</span>
                      <span className="text-white/50 font-mono">{c.phone}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : isExtracting ? (
          <div className="px-4 py-2.5 rounded-lg text-sm text-slate-400 bg-black/40 border border-slate-700">
            <span className="inline-block animate-spin mr-2">⟳</span>
            Extracting contacts from file...
          </div>
        ) : loadingContactsSummary ? (
          <div className="px-4 py-2.5 rounded-lg text-sm text-slate-400 bg-black/40 border border-slate-700">
            <span className="inline-block animate-spin mr-2">⟳</span>
            Loading contacts...
          </div>
        ) : (
          <div className="px-4 py-2.5 rounded-lg text-sm text-slate-500 bg-black/40 border border-slate-700">
            Attach a CSV or Excel file to detect contacts
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex justify-between gap-3 pt-4">
        <button
          onClick={() => router.push('/campaign/assets')}
          className="px-6 py-2.5 rounded-lg bg-black/40 border border-white/20 hover:bg-black/50 text-white font-medium transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isExtracting}
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          className="px-6 py-2.5 rounded-lg bg-white hover:bg-white/95 text-black font-semibold transition shadow-[0_4px_12px_rgba(255,255,255,0.2)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isExtracting || !contactsSummary || contactsSummary.count === 0}
        >
          {isExtracting ? '⟳ Extracting contacts...' : 'Continue to preview'}
        </button>
      </div>
    </div>
  )
}
