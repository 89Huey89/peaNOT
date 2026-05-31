/**
 * Ready-to-show allergy phrases for handing the phone to staff in a shop or
 * restaurant abroad. The card now reflects the allergens the user selected for
 * scanning (see usePrefs.selectedAllergens), so a child allergic to e.g. milk
 * and egg gets a card that names exactly those — not a hard-coded peanut card.
 *
 * SAFETY-CRITICAL: these sentences are shown to staff who decide what a child
 * with a life-threatening allergy may eat. Translations must be reviewed by a
 * human before changing.
 *
 * To stay safe across 16 languages with any combination of allergens, the card
 * is built from three reviewed parts instead of interpolating allergen names
 * mid-sentence (which would break gender/case/article agreement in most
 * languages):
 *   1. a LEAD sentence that introduces the allergy and ends with a colon list
 *      placeholder `{LIST}` — a colon list takes citation forms, so no
 *      declension is needed;
 *   2. the joined allergen TERMS (one citation form per allergen per language);
 *   3. a VENUE sentence asking which items are safe + a venue-specific
 *      cross-contamination request (clean/fresh tools and serving area at a
 *      counter; a question about shared fryer/grill/utensils at a restaurant).
 * Every language must cover every venue and every allergen (enforced by
 * lib/phrases.test.ts) so a picked language/allergen can never fall to silence.
 */

import { ALLERGEN_KEYS, getProfile } from "@/lib/allergens/profile";

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

interface LangPhrase {
  /**
   * Intro sentence(s). MUST contain `{LIST}`, which is replaced by the joined,
   * comma-separated allergen terms. Ends the sentence itself (incl. final
   * punctuation) so the venue sentence can simply follow.
   */
  lead: string;
  /** Separator between allergen terms in the list (locale-appropriate comma). */
  sep: string;
  /** Venue question + cross-contamination request, referring back to "these allergens". */
  venues: Record<VenueKey, string>;
}

/**
 * Per-language phrasing. The venue sentences mirror the previously reviewed
 * peanut wording, with the allergen-specific clause generalised to
 * "these allergens" (the concrete list lives in the lead).
 *
 * The cross-contamination request is tailored per venue: at a counter (ice
 * cream, bakery) it asks for clean/fresh tools and serving from an untouched
 * area; at a restaurant it asks the kitchen to flag shared fryer/grill/utensils
 * — the actual contamination vectors there — instead of issuing a generic
 * "use clean tools" instruction a professional kitchen already follows.
 *
 * SAFETY-CRITICAL / TRANSLATION STATUS: the restaurant and ice-cream venue
 * sentences below were revised in bulk and are NOT yet human-reviewed by native
 * speakers. They must be verified before being relied on.
 */
export const LANG_PHRASES: Record<string, LangPhrase> = {
  de: {
    lead: "Mein Kind hat eine schwere, lebensbedrohliche Allergie. Schon kleinste Mengen können gefährlich sein. Es darf keines der folgenden Allergene zu sich nehmen: {LIST}.",
    sep: ", ",
    venues: {
      icecream:
        "Welche Eissorten sind frei von diesen Allergenen und ohne Risiko einer Verunreinigung? Bitte verwenden Sie einen sauberen, frisch abgewaschenen Portionierer und entnehmen Sie das Eis aus einem unberührten Bereich der Eiswanne.",
      restaurant:
        "Welche Gerichte sind frei von diesen Allergenen und ohne Risiko einer Verunreinigung? Bitte sagen Sie mir, ob das Gericht mit einer Fritteuse, einem Grill oder Geräten zubereitet wird, die auch für diese Allergene verwendet werden.",
      bakery:
        "Welche Backwaren sind frei von diesen Allergenen und ohne Risiko einer Verunreinigung? Bitte verwenden Sie sauberes Werkzeug.",
      general:
        "Bitte stellen Sie sicher, dass das Essen keines dieser Allergene enthält und ohne Risiko einer Verunreinigung zubereitet wird.",
    },
  },
  en: {
    lead: "My child has a severe, life-threatening allergy. Even the smallest amount can be dangerous. They must not eat any of the following: {LIST}.",
    sep: ", ",
    venues: {
      icecream:
        "Which flavours are free from these allergens and free from any risk of cross-contamination? Please use a clean, freshly washed scoop and serve from an untouched part of the tub.",
      restaurant:
        "Which dishes are free from these allergens and free from any risk of cross-contamination? Please tell me if the dish is prepared using a fryer, grill or utensils shared with these allergens.",
      bakery:
        "Which baked goods are free from these allergens and free from any risk of cross-contamination? Please use clean utensils.",
      general:
        "Please make sure the food contains none of these allergens and is prepared without any risk of cross-contamination.",
    },
  },
  it: {
    lead: "Mio figlio ha un'allergia grave e potenzialmente letale. Anche una piccolissima quantità può essere pericolosa. Non deve assumere nessuno dei seguenti allergeni: {LIST}.",
    sep: ", ",
    venues: {
      icecream:
        "Quali gusti sono senza questi allergeni e senza rischio di contaminazione? Per favore, usi una paletta pulita e appena lavata e prenda il gelato da una parte non ancora toccata della vaschetta.",
      restaurant:
        "Quali piatti sono senza questi allergeni e senza rischio di contaminazione? Per favore, mi avvisi se il piatto viene preparato con friggitrice, griglia o utensili usati anche per questi allergeni.",
      bakery:
        "Quali prodotti da forno sono senza questi allergeni e senza rischio di contaminazione? Per favore, usi utensili puliti.",
      general:
        "Per favore, si assicuri che il cibo non contenga nessuno di questi allergeni e sia preparato senza rischio di contaminazione.",
    },
  },
  fr: {
    lead: "Mon enfant a une allergie grave, potentiellement mortelle. Même une très petite quantité peut être dangereuse. Il ne doit consommer aucun des allergènes suivants : {LIST}.",
    sep: ", ",
    venues: {
      icecream:
        "Quels parfums sont sans ces allergènes et sans risque de contamination ? Merci d'utiliser une cuillère à glace propre et fraîchement lavée et de prélever la glace dans une partie intacte du bac.",
      restaurant:
        "Quels plats sont sans ces allergènes et sans risque de contamination ? Merci de me dire si le plat est préparé avec une friteuse, un grill ou des ustensiles également utilisés pour ces allergènes.",
      bakery:
        "Quels produits sont sans ces allergènes et sans risque de contamination ? Merci d'utiliser des ustensiles propres.",
      general:
        "Merci de vous assurer que le plat ne contient aucun de ces allergènes et qu'il est préparé sans risque de contamination.",
    },
  },
  es: {
    lead: "Mi hijo tiene una alergia grave y potencialmente mortal. Incluso una cantidad muy pequeña puede ser peligrosa. No debe consumir ninguno de los siguientes alérgenos: {LIST}.",
    sep: ", ",
    venues: {
      icecream:
        "¿Qué sabores no contienen estos alérgenos y no tienen riesgo de contaminación? Por favor, use una cuchara de helado limpia y recién lavada y sirva el helado de una parte intacta de la cubeta.",
      restaurant:
        "¿Qué platos no contienen estos alérgenos y no tienen riesgo de contaminación? Por favor, dígame si el plato se prepara con una freidora, una parrilla o utensilios que también se usan para estos alérgenos.",
      bakery:
        "¿Qué productos no contienen estos alérgenos y no tienen riesgo de contaminación? Por favor, use utensilios limpios.",
      general:
        "Por favor, asegúrese de que la comida no contenga ninguno de estos alérgenos y se prepare sin riesgo de contaminación.",
    },
  },
  pt: {
    lead: "O meu filho tem uma alergia grave e potencialmente fatal. Mesmo uma quantidade muito pequena pode ser perigosa. Não pode consumir nenhum dos seguintes alérgenos: {LIST}.",
    sep: ", ",
    venues: {
      icecream:
        "Quais sabores não contêm estes alérgenos e não têm risco de contaminação? Por favor, use uma colher de gelado limpa e acabada de lavar e retire o gelado de uma parte intacta da cuba.",
      restaurant:
        "Quais pratos não contêm estes alérgenos e não têm risco de contaminação? Por favor, diga-me se o prato é preparado com fritadeira, grelha ou utensílios também usados para estes alérgenos.",
      bakery:
        "Quais produtos não contêm estes alérgenos e não têm risco de contaminação? Por favor, use utensílios limpos.",
      general:
        "Por favor, certifique-se de que a comida não contém nenhum destes alérgenos e é preparada sem risco de contaminação.",
    },
  },
  nl: {
    lead: "Mijn kind heeft een ernstige, levensbedreigende allergie. Zelfs een heel kleine hoeveelheid kan gevaarlijk zijn. Het mag geen van de volgende allergenen binnenkrijgen: {LIST}.",
    sep: ", ",
    venues: {
      icecream:
        "Welke smaken zijn vrij van deze allergenen en zonder risico op kruisbesmetting? Gebruik alstublieft een schone, net gewassen ijslepel en schep het ijs uit een onaangeroerd deel van de bak.",
      restaurant:
        "Welke gerechten zijn vrij van deze allergenen en zonder risico op kruisbesmetting? Vertel me alstublieft of het gerecht wordt bereid met een friteuse, grill of keukengerei die ook voor deze allergenen worden gebruikt.",
      bakery:
        "Welke gebakken producten zijn vrij van deze allergenen en zonder risico op kruisbesmetting? Gebruik alstublieft schoon gereedschap.",
      general:
        "Zorg er alstublieft voor dat het eten geen van deze allergenen bevat en zonder risico op kruisbesmetting wordt bereid.",
    },
  },
  pl: {
    lead: "Moje dziecko ma ciężką, zagrażającą życiu alergię. Nawet niewielka ilość może być niebezpieczna. Nie może spożywać żadnego z następujących alergenów: {LIST}.",
    sep: ", ",
    venues: {
      icecream:
        "Które smaki są wolne od tych alergenów i bez ryzyka zanieczyszczenia? Proszę użyć czystej, świeżo umytej łyżki do lodów i nabrać lody z nienaruszonej części pojemnika.",
      restaurant:
        "Które dania są wolne od tych alergenów i bez ryzyka zanieczyszczenia? Proszę mi powiedzieć, czy danie jest przygotowywane we frytownicy, na grillu lub przy użyciu naczyń używanych również do tych alergenów.",
      bakery:
        "Które wypieki są wolne od tych alergenów i bez ryzyka zanieczyszczenia? Proszę użyć czystych narzędzi.",
      general:
        "Proszę upewnić się, że jedzenie nie zawiera żadnego z tych alergenów i jest przygotowane bez ryzyka zanieczyszczenia.",
    },
  },
  cs: {
    lead: "Moje dítě má těžkou, život ohrožující alergii. I velmi malé množství může být nebezpečné. Nesmí konzumovat žádný z následujících alergenů: {LIST}.",
    sep: ", ",
    venues: {
      icecream:
        "Které příchutě jsou bez těchto alergenů a bez rizika kontaminace? Použijte prosím čistou, čerstvě umytou lžíci na zmrzlinu a naberte zmrzlinu z nedotčené části vaničky.",
      restaurant:
        "Která jídla jsou bez těchto alergenů a bez rizika kontaminace? Řekněte mi prosím, zda se jídlo připravuje ve fritéze, na grilu nebo s náčiním, které se používá i pro tyto alergeny.",
      bakery:
        "Které pečivo je bez těchto alergenů a bez rizika kontaminace? Použijte prosím čisté náčiní.",
      general:
        "Ujistěte se prosím, že jídlo neobsahuje žádný z těchto alergenů a je připraveno bez rizika kontaminace.",
    },
  },
  hr: {
    lead: "Moje dijete ima tešku, po život opasnu alergiju. Čak i vrlo mala količina može biti opasna. Ne smije konzumirati nijedan od sljedećih alergena: {LIST}.",
    sep: ", ",
    venues: {
      icecream:
        "Koji su okusi bez ovih alergena i bez rizika od kontaminacije? Molim vas, upotrijebite čistu, svježe opranu žlicu za sladoled i uzmite sladoled iz nedirnutog dijela posude.",
      restaurant:
        "Koja su jela bez ovih alergena i bez rizika od kontaminacije? Molim vas, recite mi priprema li se jelo u fritezi, na roštilju ili priborom koji se koristi i za ove alergene.",
      bakery:
        "Koji su pekarski proizvodi bez ovih alergena i bez rizika od kontaminacije? Molim vas, upotrijebite čisti pribor.",
      general:
        "Molim vas, osigurajte da hrana ne sadrži nijedan od ovih alergena i da je pripremljena bez rizika od kontaminacije.",
    },
  },
  el: {
    lead: "Το παιδί μου έχει σοβαρή, απειλητική για τη ζωή αλλεργία. Ακόμη και μια πολύ μικρή ποσότητα μπορεί να είναι επικίνδυνη. Δεν πρέπει να καταναλώσει κανένα από τα παρακάτω αλλεργιογόνα: {LIST}.",
    sep: ", ",
    venues: {
      icecream:
        "Ποιες γεύσεις είναι χωρίς αυτά τα αλλεργιογόνα και χωρίς κίνδυνο επιμόλυνσης; Παρακαλώ χρησιμοποιήστε μια καθαρή, φρεσκοπλυμένη σέσουλα παγωτού και πάρτε το παγωτό από ένα ανέγγιχτο σημείο του δοχείου.",
      restaurant:
        "Ποια πιάτα είναι χωρίς αυτά τα αλλεργιογόνα και χωρίς κίνδυνο επιμόλυνσης; Παρακαλώ πείτε μου αν το πιάτο παρασκευάζεται με φριτέζα, γκριλ ή σκεύη που χρησιμοποιούνται και για αυτά τα αλλεργιογόνα.",
      bakery:
        "Ποια προϊόντα είναι χωρίς αυτά τα αλλεργιογόνα και χωρίς κίνδυνο επιμόλυνσης; Παρακαλώ χρησιμοποιήστε καθαρά σκεύη.",
      general:
        "Παρακαλώ βεβαιωθείτε ότι το φαγητό δεν περιέχει κανένα από αυτά τα αλλεργιογόνα και ότι παρασκευάζεται χωρίς κίνδυνο επιμόλυνσης.",
    },
  },
  tr: {
    lead: "Çocuğumun ciddi, hayatı tehdit eden bir alerjisi var. Çok küçük bir miktar bile tehlikeli olabilir. Aşağıdaki alerjenlerin hiçbirini tüketmemelidir: {LIST}.",
    sep: ", ",
    venues: {
      icecream:
        "Hangi dondurma çeşitleri bu alerjenleri içermez ve bulaşma riski taşımaz? Lütfen temiz, yeni yıkanmış bir dondurma kaşığı kullanın ve dondurmayı kabın dokunulmamış bir bölümünden alın.",
      restaurant:
        "Hangi yemekler bu alerjenleri içermez ve bulaşma riski taşımaz? Lütfen yemeğin, bu alerjenler için de kullanılan bir fritöz, ızgara veya mutfak gereçleriyle hazırlanıp hazırlanmadığını söyleyin.",
      bakery:
        "Hangi unlu mamuller bu alerjenleri içermez ve bulaşma riski taşımaz? Lütfen temiz mutfak gereçleri kullanın.",
      general:
        "Lütfen yemeğin bu alerjenlerin hiçbirini içermediğinden ve bulaşma riski olmadan hazırlandığından emin olun.",
    },
  },
  ru: {
    lead: "У моего ребёнка тяжёлая, опасная для жизни аллергия. Даже очень небольшое количество может быть опасным. Ему нельзя употреблять ни один из следующих аллергенов: {LIST}.",
    sep: ", ",
    venues: {
      icecream:
        "Какие сорта мороженого не содержат этих аллергенов и не имеют риска перекрёстного загрязнения? Пожалуйста, используйте чистую, только что вымытую ложку для мороженого и набирайте мороженое из нетронутой части контейнера.",
      restaurant:
        "Какие блюда не содержат этих аллергенов и не имеют риска перекрёстного загрязнения? Пожалуйста, сообщите мне, готовится ли блюдо во фритюрнице, на гриле или с использованием посуды, которая также используется для этих аллергенов.",
      bakery:
        "Какая выпечка не содержит этих аллергенов и не имеет риска перекрёстного загрязнения? Пожалуйста, используйте чистые инструменты.",
      general:
        "Пожалуйста, убедитесь, что еда не содержит ни одного из этих аллергенов и приготовлена без риска перекрёстного загрязнения.",
    },
  },
  ar: {
    lead: "طفلي يعاني من حساسية شديدة قد تهدد حياته. حتى الكمية الصغيرة جداً قد تكون خطيرة. يجب ألا يتناول أيًّا من المواد المسبّبة للحساسية التالية: {LIST}.",
    sep: "، ",
    venues: {
      icecream:
        "ما هي النكهات الخالية من هذه المواد المسبّبة للحساسية ومن أي خطر للتلوث؟ من فضلك استخدم ملعقة آيس كريم نظيفة ومغسولة حديثاً وخذ الآيس كريم من جزء لم يُلمس من العلبة.",
      restaurant:
        "ما هي الأطباق الخالية من هذه المواد المسبّبة للحساسية ومن أي خطر للتلوث؟ من فضلك أخبرني إذا كان الطبق يُحضَّر باستخدام مقلاة أو شواية أو أدوات تُستخدم أيضاً مع هذه المواد المسبّبة للحساسية.",
      bakery:
        "ما هي المخبوزات الخالية من هذه المواد المسبّبة للحساسية ومن أي خطر للتلوث؟ من فضلك استخدم أدوات نظيفة.",
      general:
        "من فضلك تأكد من أن الطعام لا يحتوي على أيٍّ من هذه المواد المسبّبة للحساسية وأنه محضّر دون أي خطر للتلوث.",
    },
  },
  zh: {
    lead: "我的孩子有严重的、可能危及生命的过敏。即使极少量也可能很危险。他/她绝对不能食用以下任何一种致敏物：{LIST}。",
    sep: "、",
    venues: {
      icecream:
        "哪些口味不含这些致敏物，并且没有交叉污染的风险？请使用干净的、刚清洗过的冰淇淋勺，并从未被取用过的部分挖取冰淇淋。",
      restaurant:
        "哪些菜品不含这些致敏物，并且没有交叉污染的风险？请告诉我这道菜是否使用了也用于这些致敏物的油炸锅、烤架或餐具来准备。",
      bakery:
        "哪些烘焙食品不含这些致敏物，并且没有交叉污染的风险？请使用干净的工具。",
      general:
        "请确保食物不含任何这些致敏物，并且在没有交叉污染风险的情况下制作。",
    },
  },
  ja: {
    lead: "私の子どもには重度の、生命に関わるアレルギーがあります。ごく少量でも危険な場合があります。以下のアレルゲンを一切口にできません：{LIST}。",
    sep: "、",
    venues: {
      icecream:
        "どのフレーバーがこれらのアレルゲンを含まず、混入の危険がありませんか？清潔な、洗ったばかりのアイスクリームスプーンを使い、まだ手をつけていない部分からアイスクリームをすくってください。",
      restaurant:
        "どの料理がこれらのアレルゲンを含まず、混入の危険がありませんか？この料理が、これらのアレルゲンにも使われるフライヤー、グリル、または調理器具で作られているかどうか教えてください。",
      bakery:
        "どのパン・焼き菓子がこれらのアレルゲンを含まず、混入の危険がありませんか？清潔な器具を使ってください。",
      general:
        "食べ物にこれらのアレルゲンが含まれず、混入の危険なく調理されていることを確認してください。",
    },
  },
};

/**
 * Citation form of each allergen per language, in the form that reads naturally
 * in a colon-separated list (e.g. "milk, eggs"). Keys are allergen keys from
 * lib/allergens/profile.ts. Every language covers every allergen (enforced by
 * the tests) so a selected allergen can never go untranslated.
 *
 * SAFETY-CRITICAL: a wrong or missing term here means staff are told the wrong
 * allergen. Human review required before changing.
 */
export const ALLERGEN_TERMS: Record<string, Record<string, string>> = {
  de: {
    peanut: "Erdnüsse",
    "tree-nuts": "Schalenfrüchte (Nüsse)",
    hazelnut: "Haselnüsse",
    almond: "Mandeln",
    walnut: "Walnüsse",
    cashew: "Cashewnüsse",
    pistachio: "Pistazien",
    pecan: "Pekannüsse",
    brazilnut: "Paranüsse",
    macadamia: "Macadamianüsse",
    soy: "Soja",
    gluten: "Gluten (glutenhaltiges Getreide)",
    milk: "Milch",
    eggs: "Eier",
    sesame: "Sesam",
    fish: "Fisch",
    crustaceans: "Krebstiere",
    molluscs: "Weichtiere",
    celery: "Sellerie",
    mustard: "Senf",
    lupin: "Lupinen",
    sulphites: "Sulfite",
  },
  en: {
    peanut: "peanuts",
    "tree-nuts": "tree nuts",
    hazelnut: "hazelnuts",
    almond: "almonds",
    walnut: "walnuts",
    cashew: "cashews",
    pistachio: "pistachios",
    pecan: "pecans",
    brazilnut: "Brazil nuts",
    macadamia: "macadamia nuts",
    soy: "soy",
    gluten: "gluten (cereals containing gluten)",
    milk: "milk",
    eggs: "eggs",
    sesame: "sesame",
    fish: "fish",
    crustaceans: "crustaceans",
    molluscs: "molluscs",
    celery: "celery",
    mustard: "mustard",
    lupin: "lupin",
    sulphites: "sulphites",
  },
  it: {
    peanut: "arachidi",
    "tree-nuts": "frutta a guscio",
    hazelnut: "nocciole",
    almond: "mandorle",
    walnut: "noci",
    cashew: "anacardi",
    pistachio: "pistacchi",
    pecan: "noci pecan",
    brazilnut: "noci del Brasile",
    macadamia: "noci di macadamia",
    soy: "soia",
    gluten: "glutine",
    milk: "latte",
    eggs: "uova",
    sesame: "sesamo",
    fish: "pesce",
    crustaceans: "crostacei",
    molluscs: "molluschi",
    celery: "sedano",
    mustard: "senape",
    lupin: "lupini",
    sulphites: "solfiti",
  },
  fr: {
    peanut: "arachides (cacahuètes)",
    "tree-nuts": "fruits à coque",
    hazelnut: "noisettes",
    almond: "amandes",
    walnut: "noix",
    cashew: "noix de cajou",
    pistachio: "pistaches",
    pecan: "noix de pécan",
    brazilnut: "noix du Brésil",
    macadamia: "noix de macadamia",
    soy: "soja",
    gluten: "gluten",
    milk: "lait",
    eggs: "œufs",
    sesame: "sésame",
    fish: "poisson",
    crustaceans: "crustacés",
    molluscs: "mollusques",
    celery: "céleri",
    mustard: "moutarde",
    lupin: "lupin",
    sulphites: "sulfites",
  },
  es: {
    peanut: "cacahuetes (maní)",
    "tree-nuts": "frutos de cáscara",
    hazelnut: "avellanas",
    almond: "almendras",
    walnut: "nueces",
    cashew: "anacardos",
    pistachio: "pistachos",
    pecan: "nueces pecanas",
    brazilnut: "nueces de Brasil",
    macadamia: "nueces de macadamia",
    soy: "soja",
    gluten: "gluten",
    milk: "leche",
    eggs: "huevos",
    sesame: "sésamo",
    fish: "pescado",
    crustaceans: "crustáceos",
    molluscs: "moluscos",
    celery: "apio",
    mustard: "mostaza",
    lupin: "altramuces",
    sulphites: "sulfitos",
  },
  pt: {
    peanut: "amendoim",
    "tree-nuts": "frutos de casca rija",
    hazelnut: "avelãs",
    almond: "amêndoas",
    walnut: "nozes",
    cashew: "castanhas de caju",
    pistachio: "pistácios",
    pecan: "nozes-pecã",
    brazilnut: "castanhas-do-pará",
    macadamia: "nozes-macadâmia",
    soy: "soja",
    gluten: "glúten",
    milk: "leite",
    eggs: "ovos",
    sesame: "sésamo",
    fish: "peixe",
    crustaceans: "crustáceos",
    molluscs: "moluscos",
    celery: "aipo",
    mustard: "mostarda",
    lupin: "tremoço",
    sulphites: "sulfitos",
  },
  nl: {
    peanut: "pinda's",
    "tree-nuts": "noten",
    hazelnut: "hazelnoten",
    almond: "amandelen",
    walnut: "walnoten",
    cashew: "cashewnoten",
    pistachio: "pistachenoten",
    pecan: "pecannoten",
    brazilnut: "paranoten",
    macadamia: "macadamianoten",
    soy: "soja",
    gluten: "gluten",
    milk: "melk",
    eggs: "eieren",
    sesame: "sesam",
    fish: "vis",
    crustaceans: "schaaldieren",
    molluscs: "weekdieren",
    celery: "selderij",
    mustard: "mosterd",
    lupin: "lupine",
    sulphites: "sulfiet",
  },
  pl: {
    peanut: "orzeszki ziemne",
    "tree-nuts": "orzechy",
    hazelnut: "orzechy laskowe",
    almond: "migdały",
    walnut: "orzechy włoskie",
    cashew: "orzechy nerkowca",
    pistachio: "pistacje",
    pecan: "orzechy pekan",
    brazilnut: "orzechy brazylijskie",
    macadamia: "orzechy makadamia",
    soy: "soja",
    gluten: "gluten",
    milk: "mleko",
    eggs: "jaja",
    sesame: "sezam",
    fish: "ryby",
    crustaceans: "skorupiaki",
    molluscs: "mięczaki",
    celery: "seler",
    mustard: "gorczyca (musztarda)",
    lupin: "łubin",
    sulphites: "siarczyny",
  },
  cs: {
    peanut: "arašídy",
    "tree-nuts": "skořápkové plody (ořechy)",
    hazelnut: "lískové ořechy",
    almond: "mandle",
    walnut: "vlašské ořechy",
    cashew: "kešu ořechy",
    pistachio: "pistácie",
    pecan: "pekanové ořechy",
    brazilnut: "para ořechy",
    macadamia: "makadamové ořechy",
    soy: "sója",
    gluten: "lepek",
    milk: "mléko",
    eggs: "vejce",
    sesame: "sezam",
    fish: "ryby",
    crustaceans: "korýši",
    molluscs: "měkkýši",
    celery: "celer",
    mustard: "hořčice",
    lupin: "vlčí bob (lupina)",
    sulphites: "siřičitany",
  },
  hr: {
    peanut: "kikiriki",
    "tree-nuts": "orašasti plodovi",
    hazelnut: "lješnjaci",
    almond: "bademi",
    walnut: "orasi",
    cashew: "indijski oraščići",
    pistachio: "pistacije",
    pecan: "pekan orasi",
    brazilnut: "brazilski orasi",
    macadamia: "makadamija orasi",
    soy: "soja",
    gluten: "gluten",
    milk: "mlijeko",
    eggs: "jaja",
    sesame: "sezam",
    fish: "riba",
    crustaceans: "rakovi",
    molluscs: "mekušci",
    celery: "celer",
    mustard: "gorušica (senf)",
    lupin: "lupina",
    sulphites: "sulfiti",
  },
  el: {
    peanut: "αράπικα φιστίκια (αραχίδες)",
    "tree-nuts": "ξηροί καρποί",
    hazelnut: "φουντούκια",
    almond: "αμύγδαλα",
    walnut: "καρύδια",
    cashew: "κάσιους",
    pistachio: "φιστίκια Αιγίνης",
    pecan: "πεκάν",
    brazilnut: "καρύδια Βραζιλίας",
    macadamia: "μακαντάμια",
    soy: "σόγια",
    gluten: "γλουτένη",
    milk: "γάλα",
    eggs: "αυγά",
    sesame: "σουσάμι",
    fish: "ψάρι",
    crustaceans: "καρκινοειδή",
    molluscs: "μαλάκια",
    celery: "σέλινο",
    mustard: "μουστάρδα (σινάπι)",
    lupin: "λούπινο",
    sulphites: "θειώδη",
  },
  tr: {
    peanut: "yer fıstığı",
    "tree-nuts": "sert kabuklu yemişler",
    hazelnut: "fındık",
    almond: "badem",
    walnut: "ceviz",
    cashew: "kaju",
    pistachio: "antep fıstığı",
    pecan: "pekan cevizi",
    brazilnut: "Brezilya cevizi",
    macadamia: "makadamya cevizi",
    soy: "soya",
    gluten: "gluten",
    milk: "süt",
    eggs: "yumurta",
    sesame: "susam",
    fish: "balık",
    crustaceans: "kabuklu deniz ürünleri",
    molluscs: "yumuşakçalar",
    celery: "kereviz",
    mustard: "hardal",
    lupin: "acı bakla",
    sulphites: "sülfitler",
  },
  ru: {
    peanut: "арахис",
    "tree-nuts": "орехи",
    hazelnut: "фундук",
    almond: "миндаль",
    walnut: "грецкие орехи",
    cashew: "кешью",
    pistachio: "фисташки",
    pecan: "орехи пекан",
    brazilnut: "бразильские орехи",
    macadamia: "орехи макадамия",
    soy: "соя",
    gluten: "глютен",
    milk: "молоко",
    eggs: "яйца",
    sesame: "кунжут",
    fish: "рыба",
    crustaceans: "ракообразные",
    molluscs: "моллюски",
    celery: "сельдерей",
    mustard: "горчица",
    lupin: "люпин",
    sulphites: "сульфиты",
  },
  ar: {
    peanut: "الفول السوداني",
    "tree-nuts": "المكسرات",
    hazelnut: "البندق",
    almond: "اللوز",
    walnut: "الجوز",
    cashew: "الكاجو",
    pistachio: "الفستق",
    pecan: "جوز البقان",
    brazilnut: "جوز البرازيل",
    macadamia: "جوز المكاديميا",
    soy: "الصويا",
    gluten: "الغلوتين",
    milk: "الحليب",
    eggs: "البيض",
    sesame: "السمسم",
    fish: "السمك",
    crustaceans: "القشريات",
    molluscs: "الرخويات",
    celery: "الكرفس",
    mustard: "الخردل",
    lupin: "الترمس",
    sulphites: "الكبريتيت",
  },
  zh: {
    peanut: "花生",
    "tree-nuts": "坚果",
    hazelnut: "榛子",
    almond: "杏仁",
    walnut: "核桃",
    cashew: "腰果",
    pistachio: "开心果",
    pecan: "碧根果（山核桃）",
    brazilnut: "巴西坚果",
    macadamia: "夏威夷果（澳洲坚果）",
    soy: "大豆",
    gluten: "麸质（含麸质谷物）",
    milk: "牛奶",
    eggs: "鸡蛋",
    sesame: "芝麻",
    fish: "鱼",
    crustaceans: "甲壳类",
    molluscs: "软体动物",
    celery: "芹菜",
    mustard: "芥末",
    lupin: "羽扇豆",
    sulphites: "亚硫酸盐",
  },
  ja: {
    peanut: "ピーナッツ（落花生）",
    "tree-nuts": "ナッツ類（木の実）",
    hazelnut: "ヘーゼルナッツ",
    almond: "アーモンド",
    walnut: "くるみ",
    cashew: "カシューナッツ",
    pistachio: "ピスタチオ",
    pecan: "ペカンナッツ",
    brazilnut: "ブラジルナッツ",
    macadamia: "マカダミアナッツ",
    soy: "大豆",
    gluten: "グルテン（小麦など）",
    milk: "乳（牛乳）",
    eggs: "卵",
    sesame: "ごま",
    fish: "魚",
    crustaceans: "甲殻類（えび・かに）",
    molluscs: "軟体動物（貝類・いか・たこ）",
    celery: "セロリ",
    mustard: "マスタード（からし）",
    lupin: "ルピナス",
    sulphites: "亜硫酸塩",
  },
};

// English is guaranteed complete (every venue + every allergen, enforced by
// the tests), so it is the total fallback. The non-null assertions are safe:
// the "en" entries are defined literally above.
const FALLBACK: LangPhrase = LANG_PHRASES.en!;
const FALLBACK_TERMS: Record<string, string> = ALLERGEN_TERMS.en!;

/** The phrasing block for a language code, falling back to English. */
function langPhrase(code: string): LangPhrase {
  return LANG_PHRASES[code] ?? FALLBACK;
}

/** The translated term for an allergen key, falling back to English then key. */
export function allergenTerm(code: string, key: string): string {
  return ALLERGEN_TERMS[code]?.[key] ?? FALLBACK_TERMS[key] ?? key;
}

/**
 * Keep only allergen keys the app actually knows about, in the given order. If
 * nothing valid remains, fall back to peanut — mirroring the scan engine, which
 * checks peanut when no allergen is selected (see usePrefs / ResultScreen).
 */
function effectiveKeys(allergenKeys: readonly string[]): string[] {
  const known = allergenKeys.filter((k) => getProfile(k));
  return known.length ? known : ["peanut"];
}

/** The joined, comma-separated allergen list for a language. */
export function allergenList(code: string, allergenKeys: readonly string[]): string {
  const { sep } = langPhrase(code);
  return effectiveKeys(allergenKeys)
    .map((k) => allergenTerm(code, k))
    .join(sep);
}

/**
 * The full card text for a language/venue/allergen selection, falling back to
 * English for unknown languages. The lead names the selected allergens; the
 * venue sentence asks which items are safe.
 */
export function phraseFor(
  code: string,
  venue: VenueKey,
  allergenKeys: readonly string[] = [],
): string {
  const lp = langPhrase(code);
  const list = allergenList(code, allergenKeys);
  const lead = lp.lead.replace("{LIST}", list);
  return `${lead} ${lp.venues[venue]}`;
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

/** Re-exported for tests: the canonical allergen keys the card must cover. */
export { ALLERGEN_KEYS };
