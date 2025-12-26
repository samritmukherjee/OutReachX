'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { ChannelConfig } from '@/campaign/CampaignContext'

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

export default function CampaignDetailPage() {
  const router = useRouter()
  const params = useParams()
  const campaignId = params.campaignId as string

  const [loadedCampaign, setLoadedCampaign] = useState<LoadedCampaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  const [draft, setDraft] = useState({
    title: '',
    description: '',
    previewText: '',
    assets: [] as Asset[],
    contactsFile: null as any,
  })

  useEffect(() => {
    const loadCampaign = async () => {
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
          console.log('📊 Campaign loaded:', {
            description: data.campaign.description?.substring?.(0, 50),
            aiDescription: data.campaign.aiDescription?.substring?.(0, 50),
            previewText: data.campaign.previewText?.substring?.(0, 50),
          })
          setDraft({
            title: data.campaign.title,
            description: data.campaign.description,
            previewText: data.campaign.previewText || '',
            assets: data.campaign.assets || [],
            contactsFile: data.campaign.contactsFile || null,
          })
        } else {
          setError(data.error || 'Failed to load campaign')
        }
      } catch (err) {
        console.error('Error loading campaign:', err)
        setError('Failed to load campaign')
      } finally {
        setLoading(false)
      }
    }

    loadCampaign()
  }, [campaignId])

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
          assets: draft.assets,
          contactsFileAction: draft.contactsFile === null ? 'remove' : undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || 'Failed to save changes')
        return
      }

      // Update loaded campaign with draft values
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
    // For now, just show that new files would be added
    console.log('New files to upload:', files)
    setError('')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
       
        <div className="max-w-6xl mx-auto px-4 py-12 flex items-center justify-center h-[60vh]">
          <div className="text-center space-y-3">
            
            <p className="text-white">Loading campaign...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error && !loadedCampaign) {
    return (
      <div className="min-h-screen bg-black">
       
        <div className="max-w-6xl mx-auto px-4 py-12 flex items-center justify-center h-[60vh]">
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
      </div>
    )
  }

  if (!loadedCampaign) {
    return (
      <div className="min-h-screen bg-black">
      
        <div className="max-w-6xl mx-auto px-4 py-12 flex items-center justify-center h-[60vh]">
          <p className="text-white">No campaign data found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black">
     
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link
            href="/yourcampaigns"
            className="text-white/60 hover:text-white transition flex items-center gap-2"
          >
            ← Back to Campaigns
          </Link>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Campaign Info */}
        <div className="bg-black/40 border border-white/10 rounded-2xl p-8 space-y-6">
          {/* Title */}
          <div>
            <p className="text-xs text-white/50 mb-2">Title</p>
            <h1 className="text-4xl font-bold text-white">{loadedCampaign.title}</h1>
          </div>

          {/* Original Description */}
          <div>
            <p className="text-xs text-white/50 mb-2">Original Description</p>
            <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
              {loadedCampaign.description || 'No description provided'}
            </p>
          </div>

          {/* AI Description */}
          {loadedCampaign.aiDescription && (
            <div>
              <p className="text-xs text-white/50 mb-2">AI-Enhanced Description</p>
              <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
                {loadedCampaign.aiDescription}
              </p>
            </div>
          )}

          {/* Channel Details */}
          <div>
            <p className="text-xs text-white/50 mb-3">Channels & Limits</p>
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

          {/* Preview Text */}
          {/* {loadedCampaign.previewText && (
            <div>
              <p className="text-xs text-white/50 mb-2">Preview Text</p>
              <p className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">{loadedCampaign.previewText}</p>
            </div>
          )} */}

          {/* Assets */}
          <div>
            <p className="text-xs text-white/50 mb-3">Assets ({loadedCampaign.assets?.length || 0})</p>
            {loadedCampaign.assets && loadedCampaign.assets.length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {loadedCampaign.assets.map((asset, idx) => (
                  <div key={idx} className="rounded-lg overflow-hidden aspect-square bg-black/60 border border-white/10">
                    {asset.type === 'image' ? (
                      <img src={asset.url} alt={`Asset ${idx}`} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-2xl">🎬</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/40 text-sm">No assets</p>
            )}
          </div>

          {/* Contacts File */}
          {loadedCampaign.contactsFile && (
            <div>
              <p className="text-xs text-white/50 mb-2">Contacts File</p>
              <div className="px-4 py-3 rounded-lg bg-black/30 border border-white/10 flex items-center justify-between">
                <span className="text-white/80 text-sm">📄 Contacts uploaded</span>
                <span className="text-xs text-white/60">({loadedCampaign.contactCount} contacts)</span>
              </div>
            </div>
          )}

          {/* Back Button */}
          <div className="flex items-center justify-start gap-3 pt-6 border-t border-white/10">
            <Link
              href="/yourcampaigns"
              className="px-6 py-2.5 rounded-lg bg-black/40 border border-white/20 hover:bg-black/50 text-white font-medium transition cursor-pointer"
            >
              Back
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
