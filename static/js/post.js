import { logout, isLoggedIn, sendRequest } from "./util.js"
import { nav, statusBar } from "./components.js"


async function loadImage(image_id) {
  const image = await sendRequest(`/api/image/${image_id}`, { method: "GET" })
  const image_element = document.getElementById("image_preview")
  image_element.src = `data:image/png;base64,${image.base64}`
  
  const button = document.getElementById("post_button")
  button.onclick = async () => {
    const caption = document.getElementById("caption").value
    const formData = new FormData()
    formData.append("caption", caption)
    await sendRequest(`/api/post/${image_id}`, { method: "POST", body: formData })
    window.location.href = "/images"
  }
}

function main() {
  isLoggedIn().then(r => {
    if (!r) {
      window.location.href = "/login"
    } else {
      document.getElementById("logout_button").onclick = logout
      statusBar()
      nav(["home", "images"])
      loadImage(window.location.pathname.split("/").pop())
    }
  }).catch(e => {
    window.location.href = "/login"
  })
}

main()