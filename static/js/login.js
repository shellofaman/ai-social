document.getElementById("login_button").addEventListener("click", login)

async function login() {
  const input = document.getElementById("passcode")
  const formData = new FormData()
  formData.append("passcode", input.value)
  const result = await fetch(`${window.location.origin}/login`, {
    method: "POST",
    body: formData
  })
  if (result.ok) {
    const data = await result.json()
    localStorage.setItem("token", data.token)
    window.location.href = "/"
  } else {
    const message = document.getElementById("login_message")
    message.textContent = "Invalid passcode"
  }
}