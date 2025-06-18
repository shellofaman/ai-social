import { logout, isLoggedIn, sendRequest } from "./util.js"
import { nav, statusBar } from "./components.js"


async function loadImages() {
  const images = await sendRequest("/api/images", { method: "GET" })
  const tbody = document.getElementById("images_body")
  images.forEach(d => {
    const row = document.createElement("tr")
    const idCell = document.createElement("td")
    idCell.textContent = d.id
    const promptCell = document.createElement("td")
    const promptButton = document.createElement("button")
    promptButton.classList.add("anchor-button")
    const promptAnchor = document.createElement("a")
    promptAnchor.href = `/prompt/${d.prompt_id}`
    promptAnchor.textContent = d.prompt_id
    promptButton.appendChild(promptAnchor)
    promptCell.appendChild(promptButton)
    const urlCell = document.createElement("td")
    urlCell.textContent = d.url
    const actionsCell = document.createElement("td")
    const deleteButton = document.createElement("button")
    deleteButton.textContent = "Delete"
    deleteButton.onclick = () => console.log('delete', d.id)
    const postButton = document.createElement("button")
    postButton.textContent = "Post"
    postButton.onclick = () => console.log('post', d.id)
    actionsCell.appendChild(deleteButton)
    actionsCell.appendChild(postButton)
    row.appendChild(idCell)
    row.appendChild(promptCell)
    row.appendChild(urlCell)
    row.appendChild(actionsCell)
    tbody.appendChild(row)
  })

}

function main() {
  isLoggedIn().then(r => {
    if (!r) {
      window.location.href = "/login"
    } else {
      document.getElementById("logout_button").onclick = logout
      statusBar()
      nav(["home", "prompts"])
      loadImages()
    }
  }).catch(e => {
    window.location.href = "/login"
  })
}
main()