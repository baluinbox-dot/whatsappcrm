export const EMIRATES = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Umm Al Quwain", "Fujairah"];

export const PURPOSES = [
  { value: "SALE", label: "Sale" },
  { value: "RENT", label: "Rent" },
];

export const PROPERTY_TYPES = [
  { value: "APARTMENT", label: "Apartment" },
  { value: "VILLA", label: "Villa" },
  { value: "TOWNHOUSE", label: "Townhouse" },
  { value: "PENTHOUSE", label: "Penthouse" },
  { value: "DUPLEX", label: "Duplex" },
  { value: "HOTEL_APT", label: "Hotel Apartment" },
  { value: "OFFICE", label: "Office" },
  { value: "SHOP", label: "Shop / Retail" },
  { value: "WAREHOUSE", label: "Warehouse" },
  { value: "LAND", label: "Plot / Land" },
  { value: "BUILDING", label: "Whole Building" },
];

export const PROPERTY_STATUSES = [
  { value: "AVAILABLE", label: "Available", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  { value: "RESERVED", label: "Reserved", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  { value: "SOLD", label: "Sold", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  { value: "RENTED", label: "Rented", cls: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" },
  { value: "OFF_MARKET", label: "Off-Market", cls: "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-gray-300" },
];

export const COMPLETIONS = [
  { value: "READY", label: "Ready" },
  { value: "OFFPLAN", label: "Off-Plan" },
];

export const FURNISHINGS = [
  { value: "FURNISHED", label: "Furnished" },
  { value: "SEMI", label: "Semi-Furnished" },
  { value: "UNFURNISHED", label: "Unfurnished" },
];

export const BEDROOMS = [
  { value: 0, label: "Studio" },
  ...[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n} BR` })),
  { value: 7, label: "7+ BR" },
];

export const CHEQUES = [1, 2, 4, 6, 12];

export const AMENITIES = [
  "Balcony", "Maid Room", "Study Room", "Built-in Wardrobes", "Central A/C", "Kitchen Appliances",
  "Private Pool", "Shared Pool", "Private Garden", "Gym", "Covered Parking", "Security", "Concierge",
  "Children's Play Area", "BBQ Area", "Pets Allowed", "Sea View", "Burj Khalifa View", "Beach Access",
  "Metro Nearby", "Chiller Free",
];

export const COMMUNITIES = {
  Dubai: [
    "Downtown Dubai", "Dubai Marina", "Jumeirah Beach Residence (JBR)", "Palm Jumeirah", "Business Bay",
    "Jumeirah Village Circle (JVC)", "Jumeirah Village Triangle (JVT)", "Jumeirah Lake Towers (JLT)",
    "Dubai Hills Estate", "Arabian Ranches", "Arabian Ranches 2", "Arabian Ranches 3", "Damac Hills", "Damac Hills 2",
    "Dubai Creek Harbour", "Emaar Beachfront", "City Walk", "Al Barsha", "Al Furjan", "Motor City", "Sports City",
    "Dubai Silicon Oasis", "International City", "Discovery Gardens", "Mirdif", "The Springs", "The Meadows",
    "The Lakes", "Emirates Hills", "Jumeirah Golf Estates", "Town Square", "Dubai South", "MBR City",
    "Sobha Hartland", "Al Quoz", "Deira", "Bur Dubai", "Tilal Al Ghaf", "The Valley",
  ],
  "Abu Dhabi": [
    "Al Reem Island", "Saadiyat Island", "Yas Island", "Al Raha Beach", "Al Reef", "Khalifa City",
    "Mohammed Bin Zayed City", "Masdar City", "Al Ghadeer", "Corniche", "Al Khalidiya", "Al Raha Gardens",
  ],
  Sharjah: ["Al Majaz", "Al Nahda", "Al Taawun", "Aljada", "Muwaileh", "Al Khan", "Tilal City", "Sharjah Waterfront City"],
  Ajman: ["Al Nuaimiya", "Al Rashidiya", "Emirates City", "Al Zorah", "Ajman Downtown"],
  "Ras Al Khaimah": ["Al Marjan Island", "Al Hamra Village", "Mina Al Arab", "Julphar"],
  "Umm Al Quwain": ["UAQ Marina", "Al Salamah"],
  Fujairah: ["Fujairah City", "Dibba"],
};

export const SERVICE_CATEGORIES = [
  "Property Management", "Mortgage", "Golden Visa", "Conveyancing", "Holiday Homes", "Snagging", "Valuation", "Other",
];

export const LEAD_SOURCES = [
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "EMAIL", label: "Email" },
  { value: "BAYUT", label: "Bayut" },
  { value: "PROPERTY_FINDER", label: "Property Finder" },
  { value: "DUBIZZLE", label: "Dubizzle" },
  { value: "WEBSITE", label: "Website" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "REFERRAL", label: "Referral" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "GOOGLE", label: "Google Ads" },
  { value: "IMPORT", label: "Excel Import" },
  { value: "OTHER", label: "Other" },
];

export const LEAD_STATUSES = [
  { value: "NEW", label: "New", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" },
  { value: "CONTACTED", label: "Contacted", cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
  { value: "QUALIFIED", label: "Qualified", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  { value: "VIEWING_SCHEDULED", label: "Viewing Scheduled", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  { value: "VIEWING_DONE", label: "Viewing Done", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  { value: "NEGOTIATION", label: "Negotiation / Offer", cls: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300" },
  { value: "WON", label: "Won", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  { value: "NO_ANSWER", label: "No Answer", cls: "bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-gray-300" },
  { value: "FOLLOW_UP_LATER", label: "Follow-up Later", cls: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300" },
  { value: "NOT_INTERESTED", label: "Not Interested", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" },
  { value: "LOST", label: "Lost", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
];

export const CLOSED_STATUSES = ["WON", "NOT_INTERESTED", "LOST"];

export const PRIORITIES = [
  { value: "HOT", label: "Hot", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  { value: "WARM", label: "Warm", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  { value: "COLD", label: "Cold", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" },
];

export const LOST_REASONS = [
  { value: "BUDGET", label: "Budget doesn't match" },
  { value: "BOUGHT_ELSEWHERE", label: "Bought / rented elsewhere" },
  { value: "NOT_REACHABLE", label: "Not reachable" },
  { value: "LOCATION", label: "Location doesn't match" },
  { value: "NOT_READY", label: "Not ready to move / buy" },
  { value: "JUNK", label: "Junk / fake lead" },
  { value: "OTHER", label: "Other" },
];

export const LEAD_PURPOSES = [
  { value: "BUY", label: "Buy" },
  { value: "RENT", label: "Rent" },
];

export const FINANCE = [
  { value: "CASH", label: "Cash" },
  { value: "MORTGAGE", label: "Mortgage" },
];

export const LEAD_COMPLETIONS = [
  { value: "ANY", label: "Any" },
  { value: "READY", label: "Ready" },
  { value: "OFFPLAN", label: "Off-Plan" },
];

export const MOVE_TIMELINES = [
  { value: "IMMEDIATE", label: "Immediately" },
  { value: "1_3_MONTHS", label: "1–3 months" },
  { value: "3_6_MONTHS", label: "3–6 months" },
  { value: "6_PLUS", label: "6+ months" },
  { value: "JUST_LOOKING", label: "Just looking" },
];

export const BUYER_TYPES = [
  { value: "END_USER", label: "End User" },
  { value: "INVESTOR", label: "Investor" },
];

export const FOLLOW_UP_TYPES = [
  { value: "CALL", label: "Call" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "EMAIL", label: "Email" },
  { value: "MEETING", label: "Meeting" },
  { value: "VIEWING", label: "Viewing" },
];

export const CALL_OUTCOMES = [
  { value: "ANSWERED", label: "Answered" },
  { value: "NO_ANSWER", label: "No answer" },
  { value: "BUSY", label: "Busy" },
  { value: "SWITCHED_OFF", label: "Switched off" },
  { value: "WRONG_NUMBER", label: "Wrong number" },
];

export const NATIONALITIES = [
  "Emirati", "Indian", "Pakistani", "British", "Russian", "Chinese", "Saudi", "Egyptian", "Lebanese", "Jordanian",
  "Filipino", "Iranian", "American", "Canadian", "French", "German", "Italian", "Turkish", "Nigerian", "Kazakh",
  "Bangladeshi", "Sri Lankan", "South African", "Australian",
];

export const labelOf =(list, value) => list.find((x) => x.value === value)?.label ?? value ?? "";

export const bedroomsLabel = (n) => (n === null || n === undefined ? "" : labelOf(BEDROOMS, n));

const aed = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 });
export const formatAed = (n) => (n === null || n === undefined || n === "" ? "" : `AED ${aed.format(n)}`);
export const formatNumber = (n) => (n === null || n === undefined || n === "" ? "" : aed.format(n));

export const priceLabel = (p) =>
  `${formatAed(p.price)}${p.purpose === "RENT" ? (p.rentFrequency === "MONTHLY" ? " / month" : " / year") : ""}`;

const shortAed = (n) => (n >= 1000000 ? `${+(n / 1000000).toFixed(2)}M` : n >= 1000 ? `${+(n / 1000).toFixed(0)}K` : `${n}`);

// "Buy · 2–3 BR Apartment · Dubai Marina · AED 1.5M–2M"
export function requirementSummary(l) {
  const beds = l.bedroomsMin === null && l.bedroomsMax === null ? ""
    : l.bedroomsMin === l.bedroomsMax || l.bedroomsMax === null ? bedroomsLabel(l.bedroomsMin ?? l.bedroomsMax)
    : l.bedroomsMin === null ? `Up to ${bedroomsLabel(l.bedroomsMax)}`
    : `${l.bedroomsMin === 0 ? "Studio" : l.bedroomsMin}–${bedroomsLabel(l.bedroomsMax)}`;
  const type = [beds, l.propertyType && labelOf(PROPERTY_TYPES, l.propertyType)].filter(Boolean).join(" ");
  const budget = l.budgetMin && l.budgetMax ? `AED ${shortAed(l.budgetMin)}–${shortAed(l.budgetMax)}`
    : l.budgetMax ? `Up to AED ${shortAed(l.budgetMax)}`
    : l.budgetMin ? `From AED ${shortAed(l.budgetMin)}` : "";
  return [labelOf(LEAD_PURPOSES, l.purpose), type, l.communities || l.emirate, budget].filter(Boolean).join(" · ");
}

const FILES_BASE =(import.meta.env.VITE_API_URI || "").replace(/\/api\/?$/, "");
export const fileUrl = (propertyId, storedName) => `${FILES_BASE}/uploads/properties/${propertyId}/${storedName}`;
