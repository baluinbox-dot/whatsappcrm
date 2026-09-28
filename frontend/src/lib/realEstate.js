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

export const labelOf = (list, value) => list.find((x) => x.value === value)?.label ?? value ?? "";

export const bedroomsLabel = (n) => (n === null || n === undefined ? "" : labelOf(BEDROOMS, n));

const aed = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 });
export const formatAed = (n) => (n === null || n === undefined || n === "" ? "" : `AED ${aed.format(n)}`);
export const formatNumber = (n) => (n === null || n === undefined || n === "" ? "" : aed.format(n));

export const priceLabel = (p) =>
  `${formatAed(p.price)}${p.purpose === "RENT" ? (p.rentFrequency === "MONTHLY" ? " / month" : " / year") : ""}`;

const FILES_BASE = (import.meta.env.VITE_API_URI || "").replace(/\/api\/?$/, "");
export const fileUrl = (propertyId, storedName) => `${FILES_BASE}/uploads/properties/${propertyId}/${storedName}`;
