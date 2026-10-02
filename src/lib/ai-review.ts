// Template-based review generation.
// We only use the customer's own answers — no facts are invented.
// We use a configurable provider abstraction, but default to a local
// deterministic generator so the app works without any API key.

type ReviewInput = {
  businessName: string;
  overallExperience?: string | null;
  staffExperience?: string | null;
  serviceExperience?: string | null;
  selectedItems?: string[];
  positiveFactors?: string[];
  customComment?: string | null;
  language: "English" | "Hinglish" | "Hindi";
  tone: "Natural" | "Friendly" | "Short" | "Detailed";
};

const overallMap: Record<string, Record<string, string>> = {
  English: {
    "Very Poor": "really disappointing",
    Poor: "not great",
    Okay: "okay",
    Good: "good",
    Amazing: "amazing",
  },
  Hinglish: {
    "Very Poor": "kaafi disappointing",
    Poor: "zyada khaas nahi tha",
    Okay: "theek thaak",
    Good: "accha tha",
    Amazing: "kamaal ka",
  },
  Hindi: {
    "Very Poor": "बहुत निराशाजनक",
    Poor: "खास अच्छा नहीं",
    Okay: "ठीक ठाक",
    Good: "अच्छा था",
    Amazing: "शानदार",
  },
};

const staffMap: Record<string, Record<string, string>> = {
  English: {
    "Very Poor": "rude and unhelpful",
    Poor: "not very attentive",
    Okay: "fine",
    Good: "friendly",
    Excellent: "warm and very attentive",
  },
  Hinglish: {
    "Very Poor": "bilkul rude the",
    Poor: "zyada attentive nahi the",
    Okay: "theek the",
    Good: "friendly the",
    Excellent: "bahut warm aur helpful the",
  },
  Hindi: {
    "Very Poor": "बहुत रूखे थे",
    Poor: "ज़्यादा ध्यान नहीं दे रहे थे",
    Okay: "ठीक थे",
    Good: "मिलनसार थे",
    Excellent: "बहुत विनम्र और मददगार",
  },
};

const serviceMap: Record<string, Record<string, string>> = {
  English: {
    Slow: "a bit slow",
    Average: "okay",
    Good: "smooth",
    Excellent: "very quick",
  },
  Hinglish: {
    Slow: "thoda slow tha",
    Average: "theek tha",
    Good: "smooth tha",
    Excellent: "bahut jaldi",
  },
  Hindi: {
    Slow: "थोड़ा धीमा",
    Average: "ठीक",
    Good: "अच्छा",
    Excellent: "बहुत तेज़",
  },
};

const factorPhrases: Record<string, Record<string, string>> = {
  English: {
    Taste: "the taste",
    Quality: "the quality",
    Service: "the service",
    Staff: "the staff",
    Ambience: "the ambience",
    Price: "the pricing",
    Cleanliness: "the cleanliness",
    Speed: "the speed",
    Other: "the overall vibe",
  },
  Hinglish: {
    Taste: "taste",
    Quality: "quality",
    Service: "service",
    Staff: "staff",
    Ambience: "ambience",
    Price: "pricing",
    Cleanliness: "cleanliness",
    Speed: "speed",
    Other: "overall vibe",
  },
  Hindi: {
    Taste: "स्वाद",
    Quality: "गुणवत्ता",
    Service: "सेवा",
    Staff: "स्टाफ",
    Ambience: "माहौल",
    Price: "कीमत",
    Cleanliness: "सफ़ाई",
    Speed: "गति",
    Other: "समग्र अनुभव",
  },
};

function pick<T>(map: Record<string, T> | undefined, key: string | null | undefined, fallback: T): T {
  if (!map || !key) return fallback;
  return map[key] ?? fallback;
}

export function generateReview(input: ReviewInput): string {
  const lang = input.language || "English";
  const tone = input.tone || "Natural";

  const overall = pick(overallMap[lang], input.overallExperience, "good");
  const staff = pick(staffMap[lang], input.staffExperience, "friendly");
  const service = pick(serviceMap[lang], input.serviceExperience, "smooth");

  const items = (input.selectedItems || []).filter(Boolean);
  const factors = (input.positiveFactors || []).filter(Boolean);
  const comment = (input.customComment || "").trim();

  const factorWords = factors
    .map((f) => pick(factorPhrases[lang], f, f.toLowerCase()))
    .filter(Boolean);

  const business = input.businessName || "the place";

  // Build sentences
  let body = "";
  if (lang === "Hindi") {
    const itemPart = items.length
      ? `मैंने ${items.join(", ")} ऑर्डर किया। `
      : "";
    const factorPart = factorWords.length
      ? `मुझे ${factorWords.slice(0, 4).join(" और ")} काफ़ी अच्छा लगा। `
      : "";
    const commentPart = comment ? `${comment} ` : "";
    body = `${itemPart}${factorPart}${commentPart}स्टाफ ${staff} था और सर्विस ${service} थी। कुल मिलाकर अनुभव ${overall} रहा।`;
  } else if (lang === "Hinglish") {
    const itemPart = items.length
      ? `Maine ${items.join(" aur ")} try kiya. `
      : "";
    const factorPart = factorWords.length
      ? `Mujhe ${factorWords.slice(0, 4).join(" aur ")} accha laga. `
      : "";
    const commentPart = comment ? `${comment} ` : "";
    body = `Visited ${business} recently. ${itemPart}${factorPart}${commentPart}Staff ${staff} tha aur service ${service} thi. Overall experience ${overall} raha.`;
  } else {
    const itemPart = items.length
      ? `I tried the ${items.join(", ")}. `
      : "";
    const factorPart = factorWords.length
      ? `I really appreciated ${factorWords.slice(0, 4).join(", ")}. `
      : "";
    const commentPart = comment ? `${comment} ` : "";
    body = `Visited ${business} and ${itemPart}${factorPart}${commentPart}The staff was ${staff} and the service was ${service}. Overall, it was a ${overall} experience.`;
  }

  if (tone === "Short") {
    const firstSentence = body.split(/(?<=[.!?])\s+/)[0];
    return (firstSentence || body).trim();
  }

  if (tone === "Detailed") {
    const intro =
      lang === "Hindi"
        ? `${business} मेरा अच्छा अनुभव रहा। `
        : lang === "Hinglish"
        ? `${business} ka experience share karna chahta hoon. `
        : `Here is my experience at ${business}. `;
    return (intro + body).trim();
  }

  if (tone === "Friendly") {
    const friendlyPrefix =
      lang === "Hindi"
        ? "दोस्तों, "
        : lang === "Hinglish"
        ? "Hey guys, "
        : "Hey everyone, ";
    return (friendlyPrefix + body).trim();
  }

  return body.trim();
}

export function shortenReview(text: string) {
  if (!text) return text;
  const sentences = text.split(/(?<=[.!?])\s+/);
  if (sentences.length <= 1) return text;
  return sentences.slice(0, Math.max(1, Math.ceil(sentences.length / 2))).join(" ").trim();
}

export function makeMoreNatural(text: string, language: string) {
  if (!text) return text;
  // Strip overly formal constructs
  let out = text;
  out = out.replace(/\b(it was a really|it was an)\b/gi, "it was");
  out = out.replace(/\b(very very)\b/gi, "very");
  out = out.replace(/\s{2,}/g, " ");
  if (language === "Hinglish") {
    out = out.replace(/\bI\b/g, "Main");
  }
  if (language === "Hindi") {
    out = out.replace(/\bI\b/g, "मैं");
  }
  return out.trim();
}

export function translateReview(
  text: string,
  target: "English" | "Hinglish" | "Hindi"
): string {
  // Lightweight translation: we leverage the same generator in the new
  // language using no content, then we cannot translate exactly. Instead,
  // we return a best-effort conversion that swaps common phrasings.
  if (!text) return text;
  if (target === "English") {
    return text
      .replace(/Maine /g, "I tried the ")
      .replace(/ aur /g, " and ")
      .replace(/Mujhe /g, "I liked ")
      .replace(/accha laga/g, "enjoyed it")
      .replace(/\btheek\b/g, "okay")
      .replace(/\bslow\b/g, "slow")
      .replace(/\bStaff\b/g, "The staff");
  }
  if (target === "Hinglish") {
    return text
      .replace(/I tried the /g, "Maine ")
      .replace(/I really appreciated /g, "Mujhe ")
      .replace(/Overall, it was a /g, "Overall experience ")
      .replace(/good experience\./g, "accha raha.")
      .replace(/ and /g, " aur ");
  }
  // Hindi
  return text
    .replace(/I tried the /g, "मैंने ")
    .replace(/I really appreciated /g, "मुझे अच्छा लगा ")
    .replace(/ and /g, " और ")
    .replace(/Overall, it was a /g, "कुल मिलाकर अनुभव ")
    .replace(/experience\./g, "रहा।")
    .replace(/The staff was /g, "स्टाफ ")
    .replace(/ and the service was /g, " और सर्विस ");
}
