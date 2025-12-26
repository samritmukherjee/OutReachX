'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useCampaign, type ChannelConfig } from '../CampaignContext'

interface Asset {
  url: string
  publicId: string
  type: 'image' | 'video'
}

interface LoadedCampaign {
  id: string
  title: string
  description: string
  channels: ChannelConfig
  toneOfVoice?: string
  assets?: Asset[]
  contactCount: number
  status: string
  csvStoragePath?: string
  aiDescription?: string
  previewText?: string
  transcript?: string
  contactsFile?: { url: string; publicId: string }
}

interface PreviewPageProps {
  campaignId?: string
  fromCreationFlow?: boolean
}

export default function PreviewPageImpl({ campaignId: propCampaignId, fromCreationFlow = true }: PreviewPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryParamId = searchParams.get('campaignId')
  const { campaign } = useCampaign()

  const campaignId = propCampaignId || queryParamId || campaign.campaignId

  const [isRegenerating, setIsRegenerating] = useState(false)
  const [loadedCampaign, setLoadedCampaign] = useState<LoadedCampaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [draft, setDraft] = useState({
    title: '',
    description: '',
    previewText: '',
    transcript: '',
    assets: [] as Asset[],
    contactsFile: null as any,
    contactCount: 0,
  })

  const [preview, setPreview] = useState<{ type: string; content: string; transcript?: string }>({
    type: 'text',
    content: '',
    transcript: '',
  })

  // Load campaign from database
  useEffect(() => {
    const loadCampaignFromDB = async () => {
      try {
        if (!campaignId) {
          setError('No campaign ID found')
          setLoading(false)
          return
        }

        const response = await fetch(`/api/campaigns/${campaignId}`)
        const data = await response.json()

        if (response.ok) {
          setLoadedCampaign(data.campaign)
          setDraft({
            title: data.campaign.title,
            description: data.campaign.description,
            previewText: data.campaign.previewText || '',
            transcript: data.campaign.transcript || '',
            assets: data.campaign.assets || [],
            contactsFile: data.campaign.contactsFile || null,
            contactCount: data.campaign.contactCount || 0,
          })
          const firstChannelName = Object.keys(data.campaign.channels)[0] || 'text'
          setPreview({
            type: firstChannelName,
            content: `${data.campaign.title}\n\n${data.campaign.description}`,
            transcript: `Hello! I'm reaching out about ${data.campaign.title}. ${data.campaign.description}`,
          })
        } else {
          setError(data.error || 'Failed to load campaign')
        }
      } catch (err) {
        console.error('Error loading campaign:', err)
        setError('Failed to load campaign from database')
      } finally {
        setLoading(false)
      }
    }

    loadCampaignFromDB()
  }, [campaignId])

  const generatePreview = async () => {
    setIsRegenerating(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const firstChannel = Object.keys(draft).find(k => k === 'text') || 'text'
    setPreview({
      type: firstChannel,
      content: `${draft.title}\n\n${draft.description}`,
      transcript: `Hello! I'm reaching out about ${draft.title}. ${draft.description}`,
    })
    setIsRegenerating(false)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      const response = await fetch(`/api/campaigns/${campaignId}/preview`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          previewText: draft.previewText,
          transcript: draft.transcript,
          assets: draft.assets,
          contactsFileAction: draft.contactsFile === null ? 'remove' : undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to save changes')
        return
      }

      if (loadedCampaign) {
        setLoadedCampaign({
          ...loadedCampaign,
          title: draft.title,
          description: draft.description,
          assets: draft.assets,
        })
      }

      setIsEditing(false)
    } catch (err) {
      console.error('Error saving campaign:', err)
      setError('Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleLaunch = () => {
    if (campaignId) {
      router.push('/yourcampaigns')
    } else {
      alert('Campaign ID not found')
    }
  }

  const removeAsset = (index: number) => {
    setDraft((prev) => ({
      ...prev,
      assets: prev.assets.filter((_, i) => i !== index),
    }))
  }

  const addAssets = (files: File[]) => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024
    const oversized = files.filter((f) => f.size > MAX_FILE_SIZE)
    if (oversized.length > 0) {
      setError(`${oversized.length} file(s) exceed 10MB limit`)
      return
    }
    // In a real app, you'd upload these first
    console.log('New files to upload:', files)
    setError('')
  }

  const handleContactsFileUpload = (files: File[]) => {
    if (files.length > 0) {
      // In a real app, you'd upload this file first
      const file = files[0]
      console.log('Contacts file uploaded:', file.name)
      // For now, just track that a file was selected
      setDraft((prev) => ({
        ...prev,
        contactsFile: { name: file.name, url: '', publicId: '' },
        contactCount: Math.max(prev.contactCount, 1), // Ensure at least 1 contact when file is added
      }))
      setError('')
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 flex flex-col h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <div className="text-4xl">⟳</div>
          <p className="text-white">Loading campaign from database...</p>
        </div>
      </div>
    )
  }

  if (error && !loadedCampaign) {
    return (
      <div className="space-y-6 flex flex-col h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => router.back()}
            className="px-6 py-2.5 rounded-lg bg-white hover:bg-white/95 text-black font-semibold"
          >
            Go Back
          </button>
        </div>
      </div>
    )
  }

  if (!loadedCampaign) {
    return (
      <div className="space-y-6 flex flex-col h-[60vh] items-center justify-center">
        <p className="text-white">No campaign data found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 flex flex-col h-[60vh]">
      <div>
        <h1 className="text-3xl text-white mb-2">Campaign preview</h1>
        <p className="text-slate-400">Review and manage your campaign</p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-4 space-y-6 pb-3">
        {/* Campaign info */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-3">
          <div>
            <p className="text-xs text-white/50">Title</p>
            {isEditing ? (
              <input
                type="text"
                value={draft.title}
                onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-white focus:border-white/50 outline-none transition"
              />
            ) : (
              <p className="text-white font-semibold text-lg">{loadedCampaign.title}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-white/50 mb-1">Description</p>
            {isEditing ? (
              <textarea
                value={draft.description}
                onChange={(e) => setDraft((prev) => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-white focus:border-white/50 outline-none transition resize-none h-20"
              />
            ) : (
              <div className="space-y-2">
                <p className="text-white/80 text-sm whitespace-pre-wrap">
                  {loadedCampaign.aiDescription || loadedCampaign.previewText || loadedCampaign.description || 'No description'}
                </p>
                {loadedCampaign.aiDescription && loadedCampaign.description && (
                  <details className="text-xs text-white/40">
                    <summary className="cursor-pointer hover:text-white/60 transition">Show original description</summary>
                    <p className="mt-2 whitespace-pre-wrap text-white/50 border-l border-white/10 pl-2">
                      {loadedCampaign.description}
                    </p>
                  </details>
                )}
              </div>
            )}
          </div>
          <div>
            <p className="text-xs text-white/50 mb-2">Channels & Limits</p>
            <div className="space-y-2">
              {loadedCampaign.channels.text?.enabled && (
                <div className="flex justify-between items-center px-3 py-2 bg-black/30 rounded-lg border border-white/10">
                  <span className="text-white/80">📝 Text</span>
                  <span className="text-xs text-white/60">{loadedCampaign.channels.text.wordLimit} words max</span>
                </div>
              )}
              {loadedCampaign.channels.voice?.enabled && (
                <div className="flex justify-between items-center px-3 py-2 bg-black/30 rounded-lg border border-white/10">
                  <span className="text-white/80">🎙️ Voice</span>
                  <span className="text-xs text-white/60">{loadedCampaign.channels.voice.maxDurationSeconds}s max</span>
                </div>
              )}
              {loadedCampaign.channels.calls?.enabled && (
                <div className="flex justify-between items-center px-3 py-2 bg-black/30 rounded-lg border border-white/10">
                  <span className="text-white/80">☎️ Calls</span>
                  <span className="text-xs text-white/60">{loadedCampaign.channels.calls.maxCallDurationSeconds}s max</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Preview Text / Transcript */}
        {draft.previewText && (
          <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-2">
            <p className="text-xs text-white/50">Preview Text</p>
            {isEditing ? (
              <textarea
                value={draft.previewText}
                onChange={(e) => setDraft((prev) => ({ ...prev, previewText: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-white focus:border-white/50 outline-none transition resize-none h-20"
              />
            ) : (
              <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{draft.previewText}</p>
            )}
          </div>
        )}

        {/* Transcript / Voice Recording */}
        {draft.transcript && (
          <div className="bg-black/40 border border-white/10 rounded-2xl p-4 space-y-2">
            <p className="text-xs text-white/50">Transcript / Voice Recording</p>
            {isEditing ? (
              <textarea
                value={draft.transcript}
                onChange={(e) => setDraft((prev) => ({ ...prev, transcript: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/20 text-white focus:border-white/50 outline-none transition resize-none h-20"
              />
            ) : (
              <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{draft.transcript}</p>
            )}
          </div>
        )}

        {/* Assets */}
        {draft.assets.length > 0 && (
          <div className="bg-black/40 border border-white/10 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">Attached assets ({draft.assets.length})</h3>
            <div className="grid grid-cols-3 gap-2">
              {draft.assets.map((asset, idx) => (
                <div key={idx} className="relative group rounded-lg overflow-hidden aspect-square bg-black/60">
                  {asset.type === 'image' ? (
                    <img src={asset.url} alt={`Asset ${idx}`} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>
                  )}
                  {isEditing && (
                    <button
                      onClick={() => removeAsset(idx)}
                      className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition bg-red-500 hover:bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-xs cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            {isEditing && (
              <label className="block mt-3 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white/80 text-sm hover:bg-white/20 transition cursor-pointer text-center">
                Add More Assets
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={(e) => e.target.files && addAssets(Array.from(e.target.files))}
                  className="hidden"
                />
              </label>
            )}
          </div>
        )}

        {isEditing && draft.assets.length === 0 && (
          <label className="block px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white/80 text-sm hover:bg-white/20 transition cursor-pointer text-center">
            Add Assets
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={(e) => e.target.files && addAssets(Array.from(e.target.files))}
              className="hidden"
            />
          </label>
        )}

        {/* Contacts File */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-4">
          <p className="text-xs text-white/50 mb-2">Contacts File</p>
          {draft.contactsFile ? (
            <div className="flex items-center justify-between px-3 py-2 bg-black/30 rounded-lg border border-white/10">
              <div>
                <span className="text-white/80 text-sm">📄 {draft.contactsFile.name || 'Contacts uploaded'}</span>
                <p className="text-xs text-white/50 mt-1">Total contacts: {draft.contactCount}</p>
              </div>
              {isEditing && (
                <button
                  onClick={() => setDraft((prev) => ({ ...prev, contactsFile: null, contactCount: 0 }))}
                  className="text-xs px-2 py-1 rounded bg-red-500/30 hover:bg-red-500/50 text-red-300 transition cursor-pointer"
                >
                  Remove
                </button>
              )}
            </div>
          ) : isEditing ? (
            <label className="block px-3 py-3 rounded-lg bg-white/10 border border-white/20 text-white/80 text-sm hover:bg-white/20 transition cursor-pointer text-center">
              📁 Add Contacts File
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={(e) => e.target.files && handleContactsFileUpload(Array.from(e.target.files))}
                className="hidden"
              />
            </label>
          ) : (
            <p className="text-white/40 text-sm">No contacts file</p>
          )}
        </div>

        {/* Contacts Warning */}
        {isEditing && draft.contactCount === 0 && (
          <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30 text-orange-400 text-sm">
            ⚠️ You must have at least 1 contact to save changes. Please add a contacts file.
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-4 mt-6 border-t border-white/10">
        <Link
          href={queryParamId ? '/yourcampaigns' : '/campaign/contacts'}
          className="px-6 py-2.5 rounded-lg bg-black/40 border border-white/20 hover:bg-black/50 text-white font-medium transition cursor-pointer"
        >
          Back
        </Link>
        <div className="flex gap-3">
          {!isEditing && (
            <>
              <button
                onClick={async () => {
                  setIsRegenerating(true)
                  try {
                    const res = await fetch(`/api/campaigns/${campaignId}/description`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        wordLimit: loadedCampaign.channels.text?.wordLimit || 200,
                        tone: loadedCampaign.toneOfVoice || 'professional and friendly',
                        emotion: 'trust and excitement',
                      }),
                    })
                    if (res.ok) {
                      const data = await res.json()
                      console.log('✅ AI description generated:', data.aiDescription)
                      // Reload campaign to show updated description
                      const campaignRes = await fetch(`/api/campaigns/${campaignId}`)
                      const campaignData = await campaignRes.json()
                      setLoadedCampaign(campaignData.campaign)
                      setDraft((prev) => ({
                        ...prev,
                        description: campaignData.campaign.aiDescription || campaignData.campaign.description,
                      }))
                      setError('')
                    } else {
                      setError('Failed to enhance description')
                    }
                  } catch (err) {
                    console.error('Error:', err)
                    setError('Failed to enhance description')
                  } finally {
                    setIsRegenerating(false)
                  }
                }}
                disabled={isRegenerating}
                className="px-6 py-2.5 rounded-lg bg-purple-600/30 border border-purple-500/30 hover:bg-purple-600/50 text-purple-200 font-medium transition disabled:opacity-50 cursor-pointer"
              >
                {isRegenerating ? '🤖 Enhancing...' : '🤖 Enhance with AI'}
              </button>
              <button
                onClick={generatePreview}
                disabled={isRegenerating}
                className="px-6 py-2.5 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 text-white font-medium transition disabled:opacity-50 cursor-pointer"
              >
                {isRegenerating ? '⟳ Regenerating...' : '⟳ Regenerate'}
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-2.5 rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 text-white font-medium transition cursor-pointer"
              >
                ✏️ Edit
              </button>
              <button
                onClick={handleLaunch}
                className="px-6 py-2.5 rounded-lg bg-white hover:bg-white/95 text-black font-semibold transition shadow-[0_4px_12px_rgba(255,255,255,0.2)] cursor-pointer flex items-center gap-2"
              >
                ✅ Launch Campaign
              </button>
            </>
          )}
          {isEditing && (
            <>
              <button
                onClick={() => {
                  setDraft({
                    title: loadedCampaign.title,
                    description: loadedCampaign.description,
                    previewText: loadedCampaign.previewText || '',
                    transcript: loadedCampaign.transcript || '',
                    assets: loadedCampaign.assets || [],
                    contactsFile: loadedCampaign.contactsFile || null,
                    contactCount: loadedCampaign.contactCount || 0,
                  })
                  setIsEditing(false)
                }}
                className="px-6 py-2.5 rounded-lg bg-black/40 border border-white/20 hover:bg-black/50 text-white font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || draft.contactCount === 0}
                className="px-6 py-2.5 rounded-lg bg-white hover:bg-white/95 text-black font-semibold transition shadow-[0_4px_12px_rgba(255,255,255,0.2)] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? '💾 Saving...' : '✅ Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
