/**
 * Mock bootstrap data for the SIMServe SMS client.
 *
 * The persisted message model uses `subscription_id` (the Android
 * identifier), never the SIM ordinal. The mapping from ordinal to
 * subscription_id is the one defined in `mockSims` below:
 *   ordinal 1 -> subscription_id 7
 *   ordinal 2 -> subscription_id 14
 *   ordinal 3 -> subscription_id 3
 *
 * Message types:
 *   1 INBOX, 2 SENT, 3 DRAFT, 4 OUTBOX, 5 FAILED, 6 QUEUED.
 */

import type { Contact, Conversation, Sim } from "@/types";

type MockSim = Omit<Sim, "serveId">;
type MockConversation = Omit<Conversation, "serveId">;

export interface MockMessage {
  body: string;
  timestamp: number;
  /** Canonical SIM identity (Android subscription_id). */
  subscription_id: number;
  /** Android SMS type, 1..6. */
  messageType: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const minutesAgo = (minutes: number): number =>
  Date.now() - minutes * 60 * 1000;

const hoursAgo = (hours: number): number => Date.now() - hours * 60 * 60 * 1000;

const daysAgo = (days: number): number =>
  Date.now() - days * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// SIMs
// ---------------------------------------------------------------------------

export const mockSims: MockSim[] = [
  {
    ordinal: 1,
    subscription_id: 7,
    slot_index: 0,
    number: "+4915100000001",
    carrier_name: "MCI",
    display_name: "Personal",
    country_iso: "de",
    mcc: 262,
    mnc: 1,
    is_default_sms: true,
  },
  {
    ordinal: 2,
    subscription_id: 14,
    slot_index: 1,
    number: "+4915100000002",
    carrier_name: "Vodafone",
    display_name: "Work",
    country_iso: "de",
    mcc: 262,
    mnc: 2,
    is_default_sms: false,
  },
  {
    ordinal: 3,
    subscription_id: 3,
    slot_index: 2,
    number: null,
    carrier_name: null,
    display_name: "Travel",
    country_iso: null,
    mcc: null,
    mnc: null,
    is_default_sms: false,
  },
];

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

export const mockConversations: MockConversation[] = [
  {
    number: "+4915112345678",
    contactName: "Alice",
    preview: "See you at 6 then.",
    timestamp: minutesAgo(4),
    unread: true,
  },
  {
    number: "+4916098765432",
    contactName: "Marta",
    preview: "Danke, bis morgen!",
    timestamp: minutesAgo(42),
    unread: false,
  },
  {
    number: "+4915511122233",
    contactName: "Unsaved contact",
    preview: "Your verification code is 483-291. Do not share it with anyone.",
    timestamp: hoursAgo(3),
    unread: true,
  },
  {
    number: "+491234567890",
    contactName: "Lena",
    preview: "Got it, thanks!",
    timestamp: hoursAgo(6) + 30_000,
    unread: false,
  },
  {
    number: "+491771234567",
    contactName: "Bank",
    preview: "Ihre Karte wurde gesperrt. Bitte rufen Sie uns an.",
    timestamp: daysAgo(2),
    unread: false,
  },
  {
    number: "+4915223344556",
    contactName: "Unsaved contact",
    preview: "Sorry, wrong number.",
    timestamp: daysAgo(5),
    unread: false,
  },
  {
    number: "+4915190000001",
    contactName: "Outbox Demo",
    preview: "Queued for delivery",
    timestamp: minutesAgo(2),
    unread: false,
  },
  {
    number: "+4915190000002",
    contactName: "Failed Demo",
    preview: "Message failed to send",
    timestamp: minutesAgo(6),
    unread: false,
  },
  {
    number: "+4915190000003",
    contactName: "Queued Demo",
    preview: "Waiting to be sent",
    timestamp: minutesAgo(9),
    unread: false,
  },
  {
    number: "+4915190000004",
    contactName: "Draft Demo",
    preview: "Unsaved message",
    timestamp: minutesAgo(12),
    unread: false,
  },
];

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export const mockMessages: Record<string, MockMessage[]> = {
  // ---- Alice ΓÇö subscription_id 14 (Work) ---------------------------------
  "+4915112345678": [
    {
      body: "Hi, are we still on for tonight?",
      timestamp: minutesAgo(38),
      subscription_id: 14,
      messageType: 1,
    },
    {
      body: "Yes, 6pm at the usual place.",
      timestamp: minutesAgo(21),
      subscription_id: 14,
      messageType: 2,
    },
    {
      body: "See you at 6 then.",
      timestamp: minutesAgo(4),
      subscription_id: 14,
      messageType: 1,
    },
  ],

  // ---- Marta ΓÇö subscription_id 7 (Personal) -----------------------------
  "+4916098765432": [
    {
      body: "Kannst du das Paket morgen abholen?",
      timestamp: hoursAgo(2),
      subscription_id: 7,
      messageType: 1,
    },
    {
      body: "Klar, mache ich.",
      timestamp: hoursAgo(1),
      subscription_id: 7,
      messageType: 2,
    },
    {
      body: "Danke, bis morgen!",
      timestamp: minutesAgo(42),
      subscription_id: 7,
      messageType: 1,
    },
  ],

  // ---- Unsaved number ΓÇö subscription_id 7 -------------------------------
  "+4915511122233": [
    {
      body: "Your verification code is 483-291. Do not share it with anyone.",
      timestamp: hoursAgo(3),
      subscription_id: 7,
      messageType: 1,
    },
  ],

  // ---- Lena ΓÇö subscription_id 7 and 14 ---------------------------------
  "+491234567890": [
    {
      body: "Hey, are you free this weekend?",
      timestamp: hoursAgo(9),
      subscription_id: 7,
      messageType: 1,
    },
    {
      body: "Probably Saturday afternoon.",
      timestamp: hoursAgo(8),
      subscription_id: 7,
      messageType: 2,
    },
    {
      body: "Can you send me the file from work?",
      timestamp: hoursAgo(7),
      subscription_id: 14,
      messageType: 1,
    },
    {
      body: "Sending it now.",
      timestamp: hoursAgo(6),
      subscription_id: 14,
      messageType: 2,
    },
    {
      body: "Got it, thanks!",
      timestamp: hoursAgo(6) + 30_000,
      subscription_id: 14,
      messageType: 1,
    },
  ],

  // ---- Bank ΓÇö subscription_id 3 ----------------------------------------
  "+491771234567": [
    {
      body: "Ihre Karte wurde gesperrt. Bitte rufen Sie uns an.",
      timestamp: daysAgo(2),
      subscription_id: 3,
      messageType: 1,
    },
  ],

  // ---- Unsaved number ΓÇö subscription_id 3 -------------------------------
  "+4915223344556": [
    {
      body: "Sorry, wrong number.",
      timestamp: daysAgo(5),
      subscription_id: 3,
      messageType: 1,
    },
    {
      body: "No problem.",
      timestamp: daysAgo(5) + 60_000,
      subscription_id: 3,
      messageType: 2,
    },
  ],

  // ---- Outbox Demo --------------------------------------------------------
  "+4915190000001": [
    {
      body: "This message is in the outbox.",
      timestamp: minutesAgo(2),
      subscription_id: 7,
      messageType: 4,
    },
  ],

  // ---- Failed Demo --------------------------------------------------------
  "+4915190000002": [
    {
      body: "This message failed to send.",
      timestamp: minutesAgo(6),
      subscription_id: 14,
      messageType: 5,
    },
  ],

  // ---- Queued Demo --------------------------------------------------------
  "+4915190000003": [
    {
      body: "This message is queued.",
      timestamp: minutesAgo(9),
      subscription_id: 3,
      messageType: 6,
    },
  ],

  // ---- Draft Demo ---------------------------------------------------------
  "+4915190000004": [
    {
      body: "Hi, drafting a reply.",
      timestamp: minutesAgo(14),
      subscription_id: 7,
      messageType: 1,
    },
    {
      body: "This text should appear in the input box, not in the list.",
      timestamp: minutesAgo(12),
      subscription_id: 7,
      messageType: 3,
    },
  ],
};

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export const mockContacts: Omit<Contact, "serveId">[] = [
  { id: "contact-1", displayName: "Alice", number: "+4915112345678" },
  { id: "contact-2", displayName: "Marta", number: "+4916098765432" },
  { id: "contact-3", displayName: "Lena", number: "+491234567890" },
  { id: "contact-4", displayName: "Bank", number: "+491771234567" },
];
