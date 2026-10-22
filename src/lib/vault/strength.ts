const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password123",
  "123456",
  "12345678",
  "123456789",
  "qwerty",
  "qwerty123",
  "letmein",
  "welcome",
  "admin",
  "iloveyou",
  "monkey",
  "dragon",
  "abc123",
  "111111",
  "000000",
  "changeme",
  "secret",
  "master",
  "login",
  "passw0rd",
]);

export type PasswordStrength = {
  score: 0 | 1 | 2 | 3 | 4;
  label: "Very weak" | "Weak" | "Fair" | "Strong" | "Very strong";
  scorePercent: number;
  feedback: string;
};

export function scorePassword(password: string): PasswordStrength {
  const value = password ?? "";
  if (!value) {
    return {
      score: 0,
      label: "Very weak",
      scorePercent: 0,
      feedback: "Enter a password.",
    };
  }

  const lower = value.toLowerCase();
  const common = COMMON_PASSWORDS.has(lower);
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(value)).length;
  const unique = new Set(value).size;
  let points = 0;

  if (value.length >= 8) points += 1;
  if (value.length >= 12) points += 1;
  if (value.length >= 16) points += 1;
  if (value.length >= 20) points += 1;
  if (classes >= 2) points += 1;
  if (classes >= 3) points += 1;
  if (unique >= 8) points += 1;
  if (unique >= 12) points += 1;

  const repeated = /(.)\1{3,}/.test(value);
  const sequence = /(?:0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf)/i.test(value);
  const year = /(?:19|20)\d{2}/.test(value);

  if (common) points = Math.min(points, 1);
  if (repeated) points -= 1;
  if (sequence) points -= 1;
  if (year) points -= 1;
  if (value.length < 8) points = Math.min(points, 1);

  const score = Math.max(0, Math.min(4, Math.floor(points / 2))) as PasswordStrength["score"];
  const labels: PasswordStrength["label"][] = ["Very weak", "Weak", "Fair", "Strong", "Very strong"];
  const feedback = common
    ? "This is one of the most common passwords. Choose something unique."
    : value.length < 12
      ? "Longer is stronger. Aim for at least 12 characters."
      : sequence || repeated
        ? "Avoid runs and repeated characters."
        : year
          ? "Avoid years and predictable numbers."
          : score >= 3
            ? "Good length and variety."
            : "Mix in another character type.";

  return {
    score,
    label: labels[score],
    scorePercent: [8, 28, 52, 76, 100][score],
    feedback,
  };
}

export function isValidMasterPassword(password: string): boolean {
  return password.length >= 12 && scorePassword(password).score >= 2;
}
