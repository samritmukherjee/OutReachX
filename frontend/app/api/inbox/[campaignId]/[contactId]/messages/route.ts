import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/firebase/admin";

async function generateCampaignMessages(userId: string, campaignId: string) {
  try {
    const campaignDoc = await db
      .collection("users")
      .doc(userId)
      .collection("campaigns")
      .doc(campaignId)
      .get();

    if (!campaignDoc.exists) {
      return [];
    }

    const campaignData = campaignDoc.data() as any;
    const messages = [];
    let messageIndex = 0;

    // Generate campaign title message (first)
    if (campaignData.title) {
      messages.push({
        id: `msg_${messageIndex}_title`,
        sender: "campaign",
        type: "text",
        content: campaignData.title,
        timestamp: new Date(Date.now() - 10000).toISOString(),
        audioUrl: undefined,
        assets: undefined,
      });
      messageIndex++;
    }

    // Generate preview message (second)
    if (campaignData.previewText || campaignData.description) {
      const descText = typeof campaignData.description === "string" 
        ? campaignData.description 
        : campaignData.description?.aiEnhanced || campaignData.description?.original || "";
      
      messages.push({
        id: `msg_${messageIndex}_preview`,
        sender: "campaign",
        type: "text",
        content: campaignData.previewText || descText || "",
        timestamp: new Date(Date.now() - 7500).toISOString(),
        audioUrl: undefined,
        assets: undefined,
      });
      messageIndex++;
    }

    // Generate audio message (third)
    if (campaignData.audioUrls?.voice) {
      messages.push({
        id: `msg_${messageIndex}_audio`,
        sender: "campaign",
        type: "audio",
        content: "🎙️ Voice message",
        timestamp: new Date(Date.now() - 5000).toISOString(),
        audioUrl: campaignData.audioUrls.voice,
        assets: undefined,
      });
      messageIndex++;
    }

    // Generate assets message (fourth)
    if (campaignData.assets?.length > 0) {
      messages.push({
        id: `msg_${messageIndex}_assets`,
        sender: "campaign",
        type: "text",
        content: `📎 ${campaignData.assets.length} file(s)`,
        timestamp: new Date(Date.now() - 2500).toISOString(),
        audioUrl: undefined,
        assets: campaignData.assets,
      });
      messageIndex++;
    }

    console.log(`📝 Generated ${messages.length} campaign messages in order: title, preview, audio, assets`);
    return messages;
  } catch (error: any) {
    console.error(`❌ Error generating campaign messages:`, error);
    return [];
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string; contactId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { campaignId, contactId } = await params;
    console.log(`📬 Fetching messages for ${campaignId}/${contactId}`);

    try {
      // Try to get messages from Firestore
      const messagesRef = db
        .collection("users")
        .doc(userId)
        .collection("campaigns")
        .doc(campaignId)
        .collection("inbox")
        .doc("contacts")
        .collection("contacts")
        .doc(contactId)
        .collection("messages");

      let messagesSnapshot;
      try {
        messagesSnapshot = await messagesRef
          .orderBy("createdAt", "asc")
          .get();
      } catch (orderByError: any) {
        // If orderBy fails, get all and sort in code
        console.log(`   ℹ️ OrderBy failed, fetching all and sorting in code`);
        const allDocs = await messagesRef.get();
        const sortedDocs = allDocs.docs.sort((a, b) => {
          const aTime = a.data().createdAt?.toDate?.() || new Date(a.data().createdAt || 0);
          const bTime = b.data().createdAt?.toDate?.() || new Date(b.data().createdAt || 0);
          return new Date(aTime).getTime() - new Date(bTime).getTime();
        });
        messagesSnapshot = { docs: sortedDocs };
      }

      // If messages found in Firestore, check if we need to prepend campaign messages
      if (messagesSnapshot.docs.length > 0) {
        console.log(`✅ Found ${messagesSnapshot.docs.length} messages in Firestore`);
        
        const firestoreMessages = messagesSnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            sender: data.sender || "campaign",
            type: data.type || "text",
            content: data.content || "",
            timestamp: data.timestamp || new Date().toISOString(),
            audioUrl: data.audioUrl,
            assets: data.assets,
          };
        });

        // Check if campaign messages are missing (no msg_title, msg_preview, etc.)
        const hasCampaignMessages = firestoreMessages.some(m => 
          m.id === "msg_title" || m.id === "msg_preview" || m.id === "msg_audio" || m.id === "msg_assets"
        );

        if (!hasCampaignMessages && firestoreMessages.length > 0) {
          console.log(`⚠️ Campaign messages missing, generating and prepending...`);
          const campaignMessages = await generateCampaignMessages(userId, campaignId);
          const allMessages = [...campaignMessages, ...firestoreMessages];
          return NextResponse.json({ messages: allMessages });
        }

        return NextResponse.json({ messages: firestoreMessages });
      }

      // No messages in Firestore, generate campaign messages
      console.log(`⚠️ No messages in Firestore, generating campaign messages...`);
      const generatedMessages = await generateCampaignMessages(userId, campaignId);
      return NextResponse.json({ messages: generatedMessages });
    } catch (firestoreError: any) {
      console.log(`⚠️ Firestore error: ${firestoreError.message}, generating campaign messages as fallback`);
      const generatedMessages = await generateCampaignMessages(userId, campaignId);
      return NextResponse.json({ messages: generatedMessages });
    }
  } catch (error) {
    console.error("❌ Error:", error);
    return NextResponse.json(
      { messages: [] },
      { status: 200 }
    );
  }
}
