import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ campaignId: string; contactId: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { campaignId, contactId } = await params;
    const body = await request.json();
    const { message } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }

    const contactRef = db
      .collection("users")
      .doc(userId)
      .collection("campaigns")
      .doc(campaignId)
      .collection("inbox")
      .doc("contacts")
      .collection("contacts")
      .doc(contactId);

    // Ensure contact document exists (create if missing)
    const contactDoc = await contactRef.get();
    if (!contactDoc.exists) {
      await contactRef.set({
        contactId: contactId,
        contactName: "Unknown",
        contactPhone: "",
        profilePic: "",
        lastMessage: "",
        lastMessageTime: null,
        unreadCount: 0,
        createdAt: FieldValue.serverTimestamp(),
      });
    }

    // User message
    const userMsgId = `msg_${Date.now()}`;
    await contactRef.collection("messages").doc(userMsgId).set({
      sender: "user",
      type: "text",
      content: message,
      timestamp: new Date().toISOString(),
      createdAt: FieldValue.serverTimestamp(),
    });

    // Update contact with last message (using set with merge to ensure document exists)
    await contactRef.set({
      lastMessage: message,
      lastMessageTime: FieldValue.serverTimestamp(),
    }, { merge: true });

    // AI reply
    setTimeout(async () => {
      const aiMsgId = `ai_${Date.now()}`;
      await contactRef.collection("messages").doc(aiMsgId).set({
        sender: "ai",
        type: "text",
        content: "Thanks for your message! How can I help?",
        timestamp: new Date().toISOString(),
        createdAt: FieldValue.serverTimestamp(),
      });

      await contactRef.set({
        lastMessage: "Thanks for your message! How can I help?",
        lastMessageTime: FieldValue.serverTimestamp(),
      }, { merge: true });
    }, 1000);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ Error:", error);
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
