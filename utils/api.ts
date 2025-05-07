import { BASE_URL } from "./constants";

/**
 * Login a user with provided credentials.
 * @param username - The user's username.
 * @param password - The user's password.
 * @returns An object containing accessToken and refreshToken.
 */
export const login = async (username: string, password: string) => {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!res.ok) {
    throw new Error("Login failed");
  }

  return res.json(); // { accessToken, refreshToken }
};

/**
 * Register a new user with provided credentials.
 * @param username - The new user's username.
 * @param password - The new user's password.
 * @returns Server response (success or additional data).
 */
export const register = async (
  username: string,
  password: string,
  email: string
) => {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, email }),
  });

  if (!res.ok) {
    throw new Error("Register failed");
  }

  return res.json(); // could be: { success: true }
};
