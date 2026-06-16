import { APP_AUTH, APP_AUTH_STORAGE_KEY } from "./authConfig";

export function isAuthenticated() {
  return window.localStorage.getItem(APP_AUTH_STORAGE_KEY) === "true";
}

export function loginWithCredentials(login: string, password: string) {
  const isValid =
    login.trim() === APP_AUTH.login && password === APP_AUTH.password;

  if (isValid) {
    window.localStorage.setItem(APP_AUTH_STORAGE_KEY, "true");
  }

  return isValid;
}

export function logout() {
  window.localStorage.removeItem(APP_AUTH_STORAGE_KEY);
}
