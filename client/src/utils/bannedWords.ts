import { BANNED_WORDS as BANNED_WORDS_LIST } from "./bannedWordsList";

const BANNED_WORDS = BANNED_WORDS_LIST;

/**
 * Check if text contains banned words
 * @param text - The text to check
 * @param caseSensitive - Whether the check should be case sensitive (default: false)
 * @returns Object with containsBannedWords boolean and the list of found banned words
 */
export const checkBannedWords = (
  text: string,
  caseSensitive: boolean = false
): {
  containsBannedWords: boolean;
  bannedWordsFound: string[];
} => {
  if (!text || typeof text !== "string") {
    return {
      containsBannedWords: false,
      bannedWordsFound: [],
    };
  }

  const normalizedText = caseSensitive ? text : text.toLowerCase();
  const normalizedBannedWords = caseSensitive
    ? BANNED_WORDS
    : BANNED_WORDS.map((word) => word.toLowerCase());

  // Split text into words and check each word
  // Also check for banned words as substrings to catch variations
  const foundBannedWords: string[] = [];

  for (const bannedWord of normalizedBannedWords) {
    // Check if banned word appears as a whole word
    const wordBoundaryRegex = new RegExp(`\\b${bannedWord}\\b`, "i");

    if (wordBoundaryRegex.test(normalizedText)) {
      // Find the original case version from BANNED_WORDS
      const originalWord = BANNED_WORDS.find(
        (w) => w.toLowerCase() === bannedWord.toLowerCase()
      );
      if (originalWord && !foundBannedWords.includes(originalWord)) {
        foundBannedWords.push(originalWord);
      }
    }
  }

  return {
    containsBannedWords: foundBannedWords.length > 0,
    bannedWordsFound: foundBannedWords,
  };
};

/**
 * Validate text content for banned words
 * @param text - The text to validate
 * @param fieldName - Name of the field being validated (for error messages)
 * @returns Object with isValid boolean and error message if invalid
 */
export const validateTextContent = (
  text: string,
  fieldName: string = "Content"
): {
  isValid: boolean;
  error?: string;
  bannedWordsFound?: string[];
} => {
  if (!text || typeof text !== "string") {
    return {
      isValid: true, // Empty text is valid (length validation handled elsewhere)
      bannedWordsFound: [],
    };
  }

  const result = checkBannedWords(text);

  if (result.containsBannedWords) {
    return {
      isValid: false,
      error: `${fieldName} contains inappropriate language and cannot be used.`,
      bannedWordsFound: result.bannedWordsFound,
    };
  }

  return {
    isValid: true,
    bannedWordsFound: [],
  };
};
