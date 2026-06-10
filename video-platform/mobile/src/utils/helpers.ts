export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0];
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

