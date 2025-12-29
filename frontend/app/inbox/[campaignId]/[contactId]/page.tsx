'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { useRouter, useParams } from 'next/navigation'
import { useCampaignContext } from '../../CampaignContext'

interface Message {
  id: string
  sender: 'user' | 'ai'
  type: 'text' | 'audio'
  content: string
  timestamp: string
  audioUrl?: string
  assets?: any[]
}

interface Contact {
  id: string
  name: string
  phone: string
  lastMessage: string
  timestamp: string
  unread: boolean
  profilePic?: string
}

interface CampaignDetails {
  title: string
  previewText?: string
  audioUrls?: { voice?: string }
  assets?: any[]
}

const WhatsAppInbox = () => {
  const { isSignedIn } = useAuth()
  const router = useRouter()
  const params = useParams()
  const campaignId = params.campaignId as string
  const contactId = params.contactId as string

  // Use shared campaign context
  const { campaignDetails, contacts, fetchCampaignData } = useCampaignContext()

  // States
  const [selectedContactId, setSelectedContactId] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [messages, setMessages] = useState<Record<string, Message[]>>({})
  const [inputValue, setInputValue] = useState('')

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  // Memoized derived values
  const selectedContact = useMemo(
    () => contacts.find((c: Contact) => c.id === selectedContactId),
    [contacts, selectedContactId]
  )

  const selectedMessages = useMemo(
    () => messages[selectedContactId] || [],
    [messages, selectedContactId]
  )

  const filteredContacts = useMemo(
    () => contacts.filter((contact: Contact) =>
      contact.name.toLowerCase().includes(searchTerm.toLowerCase())
    ),
    [contacts, searchTerm]
  )

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [selectedMessages, scrollToBottom])

  // Fetch campaign data on mount
  useEffect(() => {
    if (!isSignedIn || !campaignId) return
    fetchCampaignData(campaignId)
  }, [campaignId, isSignedIn, fetchCampaignData])

  // Handle contact selection from URL or default to first
  useEffect(() => {
    if (!contacts.length) return

    const contactToSelect = contactId || contacts[0]?.id
    if (contactToSelect && contactToSelect !== selectedContactId) {
      setSelectedContactId(contactToSelect)
    }
  }, [contactId, contacts, selectedContactId])

  // Load messages from Firestore
  useEffect(() => {
    if (!selectedContactId || !campaignId) return

    const loadMessages = async () => {
      try {
        const response = await fetch(
          `/api/inbox/${campaignId}/${selectedContactId}/messages`
        )
        if (!response.ok) throw new Error('Failed to fetch messages')

        const data = await response.json()
        const firestoreMessages = data.messages.map((msg: any) => ({
          id: msg.id,
          sender: msg.sender === 'campaign' ? 'ai' : msg.sender,
          type: msg.type,
          content: msg.content || (msg.type === 'audio' ? '🎙️ Voice message' : ''),
          timestamp: msg.timestamp
            ? new Date(msg.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
              })
            : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          audioUrl: msg.audioUrl,
          assets: msg.assets,
        }))

        setMessages(prev => ({
          ...prev,
          [selectedContactId]: firestoreMessages
        }))
      } catch (error) {
        console.error('Error loading messages:', error)
        setMessages(prev => ({
          ...prev,
          [selectedContactId]: []
        }))
      }
    }

    loadMessages()
  }, [selectedContactId, campaignId])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [selectedMessages, scrollToBottom])


  // Send message to Firestore
  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || !selectedContactId || !campaignId) return

    const messageContent = inputValue
    setInputValue('')

    try {
      const response = await fetch(
        `/api/inbox/${campaignId}/${selectedContactId}/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageContent })
        }
      )

      if (!response.ok) throw new Error('Failed to send message')

      // Reload messages after a short delay to ensure Firestore write completes
      setTimeout(async () => {
        try {
          const messagesResponse = await fetch(
            `/api/inbox/${campaignId}/${selectedContactId}/messages`
          )
          if (!messagesResponse.ok) throw new Error('Failed to fetch messages')

          const data = await messagesResponse.json()
          const firestoreMessages = data.messages.map((msg: any) => ({
            id: msg.id,
            sender: msg.sender === 'campaign' ? 'ai' : msg.sender,
            type: msg.type,
            content: msg.content || (msg.type === 'audio' ? '🎙️ Voice message' : ''),
            timestamp: msg.timestamp
              ? new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            audioUrl: msg.audioUrl,
            assets: msg.assets,
          }))

          setMessages(prev => ({
            ...prev,
            [selectedContactId]: firestoreMessages
          }))
          
          // Scroll to bottom after messages reload
          setTimeout(() => scrollToBottom(), 0)
        } catch (error) {
          console.error('Error reloading messages:', error)
        }
      }, 1500)
    } catch (error) {
      console.error('Error sending message:', error)
      setInputValue(messageContent) // Restore input on error
    }
  }, [inputValue, selectedContactId, campaignId])

  // Delete message
  const handleDeleteMessage = useCallback((messageId: string) => {
    setMessages(prev => ({
      ...prev,
      [selectedContactId]: prev[selectedContactId]?.filter(m => m.id !== messageId) || []
    }))
  }, [selectedContactId])

  if (!isSignedIn) return null

  return (
    <div className='h-screen bg-[#f0f2f5] flex flex-col overflow-hidden'>
      {/* Top Bar */}
      <div className='bg-[#00a884] p-4 flex items-center gap-4 shrink-0'>
        <button
          onClick={() => router.push('/inbox')}
          className='p-2 rounded-full hover:bg-[#00917a] text-white transition-colors'
        >
          <svg className='w-6 h-6' fill='currentColor' viewBox='0 0 20 20'>
            <path fillRule='evenodd' d='M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z' />
          </svg>
        </button>
        <div className='flex-1'>
          <h1 className='text-lg font-medium text-white'>{campaignDetails?.title || campaignId}</h1>
          <p className='text-xs text-white/90'>{contacts.length} contacts</p>
        </div>
      </div>

      {/* Main Layout */}
      <div className='flex flex-1 overflow-hidden'>
        {/* Left Panel - Contacts */}
        <div className='w-[400px] bg-white border-r border-gray-200 flex flex-col'>
          {/* Search */}
          <div className='p-2 bg-white shrink-0'>
            <div className='relative'>
              <svg className='w-5 h-5 absolute left-4 top-1/2 transform -translate-y-1/2 text-[#54656f]' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
              </svg>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder='Search or start new chat'
                className='w-full pl-12 pr-4 py-2 bg-[#f0f2f5] rounded-lg text-[#111b21] text-sm placeholder-[#54656f] focus:outline-none'
              />
            </div>
          </div>

          {/* Contacts List */}
          <div className='flex-1 overflow-y-auto'>
            {filteredContacts.map((contact: Contact) => (
              <button
                key={contact.id}
                onClick={() => {
                  setSelectedContactId(contact.id)
                  router.push(`/inbox/${campaignId}/${contact.id}`)
                }}
                className={`w-full p-3 hover:bg-[#f5f6f6] transition-colors flex items-center gap-3 border-b border-[#e9edef] ${selectedContactId === contact.id ? 'bg-[#f0f2f5]' : ''
                  }`}
              >
                <div className='relative shrink-0'>
                  <img
                    src={contact.profilePic || 'https://i.pravatar.cc/50?u=' + contact.id}
                    alt={contact.name}
                    className='w-12 h-12 rounded-full'
                  />
                  {contact.unread && (
                    <div className='absolute -top-1 -right-1 w-5 h-5 bg-[#25d366] rounded-full text-xs flex items-center justify-center font-medium text-white'>
                      1
                    </div>
                  )}
                </div>
                <div className='flex-1 min-w-0 text-left'>
                  <div className='flex items-baseline justify-between mb-1'>
                    <p className='font-medium text-[#111b21] truncate text-[15px]'>{contact.name}</p>
                    <p className='text-xs text-[#667781] ml-2 shrink-0'>{contact.timestamp}</p>
                  </div>
                  <p className='text-sm text-[#667781] truncate'>{contact.lastMessage}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Panel - Chat */}
        <div className='flex-1 flex flex-col'>
          {/* Chat Header */}
          {selectedContact && (
            <div className='bg-[#f0f2f5] border-b border-[#d1d7db] p-3 flex items-center gap-3 shrink-0'>
              <img
                src={selectedContact.profilePic || 'https://i.pravatar.cc/40'}
                alt={selectedContact.name}
                className='w-10 h-10 rounded-full'
              />
              <div className='flex-1 min-w-0'>
                <h3 className='font-medium text-[#111b21] truncate'>{selectedContact.name}</h3>
                <p className='text-xs text-[#667781] truncate'>{selectedContact.phone}</p>
              </div>
              <div className='flex gap-2'>
                <button className='p-2 hover:bg-[#f0f2f5] rounded-full text-[#54656f]'>
                  <svg className='w-6 h-6' fill='currentColor' viewBox='0 0 24 24'>
                    <path d='M15.009 13.805h-.636l-.22-.219a5.184 5.184 0 0 0 1.256-3.386 5.207 5.207 0 1 0-5.207 5.208 5.183 5.183 0 0 0 3.385-1.255l.221.22v.635l4.004 3.999 1.194-1.195-3.997-4.007zm-4.808 0a3.605 3.605 0 1 1 0-7.21 3.605 3.605 0 0 1 0 7.21z' />
                  </svg>
                </button>
                <button className='p-2 hover:bg-[#f0f2f5] rounded-full text-[#54656f]'>
                  <svg className='w-6 h-6' fill='currentColor' viewBox='0 0 24 24'>
                    <path d='M12 7a2 2 0 1 0-.001-4.001A2 2 0 0 0 12 7zm0 2a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 9zm0 6a2 2 0 1 0-.001 3.999A2 2 0 0 0 12 15z' />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {/* Messages Area */}
          <div
            ref={messagesContainerRef}
            className='flex-1 overflow-y-auto p-4 bg-[#efeae2]'
            style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M100 0L200 100L100 200L0 100Z' fill='%23d9d9d9' fill-opacity='0.05'/%3E%3C/svg%3E\")" }}
          >
            <div className='max-w-4xl mx-auto space-y-2'>
              {selectedMessages.length === 0 ? (
                <div className='text-center text-[#667781] py-20'>
                  <div className='mb-4'>
                    <svg className='w-20 h-20 mx-auto text-[#8696a0]' fill='currentColor' viewBox='0 0 212 212'>
                      <path d='M106.251.5C164.653.5 212 47.846 212 106.25S164.653 212 106.25 212C81.446 212 58.095 203.352 39.617 188.613L.5 211.5l23.717-37.933C8.128 154.886.5 131.656.5 106.25.5 47.846 47.847.5 106.251.5z' fill='none' stroke='currentColor' strokeWidth='1' />
                    </svg>
                  </div>
                  <p className='text-[#667781] text-lg mb-2'>Start a conversation</p>
                  <p className='text-[#8696a0] text-sm'>Click a contact to begin chatting</p>
                </div>
              ) : (
                selectedMessages.map((message) => {
                  const isRight = message.sender === 'ai'
                  return (
                    <div key={message.id} className={`flex ${isRight ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-md px-3 py-2 rounded-lg shadow-sm relative ${isRight
                          ? 'bg-[#d9fdd3] text-[#111b21] rounded-br-none'
                          : 'bg-white text-[#111b21] rounded-bl-none'
                        }`}>
                        <p className='text-[14.2px] leading-[19px] whitespace-pre-wrap break-words'>{message.content}</p>

                        {/* Assets */}
                        {Array.isArray(message.assets) && message.assets.length > 0 && (
                          <div className='mt-2 grid grid-cols-2 gap-1'>
                            {message.assets.slice(0, 4).map((asset: any, i: number) => (
                              asset.type === 'image' && (
                                <img
                                  key={i}
                                  src={asset.url}
                                  alt={`Asset ${i + 1}`}
                                  className='w-full h-32 object-cover rounded'
                                />
                              )
                            ))}
                          </div>
                        )}

                        {/* Voice Message */}
                        {message.audioUrl && (
                          <div className='mt-2'>
                            <audio controls className='w-full max-w-xs h-10'>
                              <source src={message.audioUrl} type='audio/mpeg' />
                            </audio>
                          </div>
                        )}

                        <div className='flex items-center justify-end gap-1 mt-1'>
                          <span className='text-[11px] text-[#667781]'>{message.timestamp}</span>
                          {isRight && (
                            <svg className='w-4 h-4 text-[#53bdeb]' viewBox='0 0 16 15'>
                              <path fill='currentColor' d='m15.01 3.316-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z' />
                            </svg>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className='bg-[#f0f2f5] p-2 shrink-0'>
            <div className='flex items-center gap-2'>
              <button className='p-2 hover:bg-[#d1d7db] rounded-full text-[#54656f] transition-colors'>
                <svg className='w-6 h-6' fill='currentColor' viewBox='0 0 24 24'>
                  <path d='M9.153 11.603c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962zm-3.204 1.362c-.026-.307-.131 5.218 6.063 5.551 6.066-.25 6.066-5.551 6.066-5.551-6.078 1.416-12.129 0-12.129 0zm11.363 1.108s-.669 1.959-5.051 1.959c-3.505 0-5.388-1.164-5.607-1.959 0 0 5.912 1.055 10.658 0zM11.804 1.011C5.609 1.011.978 6.033.978 12.228s4.826 10.761 11.021 10.761S23.02 18.423 23.02 12.228c.001-6.195-5.021-11.217-11.216-11.217zM12 21.354c-5.273 0-9.381-3.886-9.381-9.159s3.942-9.548 9.215-9.548 9.548 4.275 9.548 9.548c-.001 5.272-4.109 9.159-9.382 9.159zm3.108-9.751c.795 0 1.439-.879 1.439-1.962s-.644-1.962-1.439-1.962-1.439.879-1.439 1.962.644 1.962 1.439 1.962z' />
                </svg>
              </button>
              <button className='p-2 hover:bg-[#d1d7db] rounded-full text-[#54656f] transition-colors'>
                <svg className='w-6 h-6' fill='currentColor' viewBox='0 0 24 24'>
                  <path d='M1.816 15.556v.002c0 1.502.584 2.912 1.646 3.972s2.472 1.647 3.974 1.647a5.58 5.58 0 0 0 3.972-1.645l9.547-9.548c.769-.768 1.147-1.767 1.058-2.817-.079-.968-.548-1.927-1.319-2.698-1.594-1.592-4.068-1.711-5.517-.262l-7.916 7.915c-.881.881-.792 2.25.214 3.261.959.958 2.423 1.053 3.263.215l5.511-5.512c.28-.28.267-.722.053-.936l-.244-.244c-.191-.191-.567-.349-.957.04l-5.506 5.506c-.18.18-.635.127-.976-.214-.098-.097-.576-.613-.213-.973l7.915-7.917c.818-.817 2.267-.699 3.23.262.5.501.802 1.1.849 1.685.051.573-.156 1.111-.589 1.543l-9.547 9.549a3.97 3.97 0 0 1-2.829 1.171 3.975 3.975 0 0 1-2.83-1.173 3.973 3.973 0 0 1-1.172-2.828c0-1.071.415-2.076 1.172-2.83l7.209-7.211c.157-.157.264-.579.028-.814L11.5 4.36a.572.572 0 0 0-.834.018l-7.205 7.207a5.577 5.577 0 0 0-1.645 3.971z' />
                </svg>
              </button>
              <input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder='Type a message'
                className='flex-1 py-2 px-4 bg-white rounded-lg text-[#111b21] text-[15px] placeholder-[#667781] focus:outline-none'
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputValue.trim() || !selectedContactId}
                className='p-2 hover:bg-[#d1d7db] rounded-full text-[#54656f] transition-colors disabled:opacity-50'
              >
                <svg className='w-6 h-6' fill='currentColor' viewBox='0 0 24 24'>
                  <path d='M1.101 21.757L23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z' />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default WhatsAppInbox
