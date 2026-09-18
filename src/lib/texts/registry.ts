/**
 * The texts an admin can edit at /admin/texts. To make another text editable,
 * add an entry here and render it with loadText() + <RichText>. `defaultBody`
 * is what the page shows until someone saves a version.
 *
 * Format (see RichText): a blank line starts a new paragraph, "## " a heading,
 * "- " a list item, **bold**, and [link text](https://… | mailto:… | /path).
 */

/** Where people write about accessibility and privacy. */
export const CONTACT_EMAIL = "guy@skeelz.co.il";

export interface EditableText {
  key: string;
  title: string;
  /** The page that shows the text. */
  path: string;
  description: string;
  defaultBody: string;
  /** Shown as the page's "last updated" until the first saved version. */
  defaultUpdated: string;
}

const contact = `[${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})`;

export const TEXTS: EditableText[] = [
  {
    key: "home_hero",
    title: "פתיח בעמוד המשרות",
    path: "/",
    description: "שורה או שתיים מתחת לכותרת “המשרות שלנו”.",
    defaultUpdated: "18.09.2026",
    defaultBody: "חפשו את התפקיד הבא שלכם לפי אזור, כישורים והיקף משרה.",
  },
  {
    key: "about",
    title: "אודות",
    path: "/about",
    description: "עמוד האודות, מקושר מהפוטר.",
    defaultUpdated: "18.09.2026",
    defaultBody: `## SKEELZ

SKEELZ מחברת בין מעסיקים לבין מועמדים ומועמדות לפי הכישורים שלהם, ולא רק לפי קורות החיים.

בלוח המשרות מתפרסמות משרות פעילות של המעסיקים שעובדים איתנו. בכל משרה מופיעים הכישורים שהיא דורשת, ואפשר להגיש מועמדות ישירות מהעמוד.`,
  },
  {
    key: "footer",
    title: "קישורים בפוטר",
    path: "/",
    description: "הקישורים שבפוטר, ליד מדיניות הפרטיות והצהרת הנגישות. כל שורה “- [טקסט](קישור)” היא קישור.",
    defaultUpdated: "18.09.2026",
    defaultBody: `- [אודות](/about)
- [יצירת קשר](https://www.skeelz.co.il/%d7%99%d7%a6%d7%99%d7%a8%d7%aa-%d7%a7%d7%a9%d7%a8/)`,
  },
  {
    key: "privacy",
    title: "מדיניות פרטיות",
    path: "/privacy",
    description: "מקושרת מהפוטר ומטופס ההגשה.",
    defaultUpdated: "18.09.2026",
    defaultBody: `## מה נשמר
כשמגישים מועמדות או נרשמים באתר נשמרים שם פרטי ושם משפחה, כתובת מייל, טלפון ועיר מגורים (אם מולאה), מועד ההסכמה לתנאים, והמשרות שאליהן הוגשה מועמדות.

## קורות חיים
קובץ קורות החיים **אינו נשמר באתר** — לא במסד הנתונים, לא בשרת ולא ביומנים. הוא מועבר ישירות ובאופן מאובטח למערכת הגיוס של SKEELZ, ומשמש רק לטיפול במועמדות.

## למה המידע משמש
להעברת המועמדות למעסיק ולקשר איתך בנוגע אליה. המידע אינו נמכר ואינו מועבר לצד שלישי מלבד המעסיק שאליו הוגשה המועמדות וספקי התשתית של האתר.

## עיון, תיקון ומחיקה
לעיון במידע, לתיקונו או למחיקתו, או לכל שאלה בנושא פרטיות, אפשר לפנות אל ${contact}.`,
  },
  {
    key: "accessibility",
    title: "הצהרת נגישות",
    path: "/accessibility",
    description: "נדרשת לפי תקנות הנגישות. מקושרת מהפוטר.",
    defaultUpdated: "18.09.2026",
    defaultBody: `האתר הותאם לתקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע״ג-2013, ולתקן הישראלי ת״י 5568 ברמה AA (WCAG 2.1).

- אפשר לנווט בכל האתר במקלדת ובקורא מסך.
- הניגודיות בין הטקסט לרקע עומדת בתקן.
- האתר מותאם לטלפונים ולהגדלת טקסט.
- לטפסים יש תוויות, והודעות שגיאה מוקראות.

תיאורי המשרות מגיעים מהמעסיקים ומוצגים כפי שנכתבו, ועשויים שלא להיות נגישים במלואם. נתקלתם בקושי? נשמח לשמוע ולטפל: ${contact}.`,
  },
];

export const findText = (key: string): EditableText | undefined => TEXTS.find((t) => t.key === key);

/** The author recorded on the version that preserves the built-in text, before the first edit replaces it. */
export const ORIGINAL_AUTHOR = "הטקסט המקורי";

export const MAX_TEXT_LENGTH = 50_000;
