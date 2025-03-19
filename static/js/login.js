async function login() {
  const input = document.getElementById("passcode")
  const formData = new FormData()
  formData.append("passcode", input.value)
  const result = await fetch("http://127.0.0.1:5000/login", {
    method: "POST",
    body: formData
  })
  if (result.ok) {
    const resultData = await result.json()
    localStorage.setItem("token", resultData.token)
  } else {
    console.error(result)
  }
}