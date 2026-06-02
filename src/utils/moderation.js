const PROFANITY = ["damn", "shit", "fuck", "bastard", "idiot"];
const SPAM_PATTERNS = [/https?:\/\//i, /(.)\1{6,}/, /\b(?:buy now|free money|click here)\b/i];

export const moderateComment = (content) => {
  const normalizedContent = content.toLowerCase();
  const profanityMatch = PROFANITY.find((word) => normalizedContent.includes(word));
  const spamMatch = SPAM_PATTERNS.find((pattern) => pattern.test(content));

  if (profanityMatch) {
    return {
      accepted: false,
      reason: "Comment failed moderation for profanity.",
    };
  }

  if (spamMatch) {
    return {
      accepted: false,
      reason: "Comment failed moderation for spam-like content.",
    };
  }

  return {
    accepted: true,
    reason: "",
  };
};
