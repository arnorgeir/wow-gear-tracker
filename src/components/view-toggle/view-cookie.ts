/** The cookie string that remembers a layout for a year, for `document.cookie`. */
export const viewCookie = (name: string, value: string) => `${name}=${value}; path=/; max-age=31536000; SameSite=Lax`;
