import { badRequest } from "./http.js";

export const readString = (value, fieldName, options = {}) => {
  const {
    required = false,
    min = 0,
    max = 500,
    lowercase = false,
  } = options;
  const normalizedValue = typeof value === "string" ? value.trim() : "";

  if (!normalizedValue) {
    if (required) {
      throw badRequest(`${fieldName} is required`);
    }

    return "";
  }

  if (normalizedValue.length < min) {
    throw badRequest(`${fieldName} must be at least ${min} characters`);
  }

  if (normalizedValue.length > max) {
    throw badRequest(`${fieldName} must be ${max} characters or fewer`);
  }

  return lowercase ? normalizedValue.toLowerCase() : normalizedValue;
};

export const readOptionalBoolean = (value) => value === true || value === "true";

export const readPage = (value) => Math.max(1, Number.parseInt(value, 10) || 1);
