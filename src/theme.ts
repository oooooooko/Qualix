import { readonly, shallowRef } from 'vue';

const storageKey = 'qualix:theme';

function readDarkMode() {
  try {
    return localStorage.getItem(storageKey) === 'dark';
  } catch {
    return false;
  }
}

const dark = shallowRef(readDarkMode());
export const darkMode = readonly(dark);

export function toggleDarkMode() {
  dark.value = !dark.value;
  try {
    localStorage.setItem(storageKey, dark.value ? 'dark' : 'light');
  } catch {
    // The theme still applies when storage is unavailable.
  }
}
