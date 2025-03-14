async function loadImages(id) {
  window.dispatchEvent(new CustomEvent("LoadImages", { detail: { id } }))
}
async function changePrompt(value) {
  window.dispatchEvent(new CustomEvent("ChangePrompt", { detail: { text: value }}))  
}
async function savePrompt() {
  window.dispatchEvent(new CustomEvent("SavePrompt"))
}

class Prompt {
  #originalPrompt
  #prompt
  #saveButton
  #id

  constructor() {
    const promptElem = document.getElementById("prompt")
    this.#originalPrompt = promptElem.value
    this.#prompt = promptElem.value
    const saveElem = document.getElementById("save_button")
    this.#saveButton = saveElem
    this.#id = saveElem.dataset.id
    window.addEventListener("ChangePrompt", this.#changePrompt)
    window.addEventListener("SavePrompt", this.#savePrompt)
  }

  #changePrompt = ({ detail }) => {
    this.#prompt = detail.text
    this.#saveButton.disabled = this.#prompt === this.#originalPrompt
  }

  #savePrompt = async () => {
    if (this.#saveButton.disabled) return
    this.#saveButton.disabled = true
    const formData = new FormData()
    formData.append("text", this.#prompt)
    const result = await fetch(`http://127.0.0.1:5000/prompt/${this.#id}`, {
      method: "PUT",
      body: formData
    })
    if (result.ok) {
      const data = await result.json()
      this.#originalPrompt = data.prompt.text
      this.#prompt = data.prompt.text
    } else {
      console.error(result)
      this.#saveButton.disabled = false
    }
  }
}

class ImageSection {
  #images = []
  #container
  #loading = false

  constructor(element) {
    this.#container = element
    window.addEventListener("LoadImages", this.#loadImages)
  }

  #loadImages = async ({ detail }) => {
    this.#loading = true
    const result = await fetch(`http://127.0.0.1:5000/prompt/${detail.id}/images`)
    if (result.ok) {
      const data = await result.json()
      const imgs = data.images.map(img => new ImageElem(img.id, img.url))
      this.#images.push(...imgs.map(img => img.id))
      imgs.forEach(img => this.#container.appendChild(img.img))
    } else {
      console.error(result)
    }
    this.#loading = false
  }

}

class ImageElem {
  #url
  #width
  #height
  #img
  #id

  constructor(id, url) {
    this.#id = id
    this.#url = url
    this.#height = 1024 / 4
    this.#width = 1024 / 4
    this.renderImage()
  }

  renderImage = () => {
    this.#img = document.createElement("img")
    this.#img.src = this.#url.includes("http") ? this.#url : `http://127.0.0.1:5000/static/assets/images/${this.#url}`
    this.#img.width = this.#width
    this.#img.height = this.#height
  }
  get img() {
    return this.#img
  }
  get id() {
    return this.#id
  }
}

function main() {
  new Prompt()
  new ImageSection(document.getElementById("image_container"))
}
main()