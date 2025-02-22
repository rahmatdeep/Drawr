export function generateId(): number {
  const timestampPart = Date.now() % 1000000; // Get last 6 digits of timestamp
  const randomPart = Math.floor(Math.random() * 1000); // Get 3 random digits
  return parseInt(`${timestampPart}${randomPart}`); // Combine into a 9-digit number that fits in INT4
}
