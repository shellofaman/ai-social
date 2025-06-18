import { sendRequest, isLoggedIn } from "./util.js"
import { button, statusBar } from "./components.js"

class Prompt {
  #originalPrompt
  #prompt
  #saveButton
  #id
  #imageSection

  constructor() {
    const id = Number(window.location.pathname.split("/").pop())
    if (isNaN(id)) {
      console.error("Invalid prompt id")
      return
    }
    this.#id = id
    this.#saveButton = document.getElementById("save_button")
    this.#imageSection = new ImageSection(document.getElementById("saved_images"), this.#id)
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
      document.getElementById("generate_image_button").onclick = this.#generateImage
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

  #generateImage = async () => {
    const formData = new FormData()
    formData.append("prompt_id", this.#id)
    formData.append("prompt", this.#prompt)
    try {
      await sendRequest("/api/image", {
        method: "POST",
        body: formData
      })
      await this.#imageSection.loadImages()
    } catch (err) {
      console.error(err)
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
      const imgs = newImages.map(img => new ImageElem(img.id, img.base64))
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
  #base64
  #width
  #height
  #imgContainer
  #id

  constructor(id, base64) {
    this.#id = id
    this.#base64 = base64
    this.#height = 1024 / 4
    this.#width = 1024 / 4
    this.#renderImage()
  }

  #renderImage = () => {
    this.#imgContainer = document.createElement("div")
    const img = document.createElement("img")
    img.src = `data:image/png;base64,${this.#base64}`
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
  isLoggedIn().then(r => {
    if (!r) {
      window.location.href = "/login"
    } else {
      statusBar()
      new Prompt()
    }
  })
}
main()