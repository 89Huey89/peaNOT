/**
 * Ready-to-show allergy phrases for handing the phone to staff in a shop or
 * restaurant abroad. The text is peanut-specific (the app's namesake allergen)
 * and asks two things: which items are safe, and to avoid cross-contamination.
 *
 * SAFETY-CRITICAL: these sentences are shown to staff who decide what a child
 * with a life-threatening allergy may eat. Translations must be reviewed by a
 * human before changing. Each language must cover every venue (enforced by
 * lib/phrases.test.ts) so a picked language can never fall back to silence.
 */

export type VenueKey = "icecream" | "restaurant" | "bakery" | "general";

export interface Venue {
  key: VenueKey;
  /** German label for the picker (the app UI is German). */
  label: string;
}

export interface PhraseLang {
  /** Primary language subtag, used for matching the device language. */
  code: string;
  /** Native name, shown in the picker and on the card. */
  label: string;
  /** English name, for screen readers and search. */
  english: string;
  /** Right-to-left script (affects text direction on the card). */
  rtl?: boolean;
}

export const VENUES: Venue[] = [
  { key: "icecream", label: "Eisdiele" },
  { key: "restaurant", label: "Restaurant" },
  { key: "bakery", label: "Bäckerei & Café" },
  { key: "general", label: "Allgemein" },
];

/** English is the guaranteed fallback language (and translation set). */
export const FALLBACK_LANG: PhraseLang = { code: "en", label: "English", english: "English" };

export const PHRASE_LANGS: PhraseLang[] = [
  { code: "de", label: "Deutsch", english: "German" },
  FALLBACK_LANG,
  { code: "it", label: "Italiano", english: "Italian" },
  { code: "fr", label: "Français", english: "French" },
  { code: "es", label: "Español", english: "Spanish" },
  { code: "pt", label: "Português", english: "Portuguese" },
  { code: "nl", label: "Nederlands", english: "Dutch" },
  { code: "pl", label: "Polski", english: "Polish" },
  { code: "cs", label: "Čeština", english: "Czech" },
  { code: "hr", label: "Hrvatski", english: "Croatian" },
  { code: "el", label: "Ελληνικά", english: "Greek" },
  { code: "tr", label: "Türkçe", english: "Turkish" },
  { code: "ru", label: "Русский", english: "Russian" },
  { code: "ar", label: "العربية", english: "Arabic", rtl: true },
  { code: "zh", label: "中文", english: "Chinese" },
  { code: "ja", label: "日本語", english: "Japanese" },
];

/**
 * code → venue → sentence. Keep the two-part structure in every language:
 * (1) "my child has a severe peanut allergy", (2) which items are safe + a
 * request to avoid cross-contamination.
 */
export const PHRASES: Record<string, Record<VenueKey, string>> = {
  de: {
    icecream:
      "Mein Kind hat eine schwere Erdnussallergie. Welche Eissorten sind frei von Erdnüssen und ohne Risiko einer Verunreinigung? Bitte verwenden Sie einen sauberen, frisch abgewaschenen Portionierer.",
    restaurant:
      "Mein Kind hat eine schwere Erdnussallergie. Welche Gerichte sind frei von Erdnüssen und ohne Risiko einer Verunreinigung? Bitte bereiten Sie das Essen mit sauberem Geschirr und sauberen Arbeitsflächen zu.",
    bakery:
      "Mein Kind hat eine schwere Erdnussallergie. Welche Backwaren sind frei von Erdnüssen und ohne Risiko einer Verunreinigung? Bitte verwenden Sie sauberes Werkzeug.",
    general:
      "Mein Kind hat eine schwere Erdnussallergie. Schon kleinste Mengen können gefährlich sein. Bitte stellen Sie sicher, dass das Essen keine Erdnüsse enthält und ohne Risiko einer Verunreinigung zubereitet wird.",
  },
  en: {
    icecream:
      "My child has a severe peanut allergy. Which flavours are free from peanuts and free from any risk of cross-contamination? Please use a clean, freshly washed scoop.",
    restaurant:
      "My child has a severe peanut allergy. Which dishes are free from peanuts and free from any risk of cross-contamination? Please prepare the meal with clean utensils and surfaces.",
    bakery:
      "My child has a severe peanut allergy. Which baked goods are free from peanuts and free from any risk of cross-contamination? Please use clean utensils.",
    general:
      "My child has a severe peanut allergy. Even the smallest amount can be dangerous. Please make sure the food contains no peanuts and is prepared without any risk of cross-contamination.",
  },
  it: {
    icecream:
      "Mio figlio ha una grave allergia alle arachidi. Quali gusti sono senza arachidi e senza rischio di contaminazione? Per favore, usi una paletta pulita e appena lavata.",
    restaurant:
      "Mio figlio ha una grave allergia alle arachidi. Quali piatti sono senza arachidi e senza rischio di contaminazione? Per favore, prepari il pasto con utensili e superfici puliti.",
    bakery:
      "Mio figlio ha una grave allergia alle arachidi. Quali prodotti da forno sono senza arachidi e senza rischio di contaminazione? Per favore, usi utensili puliti.",
    general:
      "Mio figlio ha una grave allergia alle arachidi. Anche una piccolissima quantità può essere pericolosa. Per favore, si assicuri che il cibo non contenga arachidi e sia preparato senza rischio di contaminazione.",
  },
  fr: {
    icecream:
      "Mon enfant a une grave allergie aux arachides (cacahuètes). Quels parfums sont sans arachides et sans risque de contamination ? Merci d'utiliser une cuillère à glace propre et fraîchement lavée.",
    restaurant:
      "Mon enfant a une grave allergie aux arachides (cacahuètes). Quels plats sont sans arachides et sans risque de contamination ? Merci de préparer le repas avec des ustensiles et des surfaces propres.",
    bakery:
      "Mon enfant a une grave allergie aux arachides (cacahuètes). Quels produits sont sans arachides et sans risque de contamination ? Merci d'utiliser des ustensiles propres.",
    general:
      "Mon enfant a une grave allergie aux arachides (cacahuètes). Même une très petite quantité peut être dangereuse. Merci de vous assurer que le plat ne contient pas d'arachides et qu'il est préparé sans risque de contamination.",
  },
  es: {
    icecream:
      "Mi hijo tiene una alergia grave al cacahuete (maní). ¿Qué sabores no contienen cacahuete y no tienen riesgo de contaminación? Por favor, use una cuchara de helado limpia y recién lavada.",
    restaurant:
      "Mi hijo tiene una alergia grave al cacahuete (maní). ¿Qué platos no contienen cacahuete y no tienen riesgo de contaminación? Por favor, prepare la comida con utensilios y superficies limpios.",
    bakery:
      "Mi hijo tiene una alergia grave al cacahuete (maní). ¿Qué productos no contienen cacahuete y no tienen riesgo de contaminación? Por favor, use utensilios limpios.",
    general:
      "Mi hijo tiene una alergia grave al cacahuete (maní). Incluso una cantidad muy pequeña puede ser peligrosa. Por favor, asegúrese de que la comida no contenga cacahuete y se prepare sin riesgo de contaminación.",
  },
  pt: {
    icecream:
      "O meu filho tem uma alergia grave a amendoim. Quais sabores não contêm amendoim e não têm risco de contaminação? Por favor, use uma colher de gelado limpa e acabada de lavar.",
    restaurant:
      "O meu filho tem uma alergia grave a amendoim. Quais pratos não contêm amendoim e não têm risco de contaminação? Por favor, prepare a refeição com utensílios e superfícies limpos.",
    bakery:
      "O meu filho tem uma alergia grave a amendoim. Quais produtos não contêm amendoim e não têm risco de contaminação? Por favor, use utensílios limpos.",
    general:
      "O meu filho tem uma alergia grave a amendoim. Mesmo uma quantidade muito pequena pode ser perigosa. Por favor, certifique-se de que a comida não contém amendoim e é preparada sem risco de contaminação.",
  },
  nl: {
    icecream:
      "Mijn kind heeft een ernstige pinda-allergie. Welke smaken zijn vrij van pinda's en zonder risico op kruisbesmetting? Gebruik alstublieft een schone, net gewassen ijslepel.",
    restaurant:
      "Mijn kind heeft een ernstige pinda-allergie. Welke gerechten zijn vrij van pinda's en zonder risico op kruisbesmetting? Bereid de maaltijd alstublieft met schoon gereedschap en schone oppervlakken.",
    bakery:
      "Mijn kind heeft een ernstige pinda-allergie. Welke gebakken producten zijn vrij van pinda's en zonder risico op kruisbesmetting? Gebruik alstublieft schoon gereedschap.",
    general:
      "Mijn kind heeft een ernstige pinda-allergie. Zelfs een heel kleine hoeveelheid kan gevaarlijk zijn. Zorg er alstublieft voor dat het eten geen pinda's bevat en zonder risico op kruisbesmetting wordt bereid.",
  },
  pl: {
    icecream:
      "Moje dziecko ma ciężką alergię na orzeszki ziemne. Które smaki są bez orzeszków ziemnych i bez ryzyka zanieczyszczenia? Proszę użyć czystej, świeżo umytej łyżki do lodów.",
    restaurant:
      "Moje dziecko ma ciężką alergię na orzeszki ziemne. Które dania są bez orzeszków ziemnych i bez ryzyka zanieczyszczenia? Proszę przygotować posiłek czystymi narzędziami i na czystych powierzchniach.",
    bakery:
      "Moje dziecko ma ciężką alergię na orzeszki ziemne. Które wypieki są bez orzeszków ziemnych i bez ryzyka zanieczyszczenia? Proszę użyć czystych narzędzi.",
    general:
      "Moje dziecko ma ciężką alergię na orzeszki ziemne. Nawet niewielka ilość może być niebezpieczna. Proszę upewnić się, że jedzenie nie zawiera orzeszków ziemnych i jest przygotowane bez ryzyka zanieczyszczenia.",
  },
  cs: {
    icecream:
      "Moje dítě má těžkou alergii na arašídy. Které příchutě jsou bez arašídů a bez rizika kontaminace? Použijte prosím čistou, čerstvě umytou lžíci na zmrzlinu.",
    restaurant:
      "Moje dítě má těžkou alergii na arašídy. Která jídla jsou bez arašídů a bez rizika kontaminace? Připravte prosím jídlo čistým náčiním a na čistých plochách.",
    bakery:
      "Moje dítě má těžkou alergii na arašídy. Které pečivo je bez arašídů a bez rizika kontaminace? Použijte prosím čisté náčiní.",
    general:
      "Moje dítě má těžkou alergii na arašídy. I velmi malé množství může být nebezpečné. Ujistěte se prosím, že jídlo neobsahuje arašídy a je připraveno bez rizika kontaminace.",
  },
  hr: {
    icecream:
      "Moje dijete ima tešku alergiju na kikiriki. Koji su okusi bez kikirikija i bez rizika od kontaminacije? Molim vas, upotrijebite čistu, svježe opranu žlicu za sladoled.",
    restaurant:
      "Moje dijete ima tešku alergiju na kikiriki. Koja su jela bez kikirikija i bez rizika od kontaminacije? Molim vas, pripremite obrok čistim priborom i na čistim površinama.",
    bakery:
      "Moje dijete ima tešku alergiju na kikiriki. Koji su pekarski proizvodi bez kikirikija i bez rizika od kontaminacije? Molim vas, upotrijebite čisti pribor.",
    general:
      "Moje dijete ima tešku alergiju na kikiriki. Čak i vrlo mala količina može biti opasna. Molim vas, osigurajte da hrana ne sadrži kikiriki i da je pripremljena bez rizika od kontaminacije.",
  },
  el: {
    icecream:
      "Το παιδί μου έχει σοβαρή αλλεργία στα αράπικα φιστίκια (αραχίδες). Ποιες γεύσεις είναι χωρίς φιστίκια και χωρίς κίνδυνο επιμόλυνσης; Παρακαλώ χρησιμοποιήστε μια καθαρή, φρεσκοπλυμένη σέσουλα παγωτού.",
    restaurant:
      "Το παιδί μου έχει σοβαρή αλλεργία στα αράπικα φιστίκια (αραχίδες). Ποια πιάτα είναι χωρίς φιστίκια και χωρίς κίνδυνο επιμόλυνσης; Παρακαλώ ετοιμάστε το φαγητό με καθαρά σκεύη και επιφάνειες.",
    bakery:
      "Το παιδί μου έχει σοβαρή αλλεργία στα αράπικα φιστίκια (αραχίδες). Ποια προϊόντα είναι χωρίς φιστίκια και χωρίς κίνδυνο επιμόλυνσης; Παρακαλώ χρησιμοποιήστε καθαρά σκεύη.",
    general:
      "Το παιδί μου έχει σοβαρή αλλεργία στα αράπικα φιστίκια (αραχίδες). Ακόμη και μια πολύ μικρή ποσότητα μπορεί να είναι επικίνδυνη. Παρακαλώ βεβαιωθείτε ότι το φαγητό δεν περιέχει φιστίκια και ότι παρασκευάζεται χωρίς κίνδυνο επιμόλυνσης.",
  },
  tr: {
    icecream:
      "Çocuğumun ciddi bir yer fıstığı alerjisi var. Hangi dondurma çeşitleri yer fıstığı içermez ve bulaşma riski taşımaz? Lütfen temiz, yeni yıkanmış bir dondurma kaşığı kullanın.",
    restaurant:
      "Çocuğumun ciddi bir yer fıstığı alerjisi var. Hangi yemekler yer fıstığı içermez ve bulaşma riski taşımaz? Lütfen yemeği temiz mutfak gereçleri ve yüzeylerle hazırlayın.",
    bakery:
      "Çocuğumun ciddi bir yer fıstığı alerjisi var. Hangi unlu mamuller yer fıstığı içermez ve bulaşma riski taşımaz? Lütfen temiz mutfak gereçleri kullanın.",
    general:
      "Çocuğumun ciddi bir yer fıstığı alerjisi var. Çok küçük bir miktar bile tehlikeli olabilir. Lütfen yemeğin yer fıstığı içermediğinden ve bulaşma riski olmadan hazırlandığından emin olun.",
  },
  ru: {
    icecream:
      "У моего ребёнка тяжёлая аллергия на арахис. Какие сорта мороженого не содержат арахиса и не имеют риска перекрёстного загрязнения? Пожалуйста, используйте чистую, только что вымытую ложку для мороженого.",
    restaurant:
      "У моего ребёнка тяжёлая аллергия на арахис. Какие блюда не содержат арахиса и не имеют риска перекрёстного загрязнения? Пожалуйста, готовьте еду чистой посудой и на чистых поверхностях.",
    bakery:
      "У моего ребёнка тяжёлая аллергия на арахис. Какая выпечка не содержит арахиса и не имеет риска перекрёстного загрязнения? Пожалуйста, используйте чистые инструменты.",
    general:
      "У моего ребёнка тяжёлая аллергия на арахис. Даже очень небольшое количество может быть опасным. Пожалуйста, убедитесь, что еда не содержит арахиса и приготовлена без риска перекрёстного загрязнения.",
  },
  ar: {
    icecream:
      "طفلي يعاني من حساسية شديدة تجاه الفول السوداني. ما هي النكهات الخالية من الفول السوداني ومن أي خطر للتلوث؟ من فضلك استخدم ملعقة آيس كريم نظيفة ومغسولة حديثاً.",
    restaurant:
      "طفلي يعاني من حساسية شديدة تجاه الفول السوداني. ما هي الأطباق الخالية من الفول السوداني ومن أي خطر للتلوث؟ من فضلك حضّر الطعام بأدوات وأسطح نظيفة.",
    bakery:
      "طفلي يعاني من حساسية شديدة تجاه الفول السوداني. ما هي المخبوزات الخالية من الفول السوداني ومن أي خطر للتلوث؟ من فضلك استخدم أدوات نظيفة.",
    general:
      "طفلي يعاني من حساسية شديدة تجاه الفول السوداني. حتى الكمية الصغيرة جداً قد تكون خطيرة. من فضلك تأكد من أن الطعام لا يحتوي على الفول السوداني وأنه محضّر دون أي خطر للتلوث.",
  },
  zh: {
    icecream:
      "我的孩子对花生有严重过敏。哪些口味不含花生，并且没有交叉污染的风险？请使用干净的、刚清洗过的冰淇淋勺。",
    restaurant:
      "我的孩子对花生有严重过敏。哪些菜品不含花生，并且没有交叉污染的风险？请使用干净的餐具和台面来准备食物。",
    bakery:
      "我的孩子对花生有严重过敏。哪些烘焙食品不含花生，并且没有交叉污染的风险？请使用干净的工具。",
    general:
      "我的孩子对花生有严重过敏。即使极少量也可能很危险。请确保食物不含花生，并且在没有交叉污染风险的情况下制作。",
  },
  ja: {
    icecream:
      "私の子どもはピーナッツ（落花生）に重度のアレルギーがあります。どのフレーバーがピーナッツ不使用で、混入の危険がありませんか？清潔な、洗ったばかりのアイスクリームスプーンを使ってください。",
    restaurant:
      "私の子どもはピーナッツ（落花生）に重度のアレルギーがあります。どの料理がピーナッツ不使用で、混入の危険がありませんか？清潔な調理器具と調理台で調理してください。",
    bakery:
      "私の子どもはピーナッツ（落花生）に重度のアレルギーがあります。どのパン・焼き菓子がピーナッツ不使用で、混入の危険がありませんか？清潔な器具を使ってください。",
    general:
      "私の子どもはピーナッツ（落花生）に重度のアレルギーがあります。ごく少量でも危険な場合があります。食べ物にピーナッツが含まれず、混入の危険なく調理されていることを確認してください。",
  },
};

// English is guaranteed complete (covers every venue, enforced by the tests),
// so it is a total fallback for any language/venue the picker can produce.
const FALLBACK: Record<VenueKey, string> = PHRASES.en as Record<VenueKey, string>;

/** The phrase for a language/venue, falling back to English. */
export function phraseFor(code: string, venue: VenueKey): string {
  return PHRASES[code]?.[venue] ?? FALLBACK[venue];
}

/** The language metadata for a code, falling back to English. */
export function langFor(code: string): PhraseLang {
  return PHRASE_LANGS.find((l) => l.code === code) ?? FALLBACK_LANG;
}

/**
 * Pick the best starting language from the device's preferred languages,
 * matching on the primary subtag (e.g. "pt-BR" → "pt"). Falls back to English.
 */
export function defaultLangCode(preferred: readonly string[] = []): string {
  const known = new Set(PHRASE_LANGS.map((l) => l.code));
  for (const tag of preferred) {
    const primary = tag.toLowerCase().split("-")[0] ?? "";
    if (known.has(primary)) return primary;
  }
  return "en";
}
