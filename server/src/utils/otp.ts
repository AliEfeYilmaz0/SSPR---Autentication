export const generateOtp = (): string => {
  const value = Math.floor(100000 + Math.random() * 900000);
  return String(value);
};
