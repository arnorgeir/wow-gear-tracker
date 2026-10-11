/** How many slots an account changed on a list: "no edits" or "3 edited". */
export const editedText = (count: number) => (count === 0 ? 'no edits' : `${count} edited`);
