import { db } from "@/db";
import {
  users,
  businesses,
  menuCategories,
  menuItems,
  qrCodes,
  businessMembers,
} from "@/db/schema";
import { hashPassword } from "@/lib/auth";
import { nanoid } from "nanoid";
import { eq } from "drizzle-orm";

export const DEMO_EMAIL = "demo@bakecafe.test";
export const DEMO_PASSWORD = "demo1234";
export const DEMO_SLUG = "bake-cafe";

export async function ensureSeed() {
  const allUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, DEMO_EMAIL))
    .limit(1);
  if (allUsers.length > 0) return;

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const ownerId = nanoid();
  await db.insert(users).values({
    id: ownerId,
    email: DEMO_EMAIL,
    name: "Demo Owner",
    passwordHash,
    role: "owner",
  });

  const businessId = nanoid();
  await db.insert(businesses).values({
    id: businessId,
    ownerId,
    businessName: "BAKE Café & Bakery",
    slug: DEMO_SLUG,
    logo: null,
    coverImage: null,
    category: "Café & Bakery",
    description:
      "A cozy corner for hand-crafted coffee, fresh-baked breads and small-batch desserts.",
    phone: "+91 90000 12345",
    email: "hello@bakecafe.test",
    address: "Shop 12, Rose Lane, Bandra West",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400050",
    googleReviewUrl:
      "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4",
    googlePlaceId: "ChIJN1t_tDeuEmsRUsoyG83frY4",
    googleMapsUrl: "https://maps.google.com/?q=BAKE+Cafe+Bandra",
    websiteUrl: "https://bakecafe.test",
    instagramUrl: "https://instagram.com/bakecafe",
    facebookUrl: "https://facebook.com/bakecafe",
    youtubeUrl: "https://youtube.com/@bakecafe",
    whatsappUrl: "https://wa.me/919000012345",
    twitterUrl: "https://twitter.com/bakecafe",
    wifiEnabled: true,
    wifiName: "BAKE-Guest",
    wifiPassword: "welcome2025",
    wifiSecurity: "WPA",
    menuEnabled: true,
    reviewEnabled: true,
    aiReviewEnabled: true,
    theme: "coffee",
    primaryColor: "#7c2d12",
    secondaryColor: "#d6a86c",
    backgroundColor: "#fbf6ee",
    font: "Inter",
    tagline: "Baked with love, shared with you.",
    cardStyle: "rounded",
    buttonStyle: "solid",
  });

  await db.insert(businessMembers).values({
    businessId,
    userId: ownerId,
    role: "owner",
  });

  await db.insert(qrCodes).values({
    id: nanoid(),
    businessId,
    label: "Main QR",
    style: "classic",
  });

  const coffeeCat = { id: nanoid(), businessId, name: "Coffee", sortOrder: 0 };
  const bakeryCat = { id: nanoid(), businessId, name: "Bakery", sortOrder: 1 };
  const dessertCat = { id: nanoid(), businessId, name: "Desserts", sortOrder: 2 };
  const foodCat = { id: nanoid(), businessId, name: "All-Day Bites", sortOrder: 3 };

  await db.insert(menuCategories).values([coffeeCat, bakeryCat, dessertCat, foodCat]);

  await db.insert(menuItems).values([
    {
      id: nanoid(),
      businessId,
      categoryId: coffeeCat.id,
      name: "Classic Cappuccino",
      description: "Velvety steamed milk, double-shot espresso.",
      price: "₹220",
      image: null,
      available: true,
      sortOrder: 0,
    },
    {
      id: nanoid(),
      businessId,
      categoryId: coffeeCat.id,
      name: "Caramel Latte",
      description: "House caramel, oat milk option.",
      price: "₹260",
      image: null,
      available: true,
      sortOrder: 1,
    },
    {
      id: nanoid(),
      businessId,
      categoryId: coffeeCat.id,
      name: "Cold Brew",
      description: "18-hour slow steeped, served chilled.",
      price: "₹280",
      image: null,
      available: true,
      sortOrder: 2,
    },
    {
      id: nanoid(),
      businessId,
      categoryId: bakeryCat.id,
      name: "Almond Croissant",
      description: "Flaky, buttery, almond frangipane.",
      price: "₹180",
      image: null,
      available: true,
      sortOrder: 0,
    },
    {
      id: nanoid(),
      businessId,
      categoryId: bakeryCat.id,
      name: "Sourdough Loaf",
      description: "Naturally leavened, 48-hour ferment.",
      price: "₹380",
      image: null,
      available: true,
      sortOrder: 1,
    },
    {
      id: nanoid(),
      businessId,
      categoryId: bakeryCat.id,
      name: "Cinnamon Roll",
      description: "Soft, sticky, cream-cheese glaze.",
      price: "₹160",
      image: null,
      available: true,
      sortOrder: 2,
    },
    {
      id: nanoid(),
      businessId,
      categoryId: dessertCat.id,
      name: "Tiramisu Slice",
      description: "Mascarpone, espresso, cocoa.",
      price: "₹320",
      image: null,
      available: true,
      sortOrder: 0,
    },
    {
      id: nanoid(),
      businessId,
      categoryId: dessertCat.id,
      name: "Chocolate Truffle",
      description: "Dark chocolate, sea salt.",
      price: "₹220",
      image: null,
      available: true,
      sortOrder: 1,
    },
    {
      id: nanoid(),
      businessId,
      categoryId: foodCat.id,
      name: "Avocado Toast",
      description: "Sourdough, smashed avo, chilli flakes.",
      price: "₹340",
      image: null,
      available: true,
      sortOrder: 0,
    },
    {
      id: nanoid(),
      businessId,
      categoryId: foodCat.id,
      name: "Mushroom Melt",
      description: "Three cheese, garlic butter.",
      price: "₹380",
      image: null,
      available: true,
      sortOrder: 1,
    },
  ]);
}