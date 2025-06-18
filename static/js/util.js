export async function sendRequest(url, options = {}, useAuth = true) {
  if (useAuth) {
    const token = localStorage.getItem("token")
    if (!token) { 
      window.location.href = "/login"
      throw Error("Not logged in")
    }
    options.headers = {
      "Authorization": `Bearer ${token}`,
      ...options.headers
    }
  }
  const result = await fetch(window.location.origin + url, options)
  if (result.ok) {
    const data = await result.json()
    return data
  } else {
    throw Error(await result.json())
  }
}

export async function isLoggedIn() {
  const token = localStorage.getItem("token")
  if (!token) return false
  try {
    await sendRequest("/api/status")
    return true
  } catch {
    return false
  }
}

export async function getStatus() {
  const data = await sendRequest("/api/status")
  return data
}

export async function logout() {
  await sendRequest("/api/logout", { method: "DELETE" })
  localStorage.removeItem("token")
  window.location.reload()
}