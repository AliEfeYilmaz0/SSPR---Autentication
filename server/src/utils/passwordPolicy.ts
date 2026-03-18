const upperCase = /[A-Z]/;
const lowerCase = /[a-z]/;
const number = /[0-9]/;
const special = /[^A-Za-z0-9]/;

export const validatePasswordPolicy = (password: string) => {
  const errors: string[] = [];

  if (password.length < 8) errors.push("min_length");
  if (!upperCase.test(password)) errors.push("uppercase");
  if (!lowerCase.test(password)) errors.push("lowercase");
  if (!number.test(password)) errors.push("number");
  if (!special.test(password)) errors.push("special");

  return {
    valid: errors.length === 0,
    errors,
  };
};
