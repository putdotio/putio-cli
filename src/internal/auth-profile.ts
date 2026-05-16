export const AUTH_PROFILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;

export const AUTH_PROFILE_NAME_DESCRIPTION =
  "Profile names must start with a letter or number and may contain letters, numbers, dots, underscores, or hyphens.";

export const normalizeAuthProfileName = (value: string) => {
  const trimmed = value.trim();

  return AUTH_PROFILE_NAME_PATTERN.test(trimmed) ? trimmed : null;
};
