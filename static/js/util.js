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
    if (result.status === 401) {
      window.location.href = "/login"
    }
    throw Error(result)
  }
}