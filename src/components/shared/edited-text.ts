/** How many slots an account changed on a list: "3 edited", or null when there are none. */
export const editedText = (count: number): string | null => (count === 0 ? null : `${count} edited`);
