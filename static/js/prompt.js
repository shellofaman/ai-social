import { sendRequest } from "./util.js"
import { button } from "./components.js"

class Prompt {
  #originalPrompt
  #prompt
  #saveButton
  #id
  #imageSection

  constructor() {
    console.log(window.location)
    const id = Number(window.location.pathname.split("/").pop())
    if (isNaN(id)) {
      console.error("Invalid prompt id")
      return
    }
    this.#id = id
    this.#saveButton = document.getElementById("save_button")
    this.#imageSection = new ImageSection(document.getElementById("image_container"), this.#id)
    this.#loadPrompt()
  }

  #loadPrompt = async () => {
    try {
      const data = await sendRequest(`/api/prompt/${this.#id}`)
      this.#originalPrompt = data.text
      this.#prompt = data.text
      const promptElem = document.getElementById("prompt")
      promptElem.value = this.#originalPrompt
      promptElem.oninput = (e) => {
        this.#prompt = e.target.value
        this.#saveButton.disabled = this.#prompt === this.#originalPrompt
      }
      this.#saveButton.disabled = this.#prompt === this.#originalPrompt
      this.#saveButton.onclick = this.#savePrompt
      document.getElementById("load_images_button").onclick = this.#imageSection.loadImages
    } catch (err) {
      console.error(err)
    }
  }

  #savePrompt = async () => {
    if (this.#saveButton.disabled) return
    this.#saveButton.disabled = true
    const formData = new FormData()
    formData.append("text", this.#prompt)
    try {
      const data = await sendRequest(`/api/prompt/${this.#id}`, {
        method: "PUT",
        body: formData
      })
      this.#originalPrompt = data.text
      this.#prompt = data.text
    } catch (err) {
      console.error(err)
      this.#saveButton.disabled = false
    }
  }
}

class ImageSection {
  #images = []
  #container
  #promptId

  constructor(element, promptId) {
    this.#container = element
    this.#promptId = promptId
    window.addEventListener("DeleteImage", this.#deleteImage)
  }

  loadImages = async () => {
    try {
      const data = await sendRequest(`/api/prompt/${this.#promptId}/images`)
      const newImages = data.filter(i => !this.#images.includes(i.id))
      const imgs = newImages.map(img => new ImageElem(img.id, img.url))
      this.#images.push(...imgs)
      this.#images.forEach(img => this.#container.appendChild(img.img))
    } catch (err) {
      console.error(err)
    }
  }

  #deleteImage = async ({ detail }) => {
    try {
      await sendRequest(`/api/prompt/${this.#promptId}/image/${detail.id}`, {
        method: "DELETE",
      })
      const imgIndex = this.#images.findIndex(img => img.id === detail.id)
      const img = this.#images.splice(imgIndex, 1)[0]
      img.deleteImage()
    } catch (err) {
      console.error(err)
    }
  }
}

class ImageElem {
  #url
  #width
  #height
  #imgContainer
  #id

  constructor(id, url) {
    this.#id = id
    this.#url = url
    this.#height = 1024 / 4
    this.#width = 1024 / 4
    this.#renderImage()
  }

  #renderImage = () => {
    this.#imgContainer = document.createElement("div")
    const img = document.createElement("img")
    img.src = this.#url.includes("http") ? this.#url : `${window.location.origin}/static/assets/images/${this.#url}`
    img.width = this.#width
    img.height = this.#height
    const deleteBtn = button(() => {
      window.dispatchEvent(new CustomEvent("DeleteImage", { detail: { id: this.#id }}))
    }, "Delete")
    this.#imgContainer.appendChild(img)
    this.#imgContainer.appendChild(deleteBtn)
  }
  deleteImage = () => {
    this.#imgContainer.remove()
  }
  get img() {
    return this.#imgContainer
  }
  get id() {
    return this.#id
  }
}

function main() {
  new Prompt()
}
main()