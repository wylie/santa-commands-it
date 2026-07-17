export type ValidationResult =
  | {
      valid: true;
      value: string;
    }
  | {
      valid: false;
      value: string;
      error: string;
    };

export function validateName(input: string, maximum: number): ValidationResult {
  const value = input.trim();

  if (!value) {
    return {
      valid: false,
      value,
      error: 'Please tell Santa what to call you.',
    };
  }

  if (value.length > maximum) {
    return {
      valid: false,
      value,
      error: `Santa can only consider names up to ${maximum} characters.`,
    };
  }

  return {
    valid: true,
    value,
  };
}

export function validateRequest(
  input: string,
  maximum: number,
): ValidationResult {
  const value = input.trim();

  if (!value) {
    return {
      valid: false,
      value,
      error: 'Please tell Santa what you would like.',
    };
  }

  if (value.length > maximum) {
    return {
      valid: false,
      value,
      error: `Santa can only consider requests up to ${maximum} characters.`,
    };
  }

  return {
    valid: true,
    value,
  };
}

export function validateOptionalNote(
  input: string,
  maximum: number,
): ValidationResult {
  return validateOptionalText(
    input,
    maximum,
    `Please keep report notes to ${maximum} characters or fewer.`,
  );
}

export function validateOptionalText(
  input: string,
  maximum: number,
  errorMessage: string,
): ValidationResult {
  const value = input.trim();

  if (!value) {
    return {
      valid: true,
      value: '',
    };
  }

  if (value.length > maximum) {
    return {
      valid: false,
      value,
      error: errorMessage,
    };
  }

  return {
    valid: true,
    value,
  };
}
